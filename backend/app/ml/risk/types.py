"""Types for the risk and anomaly checks - Module 8."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum


class RiskCheck(StrEnum):
    """Mirrors ``app.models.enums.RiskCheck``."""

    DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT"
    ROUND_SUM = "ROUND_SUM"
    BENFORD_DEVIATION = "BENFORD_DEVIATION"
    WEEKEND_ENTRY = "WEEKEND_ENTRY"
    VENDOR_CONCENTRATION = "VENDOR_CONCENTRATION"
    OUTLIER_AMOUNT = "OUTLIER_AMOUNT"
    BACKDATED_ENTRY = "BACKDATED_ENTRY"


class Severity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass(slots=True, frozen=True)
class Transaction:
    """One ledger entry, as the checks see it."""

    ref: str
    txn_date: date
    counterparty: str
    amount: Decimal
    direction: str = "DEBIT"
    ledger_code: str | None = None
    #: When the row was entered, if known. Compared against ``txn_date`` to
    #: find back-dating.
    entered_on: date | None = None


@dataclass(slots=True)
class Finding:
    """One thing worth a reviewer's attention.

    ``evidence`` carries the statistics behind the finding - the chi-square
    value, the observed and expected distributions, the duplicate group. It
    exists so the finding can be *defended* in a review rather than merely
    asserted, which is the difference between an audit tool and an alarm.
    """

    check: RiskCheck
    severity: Severity
    title: str
    detail: str
    refs: list[str] = field(default_factory=list)
    amount: Decimal | None = None
    #: 0-100.
    score: float = 0.0
    evidence: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not 0.0 <= self.score <= 100.0:
            raise ValueError(f"score must be 0-100, got {self.score}")


@dataclass(slots=True)
class RiskReport:
    period: str
    transactions_examined: int
    findings: list[Finding] = field(default_factory=list)
    #: Checks that could not run, and why. Reported rather than silently
    #: skipped: "Benford needs 150+ transactions, this period has 40" is
    #: information the reviewer needs, and a blank result looks like a pass.
    skipped: dict[str, str] = field(default_factory=dict)

    @property
    def by_severity(self) -> dict[Severity, int]:
        counts = dict.fromkeys(Severity, 0)
        for finding in self.findings:
            counts[finding.severity] += 1
        return counts

    @property
    def total_exposure(self) -> Decimal:
        """Summed value of flagged transactions.

        Indicative only - one transaction can trip several checks, so this
        double-counts by design rather than hiding findings to keep a total
        tidy.
        """
        return sum((f.amount or Decimal("0") for f in self.findings), Decimal("0"))

    def headline(self) -> str:
        counts = self.by_severity
        return (
            f"{self.period}: {len(self.findings)} finding(s) across "
            f"{self.transactions_examined} transactions "
            f"({counts[Severity.CRITICAL]} critical, {counts[Severity.HIGH]} high)"
        )
