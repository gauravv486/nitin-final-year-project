"""MCA/ROC filings and board resolutions - Module 10."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request, status
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
from app.models.compliance import McaFiling
from app.models.enums import FilingStatus, McaFormType
from app.models.practice import Client, ClientContact
from app.models.tenancy import Firm
from app.services import audit, drafting
from app.services.resolutions import TEMPLATES

router = APIRouter(tags=["secretarial"])

FORM_PURPOSE = {
    McaFormType.AOC_4: "Financial statements",
    McaFormType.MGT_7: "Annual return",
    McaFormType.MGT_7A: "Annual return (small company / OPC)",
    McaFormType.ADT_1: "Auditor appointment",
    McaFormType.DIR_3_KYC: "Director KYC",
    McaFormType.DPT_3: "Return of deposits",
    McaFormType.INC_20A: "Commencement of business",
    McaFormType.MSME_1: "Outstanding MSME dues",
    McaFormType.PAS_3: "Return of allotment",
    McaFormType.OTHER: "Other e-form",
}

#: Forms charged Rs 100 for every day of delay, without a cap.
PER_DAY_FORMS = {McaFormType.AOC_4, McaFormType.MGT_7, McaFormType.MGT_7A}
#: Delay bands (days, multiple of the normal fee) for the remaining forms.
FEE_MULTIPLES = [(15, 1), (30, 2), (60, 4), (90, 6), (180, 10), (None, 12)]


def additional_fee(
    form: McaFormType, due: date, filed: date | None, normal_fee: Decimal | None
) -> tuple[int, Decimal | None, str]:
    """Estimated additional fee under the Companies (Registration Offices and
    Fees) Rules. An estimate: the MCA portal computes the authoritative
    figure, and the normal fee depends on share capital, which this record
    may not carry."""
    end = filed or date.today()
    days_late = max(0, (end - due).days)
    if days_late == 0:
        return 0, Decimal("0"), "On time"
    if form in PER_DAY_FORMS:
        return days_late, Decimal(100 * days_late), f"Rs 100 x {days_late} days"
    if form is McaFormType.DIR_3_KYC:
        return days_late, Decimal("5000"), "Flat Rs 5,000 for late DIR-3 KYC"
    if normal_fee is None:
        return days_late, None, "Normal fee not recorded - cannot compute the multiple"
    for limit, multiple in FEE_MULTIPLES:
        if limit is None or days_late <= limit:
            return days_late, normal_fee * multiple, f"{multiple}x normal fee ({days_late} days late)"
    return days_late, None, ""


class FilingIn(BaseModel):
    form_type: McaFormType
    financial_year: str = Field(pattern=r"^\d{4}-\d{2}$")
    due_date: date
    filing_fee: Decimal | None = Field(default=None, ge=0)
    meeting_date: date | None = None
    meeting_type: str | None = Field(default=None, max_length=30)


class FilingUpdateIn(BaseModel):
    status: FilingStatus | None = None
    srn: str | None = Field(default=None, max_length=20)
    submitted_on: date | None = None
    due_date: date | None = None
    filing_fee: Decimal | None = Field(default=None, ge=0)
    meeting_date: date | None = None
    meeting_type: str | None = Field(default=None, max_length=30)
    minutes_md: str | None = Field(default=None, max_length=50_000)


class FilingOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    cin: str | None
    form_type: McaFormType
    form_label: str
    purpose: str
    financial_year: str
    status: FilingStatus
    due_date: date
    submitted_on: date | None
    srn: str | None
    days_late: int
    additional_fee: Decimal | None
    fee_basis: str
    filing_fee: Decimal | None
    has_minutes: bool


class FilingDetailOut(FilingOut):
    meeting_date: date | None
    meeting_type: str | None
    resolution_md: str | None
    minutes_md: str | None


class MinutesIn(BaseModel):
    template_key: str
    values: dict[str, str] = Field(default_factory=dict)
    meeting_date: date | None = None
    meeting_time: str | None = Field(default=None, max_length=20)
    place: str | None = Field(default=None, max_length=255)
    chairperson: str | None = Field(default=None, max_length=255)
    directors_present: list[str] = Field(default_factory=list, max_length=30)
    filing_id: uuid.UUID | None = None


class MinutesOut(BaseModel):
    resolution: str
    minutes: str
    template: dict
    provider: str
    model: str | None
    fallback_reason: str | None


def _out(f: McaFiling, client: Client) -> dict:
    days_late, fee, basis = additional_fee(
        f.form_type, f.due_date, f.submitted_on if f.status is FilingStatus.FILED else None, f.filing_fee
    )
    return {
        "id": f.id,
        "client_id": f.client_id,
        "client_name": client.name,
        "cin": client.cin,
        "form_type": f.form_type,
        "form_label": f.form_type.value.replace("_", "-").replace("DIR-3-KYC", "DIR-3 KYC"),
        "purpose": FORM_PURPOSE[f.form_type],
        "financial_year": f.financial_year,
        "status": f.status,
        "due_date": f.due_date,
        "submitted_on": f.submitted_on,
        "srn": f.srn,
        "days_late": days_late,
        "additional_fee": f.additional_fee if f.additional_fee is not None else fee,
        "fee_basis": basis,
        "filing_fee": f.filing_fee,
        "has_minutes": bool(f.minutes_md),
    }


def _detail(f: McaFiling, client: Client) -> FilingDetailOut:
    return FilingDetailOut(
        **_out(f, client),
        meeting_date=f.meeting_date,
        meeting_type=f.meeting_type,
        resolution_md=f.resolution_md,
        minutes_md=f.minutes_md,
    )


def _load(session, user, filing_id) -> tuple[McaFiling, Client]:
    filing = session.get(McaFiling, filing_id)
    if filing is None or filing.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such filing")
    return filing, authorise_client(session, user, filing.client_id)


@router.get("/mca/filings", response_model=list[FilingOut], summary="ROC filings")
def list_filings(session: SessionDep, user: CurrentUserDep, client_id: uuid.UUID | None = None) -> list[FilingOut]:
    conditions = [McaFiling.firm_id == user.firm_id, McaFiling.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(McaFiling.client_id == client_id)
    rows = session.execute(
        select(McaFiling, Client).join(Client, Client.id == McaFiling.client_id).where(*conditions).order_by(McaFiling.due_date)
    ).all()
    return [FilingOut(**_out(f, c)) for f, c in rows]


@router.post(
    "/clients/{client_id}/mca/filings",
    response_model=FilingDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a filing",
)
def create_filing(client_id: uuid.UUID, payload: FilingIn, request: Request, session: SessionDep, user: CurrentUserDep):
    forbid_portal(user, "manage filings")
    client = authorise_client(session, user, client_id)
    filing = McaFiling(firm_id=user.firm_id, client_id=client_id, status=FilingStatus.PENDING, **payload.model_dump())
    session.add(filing)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="This form already exists for that financial year") from exc
    audit.record(session, user, "MCA_FILING_CREATE", resource_type="mca_filing", resource_id=filing.id, request=request)
    session.commit()
    session.refresh(filing)
    return _detail(filing, client)


@router.get("/mca/filings/{filing_id}", response_model=FilingDetailOut, summary="One filing")
def get_filing(filing_id: uuid.UUID, session: SessionDep, user: CurrentUserDep):
    filing, client = _load(session, user, filing_id)
    return _detail(filing, client)


@router.patch("/mca/filings/{filing_id}", response_model=FilingDetailOut, summary="Update a filing")
def update_filing(
    filing_id: uuid.UUID, payload: FilingUpdateIn, request: Request, session: SessionDep, user: CurrentUserDep
):
    forbid_portal(user, "manage filings")
    filing, client = _load(session, user, filing_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") is FilingStatus.FILED and not (changes.get("srn") or filing.srn):
        raise HTTPException(status_code=422, detail="An SRN is required to mark a form filed")
    if changes.get("status") is FilingStatus.FILED and not (changes.get("submitted_on") or filing.submitted_on):
        changes["submitted_on"] = date.today()
    for key, value in changes.items():
        setattr(filing, key, value)
    if filing.status is FilingStatus.FILED and filing.submitted_on:
        _, fee, _ = additional_fee(filing.form_type, filing.due_date, filing.submitted_on, filing.filing_fee)
        filing.additional_fee = fee
    audit.record(
        session, user, "MCA_FILING_UPDATE", resource_type="mca_filing", resource_id=filing.id,
        meta={"fields": sorted(changes)}, request=request,
    )
    session.commit()
    session.refresh(filing)
    return _detail(filing, client)


@router.get("/mca/resolution-templates", summary="Board resolution templates")
def list_templates() -> list[dict]:
    return [
        {
            "key": t.key,
            "title": t.title,
            "provision": t.provision,
            "follow_up": t.follow_up,
            "placeholders": list(t.placeholders),
        }
        for t in TEMPLATES.values()
    ]


@router.post("/clients/{client_id}/board-minutes", response_model=MinutesOut, summary="Draft a resolution and minutes")
def draft_minutes(client_id: uuid.UUID, payload: MinutesIn, request: Request, session: SessionDep, user: CurrentUserDep):
    """The resolution is rendered verbatim from the template; the model only
    drafts the minutes around it. Directors default to the client's contacts
    who hold a DIN."""
    forbid_portal(user, "draft minutes")
    client = authorise_client(session, user, client_id)
    template = TEMPLATES.get(payload.template_key)
    if template is None:
        raise HTTPException(status_code=404, detail="No such template")

    directors = payload.directors_present or [
        f"{c.name} (DIN {c.din})"
        for c in session.execute(
            select(ClientContact).where(ClientContact.client_id == client_id, ClientContact.din.is_not(None))
        ).scalars()
    ]
    firm = session.get(Firm, user.firm_id)
    draft, resolution = drafting.draft_board_minutes(
        session,
        user_id=user.id,
        firm=firm,
        client=client,
        template=template,
        values=payload.values,
        meeting_date=payload.meeting_date,
        meeting_time=payload.meeting_time,
        place=payload.place,
        chairperson=payload.chairperson,
        directors_present=directors,
    )
    if payload.filing_id:
        filing, _ = _load(session, user, payload.filing_id)
        if filing.client_id != client_id:
            raise HTTPException(status_code=422, detail="That filing belongs to another client")
        filing.resolution_md = resolution
        filing.minutes_md = draft.text
        filing.meeting_date = payload.meeting_date or filing.meeting_date
        filing.meeting_type = filing.meeting_type or "BOARD"
    audit.record(
        session, user, "MINUTES_DRAFT", resource_type="client", resource_id=client_id,
        meta={"template": template.key, "provider": draft.provider}, request=request,
    )
    session.commit()
    return MinutesOut(
        resolution=resolution,
        minutes=draft.text,
        template={"key": template.key, "title": template.title, "provision": template.provision, "follow_up": template.follow_up},
        provider=draft.provider,
        model=draft.model,
        fallback_reason=draft.fallback_reason,
    )
