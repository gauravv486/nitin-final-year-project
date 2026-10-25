"""Tax notices and replies - Module 7."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.roles import at_least
from app.models.compliance import TaxNotice
from app.models.enums import DocumentKind, FirmRole, NoticeAuthority, NoticeStatus
from app.models.practice import Client, Document
from app.models.tenancy import Firm
from app.services import audit, drafting
from app.services.documents import effective_fields
from app.utils.tabular import parse_amount, parse_date

router = APIRouter(tags=["notices"])

#: The four stages the frontend shows, from the six statuses the model keeps.
STAGE = {
    NoticeStatus.RECEIVED: "parsed",
    NoticeStatus.UNDER_REVIEW: "parsed",
    NoticeStatus.RESPONSE_DRAFTED: "drafting",
    NoticeStatus.RESPONSE_FILED: "filed",
    NoticeStatus.HEARING_SCHEDULED: "filed",
    NoticeStatus.CLOSED: "closed",
}


class CitedCase(BaseModel):
    citation: str = Field(min_length=3, max_length=255)
    court: str | None = Field(default=None, max_length=60)
    year: int | None = None
    note: str | None = Field(default=None, max_length=500)


class NoticeCreateIn(BaseModel):
    notice_number: str = Field(min_length=3, max_length=100)
    authority: NoticeAuthority
    section_code: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=500)
    issued_on: date | None = None
    received_on: date | None = None
    due_date: date
    demand_amount: Decimal | None = Field(default=None, ge=0)


class FromDocumentIn(BaseModel):
    document_id: uuid.UUID


class NoticeUpdateIn(BaseModel):
    status: NoticeStatus | None = None
    section_code: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=500)
    due_date: date | None = None
    hearing_on: date | None = None
    filed_on: date | None = None
    demand_amount: Decimal | None = Field(default=None, ge=0)
    owner_id: uuid.UUID | None = None
    draft_response: str | None = Field(default=None, max_length=50_000)
    cited_cases: list[CitedCase] | None = Field(default=None, max_length=20)


class DraftIn(BaseModel):
    instructions: str | None = Field(default=None, max_length=4000)


class NoticeOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    notice_number: str
    authority: NoticeAuthority
    section_code: str | None
    subject: str | None
    issued_on: date | None
    received_on: date | None
    due_date: date
    days_left: int
    demand_amount: Decimal | None
    status: NoticeStatus
    stage: str
    has_draft: bool
    draft_approved: bool
    document_id: uuid.UUID | None
    filed_on: date | None
    hearing_on: date | None


class NoticeDetailOut(NoticeOut):
    draft_response: str | None
    draft_model: str | None
    response_approved_at: datetime | None
    cited_cases: list[dict]
    extracted_text: str | None


class DraftOut(BaseModel):
    notice: NoticeDetailOut
    provider: str
    model: str | None
    fallback_reason: str | None
    interaction_id: uuid.UUID | None


def _out(notice: TaxNotice, client_name: str) -> dict:
    return {
        "id": notice.id,
        "client_id": notice.client_id,
        "client_name": client_name,
        "notice_number": notice.notice_number,
        "authority": notice.authority,
        "section_code": notice.section_code,
        "subject": notice.subject,
        "issued_on": notice.issued_on,
        "received_on": notice.received_on,
        "due_date": notice.due_date,
        "days_left": (notice.due_date - date.today()).days,
        "demand_amount": notice.demand_amount,
        "status": notice.status,
        "stage": STAGE[notice.status],
        "has_draft": bool(notice.draft_response),
        "draft_approved": notice.response_approved_at is not None,
        "document_id": notice.document_id,
        "filed_on": notice.filed_on,
        "hearing_on": notice.hearing_on,
    }


def _detail(notice: TaxNotice, client_name: str) -> NoticeDetailOut:
    return NoticeDetailOut(
        **_out(notice, client_name),
        draft_response=notice.draft_response,
        draft_model=notice.draft_model,
        response_approved_at=notice.response_approved_at,
        cited_cases=notice.cited_cases or [],
        extracted_text=(notice.extracted_text or "")[:8000] or None,
    )


def _load(session, user, notice_id: uuid.UUID) -> tuple[TaxNotice, Client]:
    notice = session.get(TaxNotice, notice_id)
    if notice is None or notice.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such notice")
    return notice, authorise_client(session, user, notice.client_id)


def _commit_unique(session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="A notice with this number already exists in your firm"
        ) from exc


@router.get("/notices", response_model=list[NoticeOut], summary="Notices")
def list_notices(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    notice_status: Annotated[NoticeStatus | None, Query(alias="status")] = None,
    open_only: bool = False,
) -> list[NoticeOut]:
    conditions = [TaxNotice.firm_id == user.firm_id, TaxNotice.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(TaxNotice.client_id == client_id)
    if notice_status:
        conditions.append(TaxNotice.status == notice_status)
    if open_only:
        conditions.append(TaxNotice.status != NoticeStatus.CLOSED)
    rows = session.execute(
        select(TaxNotice, Client.name)
        .join(Client, Client.id == TaxNotice.client_id)
        .where(*conditions)
        .order_by(TaxNotice.due_date)
    ).all()
    return [NoticeOut(**_out(n, name)) for n, name in rows]


@router.post(
    "/clients/{client_id}/notices",
    response_model=NoticeDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record a notice",
)
def create_notice(
    client_id: uuid.UUID, payload: NoticeCreateIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> NoticeDetailOut:
    forbid_portal(user, "record notices")
    client = authorise_client(session, user, client_id)
    notice = TaxNotice(firm_id=user.firm_id, client_id=client_id, owner_id=user.id, **payload.model_dump())
    session.add(notice)
    session.flush()
    audit.record(session, user, "NOTICE_CREATE", resource_type="tax_notice", resource_id=notice.id, request=request)
    _commit_unique(session)
    session.refresh(notice)
    return _detail(notice, client.name)


@router.post(
    "/clients/{client_id}/notices/from-document",
    response_model=NoticeDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record a notice from an uploaded, extracted notice document",
)
def create_from_document(
    client_id: uuid.UUID, payload: FromDocumentIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> NoticeDetailOut:
    forbid_portal(user, "record notices")
    client = authorise_client(session, user, client_id)
    document = session.get(Document, payload.document_id)
    if document is None or document.client_id != client_id or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="No such document for this client")
    if document.kind is not DocumentKind.NOTICE:
        raise HTTPException(status_code=422, detail="That document is not a notice")

    fields = effective_fields(document.extraction)
    due = parse_date(fields.get("due_date"))
    number = fields.get("notice_number")
    if due is None or not number:
        missing = [n for n, v in (("due date", due), ("notice number", number)) if not v]
        raise HTTPException(
            status_code=422,
            detail=(
                f"The extraction has no {' or '.join(missing)}. Correct it on the document first - "
                "a notice without a reply date cannot be tracked."
            ),
        )
    try:
        authority = NoticeAuthority(fields.get("authority") or "OTHER")
    except ValueError:
        authority = NoticeAuthority.OTHER

    notice = TaxNotice(
        firm_id=user.firm_id,
        client_id=client_id,
        document_id=document.id,
        owner_id=user.id,
        notice_number=str(number)[:100],
        authority=authority,
        section_code=(fields.get("section_code") or None),
        subject=(fields.get("subject") or None),
        issued_on=parse_date(fields.get("issued_on")),
        received_on=date.today(),
        due_date=due,
        demand_amount=parse_amount(fields.get("demand_amount")),
        extracted_text=document.extraction.raw_text if document.extraction else None,
    )
    session.add(notice)
    session.flush()
    audit.record(
        session,
        user,
        "NOTICE_CREATE",
        resource_type="tax_notice",
        resource_id=notice.id,
        meta={"from_document": document.id},
        request=request,
    )
    _commit_unique(session)
    session.refresh(notice)
    return _detail(notice, client.name)


@router.get("/notices/{notice_id}", response_model=NoticeDetailOut, summary="One notice")
def get_notice(notice_id: uuid.UUID, session: SessionDep, user: CurrentUserDep) -> NoticeDetailOut:
    notice, client = _load(session, user, notice_id)
    return _detail(notice, client.name)


@router.patch("/notices/{notice_id}", response_model=NoticeDetailOut, summary="Update a notice")
def update_notice(
    notice_id: uuid.UUID, payload: NoticeUpdateIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> NoticeDetailOut:
    forbid_portal(user, "edit notices")
    notice, client = _load(session, user, notice_id)
    changes = payload.model_dump(exclude_unset=True)

    if "draft_response" in changes and changes["draft_response"] != notice.draft_response:
        # Editing an approved draft un-approves it: what was approved is no
        # longer what would be filed.
        notice.response_approved_at = None
        if not notice.draft_model:
            notice.draft_model = "manual"
        elif not notice.draft_model.endswith("+edited"):
            notice.draft_model = f"{notice.draft_model[:70]} +edited"
    if changes.get("status") is NoticeStatus.RESPONSE_FILED and notice.response_approved_at is None:
        raise HTTPException(
            status_code=409,
            detail="The reply has not been approved. A draft has no standing until a person approves it.",
        )
    if "cited_cases" in changes:
        changes["cited_cases"] = [c.model_dump() for c in payload.cited_cases or []]
    if changes.get("status") is NoticeStatus.RESPONSE_FILED and not changes.get("filed_on"):
        changes["filed_on"] = date.today()

    for key, value in changes.items():
        setattr(notice, key, value)
    audit.record(
        session,
        user,
        "NOTICE_UPDATE",
        resource_type="tax_notice",
        resource_id=notice.id,
        meta={"fields": sorted(changes)},
        request=request,
    )
    session.commit()
    session.refresh(notice)
    return _detail(notice, client.name)


@router.post("/notices/{notice_id}/draft", response_model=DraftOut, summary="Draft a reply")
def draft_reply(
    notice_id: uuid.UUID, payload: DraftIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> DraftOut:
    """Drafted from the notice record only. Cites only cases a person has
    added to ``cited_cases``. Replaces any previous unapproved draft."""
    forbid_portal(user, "draft replies")
    notice, client = _load(session, user, notice_id)
    firm = session.get(Firm, user.firm_id)
    draft = drafting.draft_notice_reply(
        session, user_id=user.id, firm=firm, client=client, notice=notice, instructions=payload.instructions
    )
    notice.draft_response = draft.text
    notice.draft_model = draft.model or draft.provider
    notice.response_approved_at = None
    if notice.status in (NoticeStatus.RECEIVED, NoticeStatus.UNDER_REVIEW):
        notice.status = NoticeStatus.RESPONSE_DRAFTED
    audit.record(
        session,
        user,
        "NOTICE_DRAFT",
        resource_type="tax_notice",
        resource_id=notice.id,
        meta={"provider": draft.provider, "model": draft.model},
        request=request,
    )
    session.commit()
    session.refresh(notice)
    return DraftOut(
        notice=_detail(notice, client.name),
        provider=draft.provider,
        model=draft.model,
        fallback_reason=draft.fallback_reason,
        interaction_id=draft.interaction_id,
    )


@router.post("/notices/{notice_id}/approve", response_model=NoticeDetailOut, summary="Approve the reply")
def approve_reply(
    notice_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep
) -> NoticeDetailOut:
    """Managers and above. Approval is of the exact text currently stored;
    any later edit clears it."""
    if not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above approve replies")
    notice, client = _load(session, user, notice_id)
    if not notice.draft_response:
        raise HTTPException(status_code=409, detail="There is no draft to approve")
    if "[TO CONFIRM" in notice.draft_response:
        raise HTTPException(
            status_code=409,
            detail="The draft still contains [TO CONFIRM] markers. Fill them in before approving.",
        )
    notice.response_approved_at = datetime.now(UTC)
    audit.record(session, user, "NOTICE_APPROVE", resource_type="tax_notice", resource_id=notice.id, request=request)
    session.commit()
    session.refresh(notice)
    return _detail(notice, client.name)
