"""Bookkeeping - persisting the classifier's opinion and the reviewer's decision.

The classifier itself (app/ml/ledger) is stateless. This module is where its
output meets the ledger, and it keeps the rule set out in app/models/books.py:
the model's suggestion and the human's decision live in separate columns, and
an override is recorded rather than overwritten.

Three outcomes per entry:

``APPROVED`` with ``reviewed_by_id`` NULL
    Auto-applied: calibrated confidence cleared the firm's floor and no guard
    fired. The absence of a reviewer is what marks it as machine-posted.
``UNDER_REVIEW``
    Below the floor, or a guard demoted it. Waits for a person.
``APPROVED`` with ``reviewed_by_id`` set
    A person decided. ``overridden`` says whether they agreed.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.ledger.chart import SUSPENSE_CODE
from app.ml.ledger.narration import parse
from app.ml.ledger.predict import get_classifier
from app.models.books import JournalEntry, LedgerAccount
from app.models.enums import JournalStatus, LedgerGroup, TransactionDirection
from app.models.intelligence import LedgerTrainingExample
from app.models.tenancy import FirmSettings
from app.utils.periods import to_month_period
from app.utils.tabular import TableError, parse_amount, parse_date, pick, read_table

#: The contra account for every bank-statement line. A debit on the statement
#: is money out: Dr <expense>, Cr Bank. A credit is the reverse.
BANK_CODE = "1010"


def chart_by_code(session: Session, firm_id: uuid.UUID) -> dict[str, LedgerAccount]:
    rows = session.execute(
        select(LedgerAccount).where(LedgerAccount.firm_id == firm_id)
    ).scalars()
    return {account.code: account for account in rows}


def firm_floor(session: Session, firm_id: uuid.UUID) -> float:
    """The firm's auto-apply threshold, falling back to the global default."""
    from app.core.config import settings

    value = session.execute(
        select(FirmSettings.auto_apply_floor).where(FirmSettings.firm_id == firm_id)
    ).scalar_one_or_none()
    return float(value) if value is not None else settings.LEDGER_AUTO_APPLY_FLOOR


@dataclass(slots=True)
class ClassifyOutcome:
    model_version: str
    threshold: float
    classified: int = 0
    auto_applied: int = 0
    queued_for_review: int = 0
    #: Predicted codes missing from the firm's chart, routed to suspense.
    unmapped: list[str] = field(default_factory=list)


def classify_entries(
    session: Session,
    *,
    firm_id: uuid.UUID,
    client_id: uuid.UUID,
    period: str | None = None,
    entry_ids: list[uuid.UUID] | None = None,
    reclassify: bool = False,
) -> ClassifyOutcome:
    """Run the classifier over a client's entries and store its opinion.

    By default only entries with no suggestion yet are touched, and entries a
    *person* has approved are never touched, even with ``reclassify`` - a new
    model version does not get to silently overwrite a human decision.
    """
    classifier = get_classifier()
    if classifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No ledger model is loaded; run scripts/train_ledger_classifier.py",
        )

    query = select(JournalEntry).where(
        JournalEntry.firm_id == firm_id,
        JournalEntry.client_id == client_id,
        JournalEntry.reviewed_by_id.is_(None),
    )
    if period:
        query = query.where(JournalEntry.period == period)
    if entry_ids:
        query = query.where(JournalEntry.id.in_(entry_ids))
    if not reclassify:
        query = query.where(JournalEntry.suggested_ledger_id.is_(None))

    entries = session.execute(query.order_by(JournalEntry.transaction_date)).scalars().all()
    threshold = firm_floor(session, firm_id)
    outcome = ClassifyOutcome(model_version=classifier.version, threshold=threshold)
    if not entries:
        return outcome

    chart = chart_by_code(session, firm_id)
    suspense = chart.get(SUSPENSE_CODE)
    predictions = classifier.predict_many(
        [
            {
                "narration": e.narration,
                "amount": float(e.amount),
                "direction": e.direction.value,
            }
            for e in entries
        ],
        threshold=threshold,
    )

    for entry, prediction in zip(entries, predictions, strict=True):
        account = chart.get(prediction.ledger_code)
        auto_apply = prediction.auto_apply
        if account is None:
            # The firm deleted or renamed this code. Suspense, never a guess
            # at the nearest neighbour.
            outcome.unmapped.append(prediction.ledger_code)
            account, auto_apply = suspense, False

        parsed = parse(entry.narration)
        entry.normalised_narration = parsed.normalised[:255] or None
        entry.counterparty = (parsed.counterparty or entry.counterparty or None)
        entry.suggested_ledger_id = account.id if account else None
        entry.confidence = Decimal(f"{prediction.confidence:.4f}")
        entry.model_version = prediction.model_version
        entry.alternatives = [
            {
                "ledger_id": str(chart[a.ledger_code].id) if a.ledger_code in chart else None,
                "ledger_code": a.ledger_code,
                "ledger_name": a.ledger_name,
                "probability": round(a.probability, 4),
            }
            for a in prediction.alternatives
        ]

        if auto_apply and account is not None:
            entry.status = JournalStatus.APPROVED
            entry.posted_ledger_id = account.id
            outcome.auto_applied += 1
        else:
            entry.status = JournalStatus.UNDER_REVIEW
            entry.posted_ledger_id = None
            outcome.queued_for_review += 1
        outcome.classified += 1

    outcome.unmapped = sorted(set(outcome.unmapped))
    return outcome


