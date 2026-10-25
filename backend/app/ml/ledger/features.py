"""Feature pipeline for the ledger classifier.

Four feature blocks, each earning its place:

``char_wb`` TF-IDF (2-5 grams)
    The workhorse. Bank narrations are short, abbreviated and corrupted, so
    character n-grams degrade gracefully where word features fall off a cliff:
    ``TVS ATMBLS`` (vowel-stripped ``TVS AUTOMOBILES``) shares most of its
    character grams with the clean form but not one whole word.

word TF-IDF (1-2 grams)
    Carries the multi-word merchant identities that character grams blur -
    ``RELIANCE JIO`` vs ``RELIANCE PETRO`` vs ``RELIANCE DIGITAL`` are three
    different ledgers and nearly the same character soup.

``log10(amount)``
    Genuinely discriminative: a ₹250 debit is conveyance, a ₹250,000 debit is
    not. Logged because the raw range spans five orders of magnitude, and a
    linear model on raw rupees would be dominated by the few large rows.

``direction`` + ``channel``
    One-hot. The channel comes from the narration parser, and an ACH debit
    being a recurring bill is one of the strongest single signals available.

Everything is inside one ``Pipeline``, so ``predict`` takes a raw narration and
there is no chance of the training-time and serving-time preparation drifting
apart - the classic way a deployed model quietly gets worse than its report.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder

from app.ml.ledger.narration import parse

#: Canonical input record. ``amount`` and ``direction`` may be absent; the
#: transformer fills neutral values rather than failing, because a narration
#: alone is a legitimate thing to classify.
Record = dict[str, Any]


class NarrationFrame(BaseEstimator, TransformerMixin):
    """Turn raw records into the feature frame the ColumnTransformer expects.

    A module-level class rather than a ``FunctionTransformer`` with a lambda,
    specifically so the fitted pipeline pickles - joblib cannot serialise a
    lambda, and that only surfaces when you try to save the model.
    """

    #: Output columns, in order.
    columns = ("text", "amount_log", "direction", "channel")

    def fit(self, X: Sequence[Record] | pd.DataFrame, y: Any = None) -> NarrationFrame:
        return self

    def transform(self, X: Sequence[Record] | pd.DataFrame) -> pd.DataFrame:
        records = X.to_dict("records") if isinstance(X, pd.DataFrame) else list(X)

        texts: list[str] = []
        amounts: list[float] = []
        directions: list[str] = []
        channels: list[str] = []

        for record in records:
            narration = str(record.get("narration") or "")
            parsed = parse(narration)

            texts.append(parsed.normalised)
            channels.append(parsed.channel.value)

            raw_amount = record.get("amount")
            try:
                amount = abs(float(raw_amount)) if raw_amount not in (None, "") else 0.0
            except (TypeError, ValueError):
                amount = 0.0
            # log1p, not log: a zero amount is a real case (a reversal, or a
            # record where the amount was not supplied) and log(0) is -inf.
            amounts.append(float(np.log10(amount + 1.0)))

            direction = str(record.get("direction") or "UNKNOWN").upper()
            directions.append(direction if direction in {"DEBIT", "CREDIT"} else "UNKNOWN")

        return pd.DataFrame(
            {
                "text": texts,
                "amount_log": amounts,
                "direction": directions,
                "channel": channels,
            }
        )

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        return np.asarray(self.columns, dtype=object)


def build_feature_union(
    *,
    char_ngrams: tuple[int, int] = (2, 5),
    word_ngrams: tuple[int, int] = (1, 2),
    min_df: int = 2,
    max_char_features: int | None = 120_000,
) -> ColumnTransformer:
    """The four feature blocks.

    ``sublinear_tf`` on both vectorisers: a merchant name repeated inside one
    narration is not twice as informative, and raw term frequency over-weights
    the duplication that bank formats introduce.

    ``min_df=2`` drops hapax n-grams. Besides shrinking the matrix, it removes
    the leftover fragments of identifiers that survive normalisation - exactly
    the features a model would use to memorise individual rows.
    """
    return ColumnTransformer(
        transformers=[
            (
                "char",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=char_ngrams,
                    min_df=min_df,
                    sublinear_tf=True,
                    max_features=max_char_features,
                    lowercase=True,
                ),
                "text",
            ),
            (
                "word",
                TfidfVectorizer(
                    analyzer="word",
                    ngram_range=word_ngrams,
                    min_df=min_df,
                    sublinear_tf=True,
                    lowercase=True,
                    token_pattern=r"(?u)\b\w\w+\b",
                ),
                "text",
            ),
            # MinMax rather than StandardScaler: standardising centres the
            # feature on zero, which puts half the values negative, and
            # ComplementNB - one of the baselines - rejects negative input
            # outright. Scaling to [0, 1] keeps every candidate model trainable
            # on identical features, which is the point of comparing them.
            # For a linear model the two are equivalent up to a coefficient.
            ("amount", MinMaxScaler(), ["amount_log"]),
            (
                "categorical",
                # handle_unknown='ignore' matters at serving time: a channel the
                # training data never contained must not raise, it must simply
                # contribute nothing.
                OneHotEncoder(handle_unknown="ignore", sparse_output=True),
                ["direction", "channel"],
            ),
        ],
        remainder="drop",
        sparse_threshold=1.0,
    )


def build_pipeline(estimator: BaseEstimator, **feature_kwargs: Any) -> Pipeline:
    """Prep -> features -> estimator, as one picklable object."""
    return Pipeline(
        steps=[
            ("prep", NarrationFrame()),
            ("features", build_feature_union(**feature_kwargs)),
            ("clf", estimator),
        ]
    )
