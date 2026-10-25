"""Risk checks over stored journal entries - Module 8.

The seven checks in app/ml/risk are pure functions over ``Transaction``. This
module builds those from a client's ledger and stores what they find.

Re-running a period replaces its *open* findings only. A finding someone has
already triaged - acknowledged, resolved, or marked a false positive with a
reason - is kept: that triage note is how the thresholds get tuned, and
deleting it on the next run would throw the lesson away.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from scipy.stats import chisquare
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ml.ledger.narration import parse
from app.ml.risk.checks import BENFORD_EXPECTED, BENFORD_MIN_SAMPLE, _first_digit, analyse
from app.ml.risk.types import RiskReport, Transaction
from app.models.books import JournalEntry, LedgerAccount
from app.models.enums import RiskCheck, RiskSeverity, RiskStatus
from app.models.intelligence import RiskFinding
from app.utils.jsonable import jsonable


def _counterparty(entry: JournalEntry) -> str:
    if entry.counterparty:
        return entry.counterparty
    parsed = parse(entry.narration)
    return parsed.counterparty or parsed.normalised or entry.narration[:60]


def load_transactions(
    session: Session, *, firm_id: uuid.UUID, client_id: uuid.UUID, period: str | None
) -> list[Transaction]:
    codes = {
        a.id: a.code
        for a in session.execute(
            select(LedgerAccount).where(LedgerAccount.firm_id == firm_id)
        ).scalars()
    }
    query = select(JournalEntry).where(
        JournalEntry.firm_id == firm_id, JournalEntry.client_id == client_id
    )
    if period:
        query = query.where(JournalEntry.period == period)

    return [
        Transaction(
            ref=str(entry.id),
            txn_date=entry.transaction_date,
            counterparty=_counterparty(entry),
            amount=entry.amount,
            direction=entry.direction.value,
            ledger_code=codes.get(entry.posted_ledger_id or entry.suggested_ledger_id),
            # When the row reached the system. For an imported statement this
            # is the import date, which is exactly what back-dating compares.
            entered_on=entry.created_at.date() if entry.created_at else None,
        )
        for entry in session.execute(query).scalars()
    ]


def run_checks(
    session: Session, *, firm_id: uuid.UUID, client_id: uuid.UUID, period: str
) -> tuple[RiskReport, list[RiskFinding]]:
    transactions = load_transactions(
        session, firm_id=firm_id, client_id=client_id, period=period
    )
    report = analyse(transactions, period=period)

    session.execute(
        delete(RiskFinding).where(
            RiskFinding.client_id == client_id,
            RiskFinding.period == period,
            RiskFinding.status == RiskStatus.OPEN,
        )
    )

    rows: list[RiskFinding] = []
    for finding in report.findings:
        entry_ids = []
        for ref in finding.refs:
            try:
                entry_ids.append(uuid.UUID(ref))
            except ValueError:
                continue
        row = RiskFinding(
            firm_id=firm_id,
            client_id=client_id,
            check=RiskCheck(finding.check.value),
            severity=RiskSeverity(finding.severity.value),
            status=RiskStatus.OPEN,
            title=finding.title[:255],
            detail=finding.detail,
            evidence=jsonable(
                {
                    **finding.evidence,
                    # Stored with the finding: an empty check list looks like
                    # a pass, so the reviewer needs to see what could not run.
                    "_skipped_checks": report.skipped,
                }
            ),
            entry_ids=entry_ids,
            amount=finding.amount,
            score=Decimal(f"{finding.score:.2f}"),
            period=period,
        )
        session.add(row)
        rows.append(row)
    return report, rows


@dataclass(slots=True)
class BenfordView:
    n: int
    sufficient: bool
    minimum: int
    observed: list[float]
    expected: list[float]
    chi_square: float | None
    p_value: float | None


def benford_view(amounts: list[Decimal]) -> BenfordView:
    """First-digit distribution for the risk screen's chart.

    The statistic is only reported at or above ``BENFORD_MIN_SAMPLE``. Below
    it the bars are still drawn - they are just counts - but no p-value is
    offered, for the reason the check itself gives: on a small sample the test
    produces confident nonsense.
    """
    digits = [d for d in (_first_digit(a) for a in amounts) if d is not None]
    n = len(digits)
    counts = [digits.count(d) for d in range(1, 10)]
    observed = [round(100 * c / n, 1) if n else 0.0 for c in counts]
    expected = [round(100 * BENFORD_EXPECTED[d], 1) for d in range(1, 10)]

    chi, p = None, None
    if n >= BENFORD_MIN_SAMPLE:
        result = chisquare(counts, f_exp=[BENFORD_EXPECTED[d] * n for d in range(1, 10)])
        chi, p = round(float(result.statistic), 3), round(float(result.pvalue), 4)
    return BenfordView(
        n=n,
        sufficient=n >= BENFORD_MIN_SAMPLE,
        minimum=BENFORD_MIN_SAMPLE,
        observed=observed,
        expected=expected,
        chi_square=chi,
        p_value=p,
    )