def review_entry(
    session: Session,
    *,
    entry: JournalEntry,
    reviewer_id: uuid.UUID,
    ledger_code: str,
) -> JournalEntry:
    """Record a person's decision on one entry.

    Choosing anything other than the suggestion sets ``overridden`` and adds
    the row to ``ledger_training_examples`` as a ``correction`` - the only
    real labelled data the project will ever accumulate.
    """
    chart = chart_by_code(session, entry.firm_id)
    account = chart.get(ledger_code)
    if account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Ledger {ledger_code} is not in this firm's chart of accounts",
        )

    overridden = entry.suggested_ledger_id is not None and account.id != entry.suggested_ledger_id
    entry.posted_ledger_id = account.id
    entry.status = JournalStatus.APPROVED
    entry.reviewed_by_id = reviewer_id
    entry.reviewed_at = datetime.now(UTC)
    entry.overridden = overridden

    if overridden or entry.suggested_ledger_id is None:
        session.add(
            LedgerTrainingExample(
                firm_id=entry.firm_id,
                narration=entry.narration,
                amount=entry.amount,
                direction=entry.direction.value,
                ledger_code=account.code,
                source="correction",
                is_holdout=False,
            )
        )
    return entry


# ------------------------------------------------------------ statements ---


@dataclass(slots=True)
class ImportOutcome:
    imported: int = 0
    skipped: list[str] = field(default_factory=list)


def import_statement(
    session: Session,
    *,
    firm_id: uuid.UUID,
    client_id: uuid.UUID,
    data: bytes,
    filename: str,
    document_id: uuid.UUID | None = None,
) -> ImportOutcome:
    """Turn a bank statement export into journal entries.

    One row per transaction. A row with both a debit and a credit, or neither,
    is reported as skipped with its line number rather than guessed at.
    """
    try:
        rows = read_table(data, filename)
    except TableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    outcome = ImportOutcome()
    for line_no, row in enumerate(rows, start=2):
        txn_date = parse_date(
            pick(row, "date", "txn date", "transaction date", "value date", "tran date")
        )
        narration = pick(
            row, "narration", "description", "particulars", "remarks", "transaction details"
        )
        debit = parse_amount(
            pick(row, "debit", "withdrawal", "withdrawal amt", "withdrawal amount", "dr", "debit amount")
        )
        credit = parse_amount(
            pick(row, "credit", "deposit", "deposit amt", "deposit amount", "cr", "credit amount")
        )
        amount_only = parse_amount(pick(row, "amount"))
        if debit is None and credit is None and amount_only is not None:
            # A single signed amount column: negative is money out.
            debit, credit = (-amount_only, None) if amount_only < 0 else (None, amount_only)

        if txn_date is None or not narration:
            outcome.skipped.append(f"line {line_no}: missing date or narration")
            continue
        has_debit = debit is not None and debit != 0
        has_credit = credit is not None and credit != 0
        if has_debit == has_credit:
            outcome.skipped.append(f"line {line_no}: needs exactly one of debit or credit")
            continue

        amount = abs(debit if has_debit else credit)  # type: ignore[arg-type]
        session.add(
            JournalEntry(
                firm_id=firm_id,
                client_id=client_id,
                document_id=document_id,
                transaction_date=txn_date,
                narration=narration[:2000],
                reference=pick(row, "reference", "ref no", "chq ref no", "cheque no", "utr")[:100]
                or None,
                amount=amount,
                direction=TransactionDirection.DEBIT if has_debit else TransactionDirection.CREDIT,
                status=JournalStatus.SUGGESTED,
                period=to_month_period(txn_date),
            )
        )
        outcome.imported += 1
    return outcome


