"""Serving the ledger classifier.

Loaded once at application startup and held in memory - the artifact is a few
megabytes and unpickling it per request would dominate the latency.

The important behaviour here is **declining to answer**. Three guards sit
between the raw model output and a suggestion the UI will show:

1. **The confidence floor.** Below the firm's threshold the prediction is
   returned but flagged ``auto_apply=False``, so it reaches a human instead of
   the books. The threshold is meaningful only because the probabilities are
   calibrated - see ``app/ml/ledger/README.md``.
2. **Direction sanity.** A DEBIT predicted as "Interest Income" is almost
   certainly wrong, whatever the probability says. Such a prediction is
   demoted rather than dropped, with the reason recorded.
3. **No model, no guess.** If the artifact is missing the service reports that
   plainly and routes everything to review. It does not fall back to keyword
   matching dressed up as a prediction, because a fabricated confidence is
   worse than an honest refusal.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.ml.ledger.chart import SUSPENSE_CODE, expected_direction, name_for

logger = logging.getLogger(__name__)

ARTIFACT_NAME = "ledger_clf.joblib"


@dataclass(slots=True)
class Alternative:
    ledger_code: str
    ledger_name: str
    probability: float


@dataclass(slots=True)
class LedgerPrediction:
    """One suggestion, plus everything needed to justify it."""

    ledger_code: str
    ledger_name: str
    confidence: float
    #: True only when the confidence clears the threshold AND no guard fired.
    auto_apply: bool
    model_version: str
    #: Runner-up classes, so correcting a wrong guess is one click.
    alternatives: list[Alternative] = field(default_factory=list)
    #: Set when a guard demoted the prediction, for display and for the log.
    demoted_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ledger_code": self.ledger_code,
            "ledger_name": self.ledger_name,
            "confidence": round(self.confidence, 4),
            "auto_apply": self.auto_apply,
            "model_version": self.model_version,
            "alternatives": [
                {
                    "ledger_code": a.ledger_code,
                    "ledger_name": a.ledger_name,
                    "probability": round(a.probability, 4),
                }
                for a in self.alternatives
            ],
            "demoted_reason": self.demoted_reason,
        }


class ModelUnavailable(RuntimeError):
    """Raised when the artifact is missing or unreadable."""


class LedgerClassifier:
    """Thin wrapper over the fitted pipeline."""

    def __init__(self, pipeline: Any, version: str, classes: list[str]) -> None:
        self._pipeline = pipeline
        self.version = version
        self.classes = np.asarray(classes)

    @classmethod
    def load(cls, path: Path) -> LedgerClassifier:
        import joblib

        if not path.exists():
            raise ModelUnavailable(
                f"No model artifact at {path}. Train one with:\n"
                "  python scripts/generate_dataset.py --rows 12000\n"
                "  python scripts/train_ledger_classifier.py"
            )
        payload = joblib.load(path)
        pipeline = payload["pipeline"]
        return cls(
            pipeline=pipeline,
            version=payload.get("version", "unknown"),
            classes=[str(c) for c in pipeline.named_steps["clf"].classes_],
        )

    def predict_many(
        self,
        records: list[dict[str, Any]],
        *,
        threshold: float | None = None,
        top_k: int = 3,
    ) -> list[LedgerPrediction]:
        """Classify a batch.

        Batched because the real call site is a statement import of a few
        hundred lines, and one vectorise-and-multiply over the whole batch is
        far cheaper than a loop of single predictions.
        """
        if not records:
            return []

        floor = settings.LEDGER_AUTO_APPLY_FLOOR if threshold is None else threshold
        probabilities = self._pipeline.predict_proba(records)

        out: list[LedgerPrediction] = []
        for record, row in zip(records, probabilities, strict=True):
            # argsort descending, keeping one extra so the top-k alternatives
            # exclude the chosen class itself.
            order = np.argsort(row)[::-1]
            best_index = int(order[0])
            code = str(self.classes[best_index])
            confidence = float(row[best_index])

            alternatives = [
                Alternative(
                    ledger_code=str(self.classes[int(i)]),
                    ledger_name=name_for(str(self.classes[int(i)])),
                    probability=float(row[int(i)]),
                )
                for i in order[1 : top_k + 1]
            ]

            auto_apply = confidence >= floor
            reason: str | None = None

            direction = str(record.get("direction") or "").upper()
            wanted = expected_direction(code)
            if wanted and direction and direction != wanted:
                # Not an error - a refund really does credit an expense - but
                # it is unusual enough that a person should look.
                auto_apply = False
                reason = (
                    f"{direction.lower()} posted to an account that normally takes "
                    f"a {wanted.lower()}"
                )
            elif not auto_apply:
                reason = f"confidence {confidence:.2f} below the {floor:.2f} threshold"

            out.append(
                LedgerPrediction(
                    ledger_code=code,
                    ledger_name=name_for(code),
                    confidence=confidence,
                    auto_apply=auto_apply,
                    model_version=self.version,
                    alternatives=alternatives,
                    demoted_reason=reason,
                )
            )

        return out

    def predict_one(
        self,
        narration: str,
        amount: Decimal | float | None = None,
        direction: str | None = None,
        *,
        threshold: float | None = None,
    ) -> LedgerPrediction:
        record = {
            "narration": narration,
            "amount": float(amount) if amount is not None else None,
            "direction": direction,
        }
        return self.predict_many([record], threshold=threshold)[0]


@lru_cache(maxsize=1)
def get_classifier() -> LedgerClassifier | None:
    """The process-wide classifier, or ``None`` when no artifact exists.

    Returns ``None`` rather than raising so the API still boots and serves
    every other feature with the model absent - a missing optional artifact
    should not take the whole service down. Callers check for ``None`` and fall
    back to the suspense account.
    """
    path = settings.MODEL_DIR / ARTIFACT_NAME
    try:
        classifier = LedgerClassifier.load(path)
    except ModelUnavailable as exc:
        logger.warning("Ledger classifier unavailable: %s", exc)
        return None
    except Exception:
        logger.exception("Ledger classifier failed to load from %s", path)
        return None

    logger.info(
        "Ledger classifier %s loaded (%d classes)", classifier.version, len(classifier.classes)
    )
    return classifier


def unclassified(reason: str) -> LedgerPrediction:
    """The honest answer when no model is available."""
    return LedgerPrediction(
        ledger_code=SUSPENSE_CODE,
        ledger_name=name_for(SUSPENSE_CODE),
        confidence=0.0,
        auto_apply=False,
        model_version="none",
        demoted_reason=reason,
    )
