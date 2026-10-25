"""Risk and anomaly endpoints - Module 8.

Stateless, like the reconciliation: transactions in, findings out. No database
needed.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.ml.risk.checks import analyse
from app.ml.risk.types import Transaction

router = APIRouter(prefix="/risk", tags=["risk"])


class TransactionIn(BaseModel):
    ref: str = Field(max_length=80)
    txn_date: date
    counterparty: str = Field(max_length=255)
    amount: Decimal = Field(gt=0, description="Always positive; direction is separate.")
    direction: Literal["DEBIT", "CREDIT"] = "DEBIT"
    ledger_code: str | None = Field(default=None, max_length=20)
    entered_on: date | None = Field(
        default=None,
        description=(
            "When the row was recorded. Supply it to enable the back-dating "
            "check; without it that check is reported as skipped."
        ),
    )

    def to_transaction(self) -> Transaction:
        return Transaction(
            ref=self.ref,
            txn_date=self.txn_date,
            counterparty=self.counterparty,
            amount=self.amount,
            direction=self.direction,
            ledger_code=self.ledger_code,
            entered_on=self.entered_on,
        )


class AnalyseIn(BaseModel):
    period: str = Field(default="", max_length=7, examples=["2026-09"])
    transactions: list[TransactionIn] = Field(min_length=1, max_length=20_000)


class FindingOut(BaseModel):
    check: str
    severity: str
    title: str
    detail: str
    refs: list[str]
    amount: Decimal | None
    score: float
    #: The statistics behind the finding, so it can be argued with rather than
    #: merely believed.
    evidence: dict


class RiskReportOut(BaseModel):
    period: str
    headline: str
    transactions_examined: int
    findings: list[FindingOut]
    severity_counts: dict[str, int]
    #: Checks that could not run, and why. Present because an empty findings
    #: list looks like a pass, and "Benford needs 150 transactions, this period
    #: has 40" is something a reviewer must know before concluding anything.
    skipped: dict[str, str]


@router.post("/analyse", response_model=RiskReportOut, summary="Run the risk checks")
def run_analysis(payload: AnalyseIn) -> RiskReportOut:
    """Run seven unsupervised checks over a period's ledger.

    Every check is rule-based or unsupervised, deliberately: there are no
    labelled fraud cases in this domain to train on, and a supervised model
    fitted to invented labels would report an accuracy that means nothing.

    Findings direct attention - they are not verdicts. A Benford deviation can
    equally mean a bounded approval limit as anything improper.
    """
    report = analyse(
        [row.to_transaction() for row in payload.transactions], period=payload.period
    )

    return RiskReportOut(
        period=report.period,
        headline=report.headline(),
        transactions_examined=report.transactions_examined,
        findings=[
            FindingOut(
                check=f.check.value,
                severity=f.severity.value,
                title=f.title,
                detail=f.detail,
                refs=f.refs,
                amount=f.amount,
                score=round(f.score, 2),
                evidence=f.evidence,
            )
            for f in report.findings
        ],
        severity_counts={k.value: v for k, v in report.by_severity.items()},
        skipped={str(k): v for k, v in report.skipped.items()},
    )