# --------------------------------------------------------- trial balance ---


@dataclass(slots=True)
class TrialBalanceRow:
    code: str
    name: str
    group: LedgerGroup
    debit: Decimal
    credit: Decimal

    @property
    def balance(self) -> Decimal:
        """Debit-positive: assets and expenses positive, liabilities, equity
        and income negative - the sign convention every TB report uses."""
        return self.debit - self.credit


@dataclass(slots=True)
class TrialBalance:
    rows: list[TrialBalanceRow]
    #: Entries excluded because no-one has posted them yet. Reported, because
    #: a trial balance that silently omits the review queue looks complete.
    unposted_count: int
    unposted_amount: Decimal

    @property
    def total_debit(self) -> Decimal:
        return sum((r.debit for r in self.rows), Decimal("0"))

    @property
    def total_credit(self) -> Decimal:
        return sum((r.credit for r in self.rows), Decimal("0"))


def trial_balance(
    session: Session,
    *,
    firm_id: uuid.UUID,
    client_id: uuid.UUID,
    period: str | None = None,
    as_of: date | None = None,
) -> TrialBalance:
    """Double-entry trial balance from posted entries.

    Each statement line posts twice - to its ledger and to the bank - so the
    debit and credit totals agree by construction. A test asserts exactly
    that; if they ever differ, a posting rule is broken.
    """
    chart = chart_by_code(session, firm_id)
    by_id = {account.id: account for account in chart.values()}

    query = select(JournalEntry).where(
        JournalEntry.firm_id == firm_id, JournalEntry.client_id == client_id
    )
    if period:
        query = query.where(JournalEntry.period == period)
    if as_of:
        query = query.where(JournalEntry.transaction_date <= as_of)
    entries = session.execute(query).scalars().all()

    debit: dict[str, Decimal] = {}
    credit: dict[str, Decimal] = {}
    unposted_count, unposted_amount = 0, Decimal("0")

    for entry in entries:
        account = by_id.get(entry.posted_ledger_id) if entry.posted_ledger_id else None
        if entry.status is not JournalStatus.APPROVED or account is None:
            unposted_count += 1
            unposted_amount += entry.amount
            continue
        if entry.direction is TransactionDirection.DEBIT:
            debit[account.code] = debit.get(account.code, Decimal("0")) + entry.amount
            credit[BANK_CODE] = credit.get(BANK_CODE, Decimal("0")) + entry.amount
        else:
            credit[account.code] = credit.get(account.code, Decimal("0")) + entry.amount
            debit[BANK_CODE] = debit.get(BANK_CODE, Decimal("0")) + entry.amount

    rows = [
        TrialBalanceRow(
            code=code,
            name=chart[code].name if code in chart else code,
            group=chart[code].group if code in chart else LedgerGroup.ASSET,
            debit=debit.get(code, Decimal("0")),
            credit=credit.get(code, Decimal("0")),
        )
        for code in sorted(set(debit) | set(credit))
    ]
    return TrialBalance(rows=rows, unposted_count=unposted_count, unposted_amount=unposted_amount)
