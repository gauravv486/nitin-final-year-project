#!/usr/bin/env python
"""Train the ledger classifier.

    python scripts/generate_dataset.py --rows 12000
    python scripts/train_ledger_classifier.py

Writes to ``artifacts/``:

``ledger_clf.joblib``
    The fitted pipeline, ready for ``app/ml/ledger/predict.py``.
``ledger_clf.meta.json``
    Version, training rows, class list, and the headline metrics - so a
    prediction in the database can be traced to the model that made it.
``ledger_clf.report.txt``
    The full evaluation, for the project report.

Three candidates, chosen because they are the right family for this problem
rather than the fashionable one. The input is 100-character noisy strings with
~40 classes and ~10k examples; a linear model over character n-grams is the
established strong baseline for exactly that shape, trains in seconds on a CPU,
and its coefficients can be inspected to explain any single prediction - which
matters when a CA asks why a line was booked to a particular account.

``complement_nb``
    Cheap reference point. If the others cannot beat it, something is wrong
    with the features rather than the model.
``logreg``
    Multinomial logistic regression. Native probabilities, so calibration is
    usually decent before any correction.
``linear_svc``
    Usually the strongest on this feature shape, but has no probabilities at
    all - ``decision_function`` returns unbounded margins. Wrapped in
    ``CalibratedClassifierCV`` to turn margins into probabilities, which is
    *required* here, not optional: the whole auto-apply design depends on the
    confidence being a real probability.

Calibration is fitted with cross-validation on the training split only. Fitting
it on the holdout would make the reported calibration error meaningless.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import ComplementNB
from sklearn.svm import LinearSVC

from app.ml.ledger.chart import name_for
from app.ml.ledger.evaluation import evaluate, format_report
from app.ml.ledger.features import build_pipeline

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"
DATA_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "generated" / "ledger_train.csv"
)

#: Classes with fewer than this many training rows are dropped. A class with
#: three examples cannot be learned, cannot be evaluated, and its presence
#: drags macro-F1 down in a way that says nothing about the model - better to
#: declare it unsupported and route it to review.
MIN_CLASS_SUPPORT = 20


def build_candidates(seed: int) -> dict[str, object]:
    return {
        "complement_nb": ComplementNB(alpha=0.3),
        "logreg": LogisticRegression(
            C=8.0,
            max_iter=2000,
            # Multinomial via the saga solver: better-behaved probabilities
            # across many classes than one-vs-rest.
            solver="saga",
            random_state=seed,
            # The synthetic set is roughly balanced, but real corrections will
            # not be; balancing now means the artifact behaves the same later.
            class_weight="balanced",
        ),
        "linear_svc": CalibratedClassifierCV(
            LinearSVC(C=1.0, random_state=seed, class_weight="balanced"),
            # Platt scaling. Isotonic is more flexible but needs far more
            # calibration data per class than ~240 rows provides, and overfits
            # into a step function here.
            method="sigmoid",
            cv=3,
        ),
    }


def select_best(results: dict, f1_tolerance: float) -> str:
    """Pick the model to ship.

    Not simply "highest macro F1". Differences of a few ten-thousandths of F1
    are noise on a 2,400-row holdout, and selecting on them is overfitting the
    model choice to the test split.

    Calibration is the tie-breaker because the product depends on it: the
    confidence is shown to the user and compared against the auto-apply
    threshold, so a model that is 0.0006 worse at ranking but meaningfully
    better at *stating how sure it is* is the better model to deploy. Choosing
    the other way would mean the threshold does not mean what it says.
    """
    best_f1 = max(report.macro_f1 for _, report in results.values())
    contenders = [
        name
        for name, (_, report) in results.items()
        if best_f1 - report.macro_f1 <= f1_tolerance
    ]
    return min(contenders, key=lambda n: results[n][1].expected_calibration_error)


def load_data(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not path.exists():
        raise SystemExit(
            f"No dataset at {path}\nRun:  python scripts/generate_dataset.py --rows 12000"
        )

    frame = pd.read_csv(path, dtype={"ledger_code": str})
    required = {"narration", "amount", "direction", "ledger_code", "is_holdout"}
    missing = required - set(frame.columns)
    if missing:
        raise SystemExit(f"dataset is missing columns: {', '.join(sorted(missing))}")

    train = frame[frame["is_holdout"] == 0].reset_index(drop=True)
    holdout = frame[frame["is_holdout"] == 1].reset_index(drop=True)

    # Drop under-supported classes, judged on the training split only.
    counts = train["ledger_code"].value_counts()
    keep = set(counts[counts >= MIN_CLASS_SUPPORT].index)
    dropped = sorted(set(counts.index) - keep)
    if dropped:
        print(
            f"dropping {len(dropped)} class(es) with <{MIN_CLASS_SUPPORT} training rows: "
            + ", ".join(f"{c} ({counts[c]})" for c in dropped)
        )

    train = train[train["ledger_code"].isin(keep)].reset_index(drop=True)
    holdout = holdout[holdout["ledger_code"].isin(keep)].reset_index(drop=True)
    return train, holdout


def to_records(frame: pd.DataFrame) -> list[dict]:
    return frame[["narration", "amount", "direction"]].to_dict("records")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    parser.add_argument("--out-dir", type=Path, default=ARTIFACT_DIR)
    parser.add_argument("--seed", type=int, default=20261025)
    parser.add_argument(
        "--model",
        choices=("auto", "complement_nb", "logreg", "linear_svc"),
        default="auto",
        help="'auto' trains all three and selects by the rule in select_best()",
    )
    parser.add_argument(
        "--f1-tolerance",
        type=float,
        default=0.01,
        help=(
            "macro-F1 gap within which models count as tied, and calibration "
            "error decides instead"
        ),
    )
    args = parser.parse_args()

    import joblib

    train, holdout = load_data(args.data)
    if holdout.empty:
        raise SystemExit("holdout split is empty - regenerate the dataset")

    classes = np.array(sorted(train["ledger_code"].unique()))
    label_names = {code: name_for(code) for code in classes}

    print(
        f"\ntrain {len(train):,} rows · holdout {len(holdout):,} rows · "
        f"{len(classes)} classes\n"
    )

    x_train, y_train = to_records(train), train["ledger_code"].to_numpy()
    x_holdout, y_holdout = to_records(holdout), holdout["ledger_code"].to_numpy()

    candidates = build_candidates(args.seed)
    if args.model != "auto":
        candidates = {args.model: candidates[args.model]}

    results: dict[str, tuple[object, object]] = {}

    for name, estimator in candidates.items():
        print(f"--- {name} " + "-" * (58 - len(name)))
        pipeline = build_pipeline(estimator)

        started = time.perf_counter()
        pipeline.fit(x_train, y_train)
        elapsed = time.perf_counter() - started

        probabilities = pipeline.predict_proba(x_holdout)
        # Read predictions off the probability matrix rather than calling
        # .predict(): for a calibrated SVC the two can disagree, and the
        # confidence shown to the user must be the probability of the class
        # that was actually reported.
        pipeline_classes = pipeline.named_steps["clf"].classes_
        y_pred = pipeline_classes[probabilities.argmax(axis=1)]

        report = evaluate(
            y_holdout, y_pred, probabilities, pipeline_classes, label_names=label_names
        )
        results[name] = (pipeline, report)

        print(f"fit in {elapsed:.1f}s")
        for line in report.summary_lines():
            print(f"  {line}")
        print()

    best_name = select_best(results, args.f1_tolerance)
    best_pipeline, best_report = results[best_name]

    print("=" * 64)
    print(f"selected: {best_name}  (macro F1 {best_report.macro_f1:.4f})")
    if len(results) > 1:
        for name, (_, report) in sorted(
            results.items(), key=lambda kv: -kv[1][1].macro_f1
        ):
            marker = " <-" if name == best_name else ""
            print(
                f"  {name:<14} macro F1 {report.macro_f1:.4f}  "
                f"acc {report.accuracy:.4f}  ECE {report.expected_calibration_error:.4f}"
                f"{marker}"
            )
        print(
            f"\n  rule: best macro F1, then lowest calibration error among models\n"
            f"        within {args.f1_tolerance:.3f} F1 of it"
        )
    print("=" * 64 + "\n")

    detailed = format_report(best_report, label_names)
    print(detailed)

    # ------------------------------------------------------------ save ---
    args.out_dir.mkdir(parents=True, exist_ok=True)
    version = f"ledger-clf-{time.strftime('%Y%m%d-%H%M')}-{best_name}"

    model_path = args.out_dir / "ledger_clf.joblib"
    joblib.dump(
        {
            "pipeline": best_pipeline,
            "version": version,
            "classes": [str(c) for c in best_pipeline.named_steps["clf"].classes_],
        },
        model_path,
        compress=3,
    )

    meta = {
        "version": version,
        "algorithm": best_name,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "dataset": str(args.data),
        "train_rows": len(train),
        "holdout_rows": len(holdout),
        "n_classes": len(classes),
        "classes": {code: label_names[code] for code in classes},
        "min_class_support": MIN_CLASS_SUPPORT,
        "metrics": {
            "accuracy": best_report.accuracy,
            "macro_f1": best_report.macro_f1,
            "weighted_f1": best_report.weighted_f1,
            "expected_calibration_error": best_report.expected_calibration_error,
            "brier": best_report.brier,
            "log_loss": best_report.log_loss,
        },
        "coverage": [asdict(p) for p in best_report.coverage],
        "caveat": (
            "Metrics are on a SYNTHETIC holdout generated by "
            "scripts/generate_dataset.py. The vocabulary is finite, so the "
            "model never meets an unseen merchant here, which real statements "
            "are full of. Treat these numbers as an upper bound and quote the "
            "hand-labelled figure for real performance."
        ),
    }
    (args.out_dir / "ledger_clf.meta.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
    (args.out_dir / "ledger_clf.report.txt").write_text(detailed, encoding="utf-8")

    size_mb = model_path.stat().st_size / 1024 / 1024
    print(f"\nsaved {model_path.name} ({size_mb:.1f} MB) · version {version}")
    print(f"      ledger_clf.meta.json · ledger_clf.report.txt -> {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
