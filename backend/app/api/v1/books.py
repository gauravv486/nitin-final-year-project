"""Persisted bookkeeping - Module 4.

``ledger.py`` beside this file is the stateless classifier, usable with no
database. These endpoints are the same model applied to stored journal
entries: classify, review, import a statement, and read the trial balance.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.config import settings
from app.models.books import JournalEntry, LedgerAccount
from app.models.enums import JournalStatus, LedgerGroup
from app.models.practice import Client
from app.models.tenancy import User
from app.services import audit
from app.services import ledger as ledger_service

router = APIRouter(tags=["bookkeeping"])


# ------------------------------------------------------------- schemas ------


class AccountOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    group: LedgerGroup
    is_standard: bool
    is_active: bool


class LedgerRef(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class EntryOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    transaction_date: date
    narration: str
    counterparty: str | None
    reference: str | None
    amount: Decimal
    direction: str
    period: str
    status: JournalStatus
    suggested: LedgerRef | None
    confidence: float | None
    model_version: str | None
    alternatives: list[dict]
    posted: LedgerRef | None
    overridden: bool
    #: Approved by the classifier alone - confidence cleared the floor.
    auto_applied: bool
    reviewed_by: str | None
    reviewed_at: datetime | None


class EntryListOut(BaseModel):
    data: list[EntryOut]
    page: int
    page_size: int
    total: int
    total_pages: int
    #: Counts by status across the whole filtered set, not just this page.
    status_counts: dict[str, int]


class ClassifyIn(BaseModel):
    period: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    entry_ids: list[uuid.UUID] | None = Field(default=None, max_length=5000)
    reclassify: bool = Field(
        default=False,
        description=(
            "Re-run over entries that already have a suggestion. Entries a person "
            "has approved are never touched either way."
        ),
    )


class ClassifyOut(BaseModel):
    model_version: str
    threshold: float
    classified: int
    auto_applied: int
    queued_for_review: int
    unmapped: list[str]


class ReviewIn(BaseModel):
    ledger_code: str = Field(min_length=1, max_length=20)


class ImportOut(BaseModel):
    imported: int
    skipped: list[str]


class TrialBalanceRowOut(BaseModel):
    code: str
    name: str
    group: LedgerGroup
    debit: Decimal
    credit: Decimal
    balance: Decimal


class TrialBalanceOut(BaseModel):
    client_id: uuid.UUID
    period: str | None
    rows: list[TrialBalanceRowOut]
    total_debit: Decimal
    total_credit: Decimal
    balanced: bool
    unposted_count: int
    unposted_amount: Decimal


# ------------------------------------------------------------ helpers -------


def _entry_out(entry: JournalEntry, client_name: str, accounts: dict, reviewers: dict) -> EntryOut:
    def ref(ledger_id):
        account = accounts.get(ledger_id)
        return LedgerRef(id=account.id, code=account.code, name=account.name) if account else None

    return EntryOut(
        id=entry.id,
        client_id=entry.client_id,
        client_name=client_name,
        transaction_date=entry.transaction_date,
        narration=entry.narration,
        counterparty=entry.counterparty,
        reference=entry.reference,
        amount=entry.amount,
        direction=entry.direction.value,
        period=entry.period,
        status=entry.status,
        suggested=ref(entry.suggested_ledger_id),
        confidence=float(entry.confidence) if entry.confidence is not None else None,
        model_version=entry.model_version,
        alternatives=entry.alternatives or [],
        posted=ref(entry.posted_ledger_id),
        overridden=entry.overridden,
        auto_applied=entry.status is JournalStatus.APPROVED and entry.reviewed_by_id is None,
        reviewed_by=reviewers.get(entry.reviewed_by_id),
        reviewed_at=entry.reviewed_at,
    )


def _accounts(session, firm_id) -> dict:
    return {
        a.id: a
        for a in session.execute(
            select(LedgerAccount).where(LedgerAccount.firm_id == firm_id)
        ).scalars()
    }


# ------------------------------------------------------------ endpoints -----


@router.get("/ledger/accounts", response_model=list[AccountOut], summary="Firm chart of accounts")
def list_accounts(session: SessionDep, user: CurrentUserDep) -> list[AccountOut]:
    rows = session.execute(
        select(LedgerAccount)
        .where(LedgerAccount.firm_id == user.firm_id)
        .order_by(LedgerAccount.code)
    ).scalars()
    return [
        AccountOut(
            id=a.id,
            code=a.code,
            name=a.name,
            group=a.group,
            is_standard=a.is_standard,
            is_active=a.is_active,
        )
        for a in rows
    ]


@router.get("/entries", response_model=EntryListOut, summary="Journal entries")
def list_entries(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    entry_status: Annotated[JournalStatus | None, Query(alias="status")] = None,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    overridden: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> EntryListOut:
    conditions = [
        JournalEntry.firm_id == user.firm_id,
        JournalEntry.client_id.in_(visible_client_ids(user)),
    ]
    if client_id:
        conditions.append(JournalEntry.client_id == client_id)
    if period:
        conditions.append(JournalEntry.period == period)
    if overridden is not None:
        conditions.append(JournalEntry.overridden.is_(overridden))
    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(JournalEntry.narration.ilike(term), JournalEntry.counterparty.ilike(term))
        )

    counts = dict(
        session.execute(
            select(JournalEntry.status, func.count())
            .where(*conditions)
            .group_by(JournalEntry.status)
        ).all()
    )
    if entry_status:
        conditions.append(JournalEntry.status == entry_status)

    total = session.execute(
        select(func.count()).select_from(JournalEntry).where(*conditions)
    ).scalar_one()

    reviewer = aliased(User)
    rows = session.execute(
        select(JournalEntry, Client.name, reviewer)
        .join(Client, Client.id == JournalEntry.client_id)
        .outerjoin(reviewer, reviewer.id == JournalEntry.reviewed_by_id)
        .where(*conditions)
        # Lowest confidence first within the queue: the reviewer's time goes
        # where the model was least sure.
        .order_by(
            JournalEntry.transaction_date.desc(),
            JournalEntry.confidence.asc().nulls_first(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    accounts = _accounts(session, user.firm_id)
    reviewers = {r.id: r.full_name for _, _, r in rows if r is not None}
    return EntryListOut(
        data=[_entry_out(entry, name, accounts, reviewers) for entry, name, _ in rows],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=max(1, -(-total // page_size)),
        status_counts={s.value: int(counts.get(s, 0)) for s in JournalStatus},
    )


@router.post(
    "/clients/{client_id}/entries/classify",
    response_model=ClassifyOut,
    summary="Classify a client's entries and store the suggestions",
)
def classify_client_entries(
    client_id: uuid.UUID,
    payload: ClassifyIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> ClassifyOut:
    """Applies the firm's auto-apply floor. Above it, the entry is posted with
    no reviewer recorded; below it, it joins the review queue."""
    forbid_portal(user, "classify entries")
    authorise_client(session, user, client_id)
    outcome = ledger_service.classify_entries(
        session,
        firm_id=user.firm_id,
        client_id=client_id,
        period=payload.period,
        entry_ids=payload.entry_ids,
        reclassify=payload.reclassify,
    )
    audit.record(
        session,
        user,
        "ENTRIES_CLASSIFY",
        resource_type="client",
        resource_id=client_id,
        meta={
            "period": payload.period,
            "classified": outcome.classified,
            "auto_applied": outcome.auto_applied,
            "model_version": outcome.model_version,
        },
        request=request,
    )
    session.commit()
    return ClassifyOut(
        model_version=outcome.model_version,
        threshold=outcome.threshold,
        classified=outcome.classified,
        auto_applied=outcome.auto_applied,
        queued_for_review=outcome.queued_for_review,
        unmapped=outcome.unmapped,
    )


@router.post("/entries/{entry_id}/review", response_model=EntryOut, summary="Approve or correct")
def review(
    entry_id: uuid.UUID,
    payload: ReviewIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> EntryOut:
    """Post the entry to ``ledger_code``. Picking anything other than the
    suggestion is an override, and the corrected pair becomes training data."""
    forbid_portal(user, "post entries")
    entry = session.get(JournalEntry, entry_id)
    if entry is None or entry.firm_id != user.firm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such entry")
    client = authorise_client(session, user, entry.client_id)

    ledger_service.review_entry(
        session, entry=entry, reviewer_id=user.id, ledger_code=payload.ledger_code
    )
    audit.record(
        session,
        user,
        "ENTRY_REVIEW",
        resource_type="journal_entry",
        resource_id=entry.id,
        meta={"ledger_code": payload.ledger_code, "overridden": entry.overridden},
        request=request,
    )
    session.commit()
    session.refresh(entry)

    me = session.get(User, user.id)
    return _entry_out(
        entry,
        client.name,
        _accounts(session, user.firm_id),
        {user.id: me.full_name if me else user.email},
    )


@router.post(
    "/clients/{client_id}/entries/import",
    response_model=ImportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Import a bank statement (CSV or XLSX)",
)
async def import_entries(
    client_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    file: Annotated[UploadFile, File(description="Bank statement export")],
) -> ImportOut:
    """Headers are matched loosely - ``Withdrawal Amt.``, ``Debit`` and ``Dr``
    all work. Dates are read day-first. Imported rows are unclassified; call
    the classify endpoint next."""
    forbid_portal(user, "import statements")
    authorise_client(session, user, client_id)
    data = await file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Limit is {settings.MAX_UPLOAD_MB} MB")

    outcome = ledger_service.import_statement(
        session,
        firm_id=user.firm_id,
        client_id=client_id,
        data=data,
        filename=file.filename or "statement.csv",
    )
    audit.record(
        session,
        user,
        "STATEMENT_IMPORT",
        resource_type="client",
        resource_id=client_id,
        meta={"file": file.filename, "imported": outcome.imported, "skipped": len(outcome.skipped)},
        request=request,
    )
    session.commit()
    return ImportOut(imported=outcome.imported, skipped=outcome.skipped[:100])


@router.get(
    "/clients/{client_id}/trial-balance",
    response_model=TrialBalanceOut,
    summary="Trial balance from posted entries",
)
def get_trial_balance(
    client_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> TrialBalanceOut:
    authorise_client(session, user, client_id)
    tb = ledger_service.trial_balance(
        session, firm_id=user.firm_id, client_id=client_id, period=period
    )
    return TrialBalanceOut(
        client_id=client_id,
        period=period,
        rows=[
            TrialBalanceRowOut(
                code=r.code,
                name=r.name,
                group=r.group,
                debit=r.debit,
                credit=r.credit,
                balance=r.balance,
            )
            for r in tb.rows
        ],
        total_debit=tb.total_debit,
        total_credit=tb.total_credit,
        balanced=tb.total_debit == tb.total_credit,
        unposted_count=tb.unposted_count,
        unposted_amount=tb.unposted_amount,
    )
