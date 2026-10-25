"""Ledger classification endpoints - Module 4.

The classifier needs no database, so these endpoints work before PostgreSQL is
configured. That is useful: the model can be demonstrated immediately, and
``scripts/try_classifier.py`` exercises the same code path from the command
line with no server at all.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.ml.ledger.chart import STANDARD_CHART
from app.ml.ledger.narration import parse
from app.ml.ledger.predict import get_classifier

router = APIRouter(prefix="/ledger", tags=["ledger"])


# ------------------------------------------------------------- schemas ------


class TransactionIn(BaseModel):
    narration: str = Field(
        min_length=1,
        max_length=500,
        description="Bank narration, exactly as it appears on the statement.",
        examples=["UPI/DR/412345678901/SWIGGY/UTIB/swiggy.upi@axisb/Payment"],
    )
    amount: Decimal | None = Field(
        default=None,
        ge=0,
        description=(
            "Transaction amount in rupees. Optional but worth supplying - it is "
            "a real feature, and the model is measurably less certain without it."
        ),
        examples=[850.00],
    )
    direction: Literal["DEBIT", "CREDIT"] | None = Field(
        default=None, description="DEBIT for money out, CREDIT for money in."
    )


class AlternativeOut(BaseModel):
    ledger_code: str
    ledger_name: str
    probability: float


class PredictionOut(BaseModel):
    ledger_code: str
    ledger_name: str
    #: Calibrated probability. See app/ml/ledger/README.md for what makes this
    #: number trustworthy enough to threshold on.
    confidence: float
    auto_apply: bool
    model_version: str
    alternatives: list[AlternativeOut]
    demoted_reason: str | None


class BatchIn(BaseModel):
    transactions: list[TransactionIn] = Field(min_length=1, max_length=1000)
    threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override the firm's auto-apply floor for this call.",
    )


class BatchOut(BaseModel):
    model_version: str
    predictions: list[PredictionOut]
    #: How many cleared the threshold, which is the number that matters to a
    #: practice deciding whether this saves them time.
    auto_applied: int
    deferred: int


class ParsedOut(BaseModel):
    """Exposed because it is the most useful debugging endpoint in the service:
    when a prediction looks wrong, the first question is always whether the
    narration parsed correctly."""

    channel: str
    counterparty: str | None
    normalised: str
    ifsc: str | None
    vpa: str | None
    masked_account: str | None


# ------------------------------------------------------------ endpoints -----


def _model_or_503():
    classifier = get_classifier()
    if classifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No ledger model is loaded. Train one with:  "
                "python scripts/generate_dataset.py --rows 12000 && "
                "python scripts/train_ledger_classifier.py"
            ),
        )
    return classifier


@router.post("/classify", response_model=PredictionOut, summary="Classify one transaction")
def classify_one(payload: TransactionIn) -> PredictionOut:
    classifier = _model_or_503()
    prediction = classifier.predict_one(
        narration=payload.narration,
        amount=payload.amount,
        direction=payload.direction,
    )
    return PredictionOut(**prediction.to_dict())


@router.post("/classify-batch", response_model=BatchOut, summary="Classify many")
def classify_batch(payload: BatchIn) -> BatchOut:
    """Batched because the real caller is a statement import of a few hundred
    lines, and one vectorise-and-multiply beats a loop of single predictions."""
    classifier = _model_or_503()
    records = [
        {
            "narration": t.narration,
            "amount": float(t.amount) if t.amount is not None else None,
            "direction": t.direction,
        }
        for t in payload.transactions
    ]
    predictions = classifier.predict_many(records, threshold=payload.threshold)
    auto = sum(1 for p in predictions if p.auto_apply)

    return BatchOut(
        model_version=classifier.version,
        predictions=[PredictionOut(**p.to_dict()) for p in predictions],
        auto_applied=auto,
        deferred=len(predictions) - auto,
    )


@router.get("/parse", response_model=ParsedOut, summary="Inspect narration parsing")
def parse_narration(
    narration: Annotated[str, Query(min_length=1, max_length=500)],
) -> ParsedOut:
    parsed = parse(narration)
    return ParsedOut(
        channel=parsed.channel.value,
        counterparty=parsed.counterparty,
        normalised=parsed.normalised,
        ifsc=parsed.ifsc,
        vpa=parsed.vpa,
        masked_account=parsed.masked_account,
    )


@router.get("/chart", summary="The standard chart of accounts")
def chart() -> dict:
    """Also reports which accounts the model is allowed to predict.

    Worth exposing: roughly half the chart is marked unpredictable, and a
    reviewer wondering why the model never suggests "Share Capital" should be
    able to see that it is by design rather than a bug.
    """
    classifier = get_classifier()
    trained = set(classifier.classes.tolist()) if classifier else set()

    return {
        "model_version": classifier.version if classifier else None,
        "accounts": [
            {
                "code": spec.code,
                "name": spec.name,
                "group": spec.group.value,
                "classifiable": spec.classifiable,
                "in_current_model": spec.code in trained,
            }
            for spec in STANDARD_CHART
        ],
    }
