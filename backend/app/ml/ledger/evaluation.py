"""Evaluation for the ledger classifier.

Accuracy alone is the wrong headline for this problem. The model's job is not
to be right about everything - it is to be right about the rows it claims
confidence on, and to hand the rest to a person. That makes two things more
important than accuracy:

**Calibration.** The confidence is shown in the UI and compared against an
auto-apply threshold. If the model says 0.95 it had better be right about 95%
of such rows, or the threshold means nothing and the human-review queue is
built on a lie. Measured here as expected calibration error and Brier score.

**The coverage/accuracy trade-off.** At a threshold of 0.9 the model might
auto-classify 60% of lines at 97% accuracy, leaving 40% for review. That pair
of numbers is the actual product decision, and it is what the table from
``coverage_curve`` is for.

A confusion matrix is still reported, because *which* classes get mixed up
tells you whether the errors are benign (two expense accounts a reviewer would
accept either way) or serious (an expense booked as a fixed asset, which
misstates profit).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_fscore_support,
)


@dataclass(slots=True)
class ReliabilityBin:
    lower: float
    upper: float
    count: int
    mean_confidence: float
    accuracy: float

    @property
    def gap(self) -> float:
        """Signed calibration error. Positive means over-confident."""
        return self.mean_confidence - self.accuracy


@dataclass(slots=True)
class CoveragePoint:
    threshold: float
    #: Share of rows the model would answer at this threshold.
    coverage: float
    #: Accuracy on just those rows.
    accuracy: float
    #: Rows left for a human.
    deferred: int


@dataclass(slots=True)
class ClassMetric:
    label: str
    name: str
    precision: float
    recall: float
    f1: float
    support: int


@dataclass(slots=True)
class EvaluationReport:
    n: int
    accuracy: float
    macro_f1: float
    weighted_f1: float
    #: Mean of the predicted probability for the chosen class.
    mean_confidence: float
    expected_calibration_error: float
    brier: float
    log_loss: float
    per_class: list[ClassMetric] = field(default_factory=list)
    reliability: list[ReliabilityBin] = field(default_factory=list)
    coverage: list[CoveragePoint] = field(default_factory=list)
    #: ``(true, predicted, count)``, worst first.
    top_confusions: list[tuple[str, str, int]] = field(default_factory=list)

    def summary_lines(self) -> list[str]:
        return [
            f"rows               : {self.n:,}",
            f"accuracy           : {self.accuracy:.4f}",
            f"macro F1           : {self.macro_f1:.4f}",
            f"weighted F1        : {self.weighted_f1:.4f}",
            f"mean confidence    : {self.mean_confidence:.4f}",
            f"calibration error  : {self.expected_calibration_error:.4f}  (lower is better)",
            f"Brier score        : {self.brier:.4f}",
            f"log loss           : {self.log_loss:.4f}",
        ]


def expected_calibration_error(
    confidences: np.ndarray,
    correct: np.ndarray,
    n_bins: int = 10,
) -> tuple[float, list[ReliabilityBin]]:
    """ECE with equal-width bins.

    ECE is the average gap between stated confidence and observed accuracy,
    weighted by how many predictions fall in each bin. A model that says 0.9
    and is right 70% of the time contributes 0.2 for those rows.

    Equal-width rather than equal-count bins because the thresholds that matter
    operationally are fixed numbers (0.8, 0.9, 0.95), and equal-count bins move
    their boundaries with the data.
    """
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    bins: list[ReliabilityBin] = []
    total = len(confidences)
    error = 0.0

    for i in range(n_bins):
        low, high = edges[i], edges[i + 1]
        # Upper-inclusive on the final bin so a confidence of exactly 1.0 lands
        # somewhere instead of being silently dropped.
        mask = (
            (confidences > low) & (confidences <= high)
            if i > 0
            else (confidences >= low) & (confidences <= high)
        )
        count = int(mask.sum())
        if count == 0:
            bins.append(ReliabilityBin(low, high, 0, 0.0, 0.0))
            continue

        mean_conf = float(confidences[mask].mean())
        acc = float(correct[mask].mean())
        bins.append(ReliabilityBin(low, high, count, mean_conf, acc))
        error += (count / total) * abs(mean_conf - acc)

    return error, bins


def coverage_curve(
    confidences: np.ndarray,
    correct: np.ndarray,
    thresholds: tuple[float, ...] = (0.0, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99),
) -> list[CoveragePoint]:
    """Accuracy against the share of rows answered, per threshold.

    This is the table to put in the report. It answers the only question a
    practice actually asks: "how much of my bookkeeping can this do on its own,
    and how often will it be wrong when it does?"
    """
    total = len(confidences)
    points: list[CoveragePoint] = []

    for threshold in thresholds:
        mask = confidences >= threshold
        answered = int(mask.sum())
        points.append(
            CoveragePoint(
                threshold=threshold,
                coverage=answered / total if total else 0.0,
                accuracy=float(correct[mask].mean()) if answered else float("nan"),
                deferred=total - answered,
            )
        )

    return points


def evaluate(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    probabilities: np.ndarray,
    classes: np.ndarray,
    *,
    label_names: dict[str, str] | None = None,
    n_confusions: int = 12,
) -> EvaluationReport:
    """Build the full report.

    ``probabilities`` is the ``(n_samples, n_classes)`` matrix aligned with
    ``classes``, as ``predict_proba`` returns it.
    """
    names = label_names or {}
    confidences = probabilities.max(axis=1)
    correct = (y_true == y_pred).astype(float)

    ece, reliability = expected_calibration_error(confidences, correct)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0
    )
    per_class = [
        ClassMetric(
            label=str(label),
            name=names.get(str(label), str(label)),
            precision=float(precision[i]),
            recall=float(recall[i]),
            f1=float(f1[i]),
            support=int(support[i]),
        )
        for i, label in enumerate(classes)
    ]

    # One-vs-rest Brier over the chosen class: the squared error between the
    # stated confidence and whether it was actually right.
    brier = float(brier_score_loss(correct, confidences))

    matrix = confusion_matrix(y_true, y_pred, labels=classes)
    confusions: list[tuple[str, str, int]] = []
    for i, true_label in enumerate(classes):
        for j, pred_label in enumerate(classes):
            if i != j and matrix[i, j] > 0:
                confusions.append((str(true_label), str(pred_label), int(matrix[i, j])))
    confusions.sort(key=lambda row: row[2], reverse=True)

    return EvaluationReport(
        n=len(y_true),
        accuracy=float(accuracy_score(y_true, y_pred)),
        macro_f1=float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        weighted_f1=float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        mean_confidence=float(confidences.mean()),
        expected_calibration_error=float(ece),
        brier=brier,
        log_loss=float(log_loss(y_true, probabilities, labels=list(classes))),
        per_class=per_class,
        reliability=reliability,
        coverage=coverage_curve(confidences, correct),
        top_confusions=confusions[:n_confusions],
    )


def format_report(report: EvaluationReport, label_names: dict[str, str]) -> str:
    """Human-readable report for the console and the saved metrics file."""
    out: list[str] = [*report.summary_lines(), ""]

    out.append("coverage / accuracy trade-off")
    out.append(f"  {'threshold':>9}  {'answered':>9}  {'accuracy':>9}  {'deferred':>9}")
    for point in report.coverage:
        accuracy = "    n/a" if np.isnan(point.accuracy) else f"{point.accuracy:.4f}"
        out.append(
            f"  {point.threshold:>9.2f}  {point.coverage:>8.1%}  {accuracy:>9}  "
            f"{point.deferred:>9,}"
        )
    out.append("")

    out.append("reliability (stated confidence vs observed accuracy)")
    out.append(f"  {'bin':>12}  {'n':>7}  {'confidence':>10}  {'accuracy':>9}  {'gap':>7}")
    for b in report.reliability:
        if b.count == 0:
            continue
        out.append(
            f"  {b.lower:.1f}-{b.upper:.1f}{'':>5}  {b.count:>7,}  "
            f"{b.mean_confidence:>10.4f}  {b.accuracy:>9.4f}  {b.gap:>+7.4f}"
        )
    out.append("")

    weakest = sorted(report.per_class, key=lambda c: c.f1)[:10]
    out.append("weakest classes by F1")
    out.append(f"  {'code':>6}  {'name':<30}  {'prec':>6}  {'recall':>6}  {'F1':>6}  {'n':>5}")
    for c in weakest:
        out.append(
            f"  {c.label:>6}  {c.name[:30]:<30}  {c.precision:>6.3f}  "
            f"{c.recall:>6.3f}  {c.f1:>6.3f}  {c.support:>5}"
        )
    out.append("")

    out.append("most frequent confusions (true -> predicted)")
    for true_label, pred_label, count in report.top_confusions:
        true_name = label_names.get(true_label, true_label)
        pred_name = label_names.get(pred_label, pred_label)
        out.append(f"  {count:>5}x  {true_name[:28]:<28} -> {pred_name[:28]}")

    return "\n".join(out)
