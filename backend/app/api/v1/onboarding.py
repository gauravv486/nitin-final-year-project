"""Client onboarding - Module 2.

An onboarding is a draft client. It becomes a real ``Client`` only on
``complete``, which requires an approved engagement letter - a half-finished
intake must not appear in every list and calendar as a live engagement.

No government registry is queried: there is no public API this project can
call. What *can* be known from the identifiers is derived and labelled as
derived - the PAN inside a GSTIN, the state from its first two digits, the
entity type from the PAN's fourth character and the CIN's listing code.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUserDep, SessionDep, forbid_portal
from app.core.roles import at_least
from app.models.enums import ClientStatus, ConsentPurpose, EntityType, FirmRole
from app.models.practice import Client, ClientContact
from app.models.tenancy import ConsentRecord, Firm
from app.models.workflow import OnboardingRecord
from app.services import audit, drafting
from app.services import compliance as compliance_engine
from app.utils.identifiers import (
    gstin_checksum_ok,
    is_cin,
    is_gstin,
    is_pan,
    pan_from_gstin,
    state_name_from_gstin,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

#: The PAN's fourth character names the holder's status.
PAN_HOLDER = {
    "C": ("Company", EntityType.PRIVATE_LIMITED),
    "F": ("Firm or LLP", EntityType.PARTNERSHIP),
    "H": ("Hindu Undivided Family", EntityType.HUF),
    "P": ("Individual", EntityType.INDIVIDUAL),
    "T": ("Trust", EntityType.TRUST),
    "A": ("Association of Persons", None),
    "B": ("Body of Individuals", None),
    "L": ("Local authority", None),
    "J": ("Artificial juridical person", None),
    "G": ("Government", None),
}

REGISTRATIONS = ("GST", "TDS", "PF", "ESI", "PROFESSIONAL_TAX", "ROC", "MSME")


def derive_identity(legal_name: str, pan: str | None, gstin: str | None, cin: str | None) -> dict:
    derived: dict = {"source": "derived from identifiers - no registry lookup performed"}
    notes: list[str] = []
    if gstin:
        derived["pan_from_gstin"] = pan_from_gstin(gstin)
        derived["state"] = state_name_from_gstin(gstin)
        derived["gst_entity_number"] = gstin[12]
        if pan and derived["pan_from_gstin"] != pan:
            notes.append("PAN does not match the PAN embedded in the GSTIN")
    effective_pan = pan or derived.get("pan_from_gstin")
    entity: EntityType | None = None
    if effective_pan:
        holder, entity = PAN_HOLDER.get(effective_pan[3], ("Unknown", None))
        derived["pan_holder_type"] = holder
        if effective_pan[3] == "P" and gstin:
            # A proprietorship registers for GST under the proprietor's own PAN.
            entity = EntityType.PROPRIETORSHIP
    if cin:
        listing = cin[12:15]
        derived["cin_listing"] = {"PTC": "private company", "PLC": "public company", "OPC": "one person company"}.get(listing, listing)
        if listing == "PLC":
            entity = EntityType.PUBLIC_LIMITED
        elif listing in ("PTC", "OPC"):
            entity = EntityType.PRIVATE_LIMITED
    if entity is EntityType.PARTNERSHIP and legal_name.strip().upper().endswith("LLP"):
        entity = EntityType.LLP
    derived["entity_type"] = entity.value if entity else None
    derived["notes"] = notes
    return derived


class StartIn(BaseModel):
    legal_name: str = Field(min_length=2, max_length=255)
    trade_name: str | None = Field(default=None, max_length=255)
    pan: str | None = None
    gstin: str | None = None
    cin: str | None = None
    entity_type: EntityType | None = None

    @field_validator("pan", "gstin", "cin", mode="before")
    @classmethod
    def _upper(cls, value):
        return value.strip().upper() or None if isinstance(value, str) else value

    @field_validator("pan")
    @classmethod
    def _pan(cls, value):
        if value and not is_pan(value):
            raise ValueError("PAN must look like AAAAA9999A")
        return value

    @field_validator("gstin")
    @classmethod
    def _gstin(cls, value):
        if value and not (is_gstin(value) and gstin_checksum_ok(value)):
            raise ValueError("GSTIN is malformed or fails its check digit")
        return value

    @field_validator("cin")
    @classmethod
    def _cin(cls, value):
        if value and not is_cin(value):
            raise ValueError("CIN must be 21 characters, e.g. U74999MH2015PTC123456")
        return value


class Director(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    din: str | None = Field(default=None, pattern=r"^\d{8}$")
    designation: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    is_signatory: bool = True


class UpdateIn(BaseModel):
    trade_name: str | None = Field(default=None, max_length=255)
    entity_type: EntityType | None = None
    registrations: list[str] | None = None
    directors: list[Director] | None = Field(default=None, max_length=30)

    @field_validator("registrations")
    @classmethod
    def _known(cls, value):
        if value is not None:
            unknown = set(value) - set(REGISTRATIONS)
            if unknown:
                raise ValueError(f"Unknown registrations: {', '.join(sorted(unknown))}")
        return value


class LetterIn(BaseModel):
    services: list[str] | None = Field(default=None, max_length=20)
    fee_note: str | None = Field(default=None, max_length=500)


class CompleteIn(BaseModel):
    name: str | None = Field(default=None, max_length=255, description="Short name for lists")
    manager_id: uuid.UUID | None = None
    gst_frequency: str = Field(default="MONTHLY", pattern="^(MONTHLY|QUARTERLY)$")
    email: EmailStr | None = None
    consent_given_by: str = Field(min_length=2, max_length=255)


class OnboardingOut(BaseModel):
    id: uuid.UUID
    legal_name: str
    trade_name: str | None
    pan: str | None
    gstin: str | None
    cin: str | None
    entity_type: EntityType | None
    stage: str
    derived: dict
    registrations: list[str]
    directors: list[dict]
    engagement_letter_md: str | None
    letter_approved_at: datetime | None
    client_id: uuid.UUID | None
    completed_at: datetime | None
    steps: list[dict]
    created_at: datetime


def _steps(record: OnboardingRecord) -> list[dict]:
    payload = record.registry_payload or {}
    done = [
        bool(record.legal_name and (record.pan or record.gstin)),
        bool(payload.get("registrations_confirmed")),
        bool(record.directors),
        record.letter_approved_at is not None,
        record.completed_at is not None,
    ]
    steps = [
        ("identity", "Identity", "PAN and GSTIN validated, legal name confirmed"),
        ("registrations", "Registrations", "Which statutes apply - this drives the calendar"),
        ("signatories", "Signatories", "Directors, partners and authorised signatories"),
        ("letter", "Engagement letter", "Drafted from the firm template and approved"),
        ("complete", "Client created", "Client record, consent and compliance calendar"),
    ]
    first_open = next((i for i, d in enumerate(done) if not d), None)
    return [
        {"key": key, "title": title, "detail": detail,
         "status": "done" if done[i] else ("active" if i == first_open else "todo")}
        for i, (key, title, detail) in enumerate(steps)
    ]


def _out(record: OnboardingRecord) -> OnboardingOut:
    payload = record.registry_payload or {}
    return OnboardingOut(
        id=record.id,
        legal_name=record.legal_name,
        trade_name=record.trade_name,
        pan=record.pan,
        gstin=record.gstin,
        cin=record.cin,
        entity_type=record.entity_type,
        stage=record.stage,
        derived=payload.get("derived", {}),
        registrations=payload.get("registrations", []),
        directors=record.directors or [],
        engagement_letter_md=record.engagement_letter_md,
        letter_approved_at=record.letter_approved_at,
        client_id=record.client_id,
        completed_at=record.completed_at,
        steps=_steps(record),
        created_at=record.created_at,
    )


def _load(session, user, record_id) -> OnboardingRecord:
    record = session.get(OnboardingRecord, record_id)
    if record is None or record.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such onboarding")
    return record


@router.get("", response_model=list[OnboardingOut], summary="Onboardings")
def list_onboardings(session: SessionDep, user: CurrentUserDep) -> list[OnboardingOut]:
    forbid_portal(user, "see onboardings")
    rows = session.execute(
        select(OnboardingRecord)
        .where(OnboardingRecord.firm_id == user.firm_id)
        .order_by(OnboardingRecord.completed_at.is_not(None), OnboardingRecord.created_at.desc())
    ).scalars()
    return [_out(r) for r in rows]


@router.post("", response_model=OnboardingOut, status_code=status.HTTP_201_CREATED, summary="Start an onboarding")
def start(payload: StartIn, request: Request, session: SessionDep, user: CurrentUserDep) -> OnboardingOut:
    forbid_portal(user, "onboard clients")
    if not (payload.pan or payload.gstin):
        raise HTTPException(status_code=422, detail="A PAN or a GSTIN is needed to identify the client")
    derived = derive_identity(payload.legal_name, payload.pan, payload.gstin, payload.cin)
    record = OnboardingRecord(
        firm_id=user.firm_id,
        owner_id=user.id,
        stage="REGISTRY_REVIEW",
        legal_name=payload.legal_name.strip(),
        trade_name=payload.trade_name,
        pan=payload.pan or derived.get("pan_from_gstin"),
        gstin=payload.gstin,
        cin=payload.cin,
        entity_type=payload.entity_type or (EntityType(derived["entity_type"]) if derived.get("entity_type") else None),
        registry_payload={
            "derived": derived,
            "registrations": ["GST"] if payload.gstin else [],
            "registrations_confirmed": False,
        },
        directors=[],
    )
    session.add(record)
    session.flush()
    audit.record(session, user, "ONBOARDING_START", resource_type="onboarding", resource_id=record.id, request=request)
    session.commit()
    session.refresh(record)
    return _out(record)


@router.get("/{record_id}", response_model=OnboardingOut, summary="One onboarding")
def get_onboarding(record_id: uuid.UUID, session: SessionDep, user: CurrentUserDep) -> OnboardingOut:
    forbid_portal(user, "see onboardings")
    return _out(_load(session, user, record_id))


@router.patch("/{record_id}", response_model=OnboardingOut, summary="Update an onboarding")
def update(record_id: uuid.UUID, payload: UpdateIn, request: Request, session: SessionDep, user: CurrentUserDep):
    forbid_portal(user, "onboard clients")
    record = _load(session, user, record_id)
    if record.completed_at:
        raise HTTPException(status_code=409, detail="This onboarding is complete; edit the client instead")
    changes = payload.model_dump(exclude_unset=True)
    registry = dict(record.registry_payload or {})
    if "registrations" in changes:
        registry["registrations"] = changes.pop("registrations")
        registry["registrations_confirmed"] = True
    if "directors" in changes:
        record.directors = [d.model_dump(mode="json") for d in payload.directors or []]
        changes.pop("directors")
    for key, value in changes.items():
        setattr(record, key, value)
    record.registry_payload = registry
    if record.directors and registry.get("registrations_confirmed"):
        record.stage = "ENGAGEMENT_LETTER"
    audit.record(session, user, "ONBOARDING_UPDATE", resource_type="onboarding", resource_id=record.id, request=request)
    session.commit()
    session.refresh(record)
    return _out(record)


@router.post("/{record_id}/engagement-letter", summary="Draft the engagement letter")
def letter(record_id: uuid.UUID, payload: LetterIn, request: Request, session: SessionDep, user: CurrentUserDep) -> dict:
    forbid_portal(user, "draft letters")
    record = _load(session, user, record_id)
    firm = session.get(Firm, user.firm_id)
    draft = drafting.draft_engagement_letter(
        session,
        user_id=user.id,
        firm=firm,
        legal_name=record.legal_name,
        entity_type=record.entity_type.value.replace("_", " ").title() if record.entity_type else None,
        pan=record.pan,
        gstin=record.gstin,
        services=payload.services,
        fee_note=payload.fee_note,
    )
    record.engagement_letter_md = draft.text
    record.letter_approved_at = None
    record.stage = "ENGAGEMENT_LETTER"
    audit.record(
        session, user, "ENGAGEMENT_LETTER_DRAFT", resource_type="onboarding", resource_id=record.id,
        meta={"provider": draft.provider}, request=request,
    )
    session.commit()
    session.refresh(record)
    return {
        "onboarding": _out(record).model_dump(mode="json"),
        "provider": draft.provider,
        "model": draft.model,
        "fallback_reason": draft.fallback_reason,
    }


class LetterEditIn(BaseModel):
    engagement_letter_md: str = Field(min_length=20, max_length=50_000)


@router.put("/{record_id}/engagement-letter", response_model=OnboardingOut, summary="Edit the letter")
def edit_letter(record_id: uuid.UUID, payload: LetterEditIn, request: Request, session: SessionDep, user: CurrentUserDep):
    forbid_portal(user, "edit letters")
    record = _load(session, user, record_id)
    record.engagement_letter_md = payload.engagement_letter_md
    record.letter_approved_at = None
    audit.record(session, user, "ENGAGEMENT_LETTER_EDIT", resource_type="onboarding", resource_id=record.id, request=request)
    session.commit()
    session.refresh(record)
    return _out(record)


@router.post("/{record_id}/approve-letter", response_model=OnboardingOut, summary="Approve the letter")
def approve_letter(record_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    """Partners only. A generated engagement letter is a proposal, never a
    contract, until someone with authority to bind the firm accepts it."""
    if not at_least(user.role, FirmRole.PARTNER):
        raise HTTPException(status_code=403, detail="Partners approve engagement letters")
    record = _load(session, user, record_id)
    if not record.engagement_letter_md:
        raise HTTPException(status_code=409, detail="Draft the letter first")
    if "[TO CONFIRM" in record.engagement_letter_md:
        raise HTTPException(status_code=409, detail="The letter still has [TO CONFIRM] markers")
    record.letter_approved_at = datetime.now(UTC)
    record.stage = "PORTAL_INVITE"
    audit.record(session, user, "ENGAGEMENT_LETTER_APPROVE", resource_type="onboarding", resource_id=record.id, request=request)
    session.commit()
    session.refresh(record)
    return _out(record)


@router.post("/{record_id}/complete", summary="Create the client")
def complete(record_id: uuid.UUID, payload: CompleteIn, request: Request, session: SessionDep, user: CurrentUserDep) -> dict:
    """Creates the client, its signatories, a DPDP consent record, and the
    compliance tasks for the current month - in one transaction."""
    forbid_portal(user, "onboard clients")
    record = _load(session, user, record_id)
    if record.completed_at:
        raise HTTPException(status_code=409, detail="Already complete")
    if record.letter_approved_at is None:
        raise HTTPException(status_code=409, detail="The engagement letter must be approved first")

    derived = (record.registry_payload or {}).get("derived", {})
    client = Client(
        firm_id=user.firm_id,
        name=(payload.name or record.trade_name or record.legal_name)[:255],
        legal_name=record.legal_name,
        trade_name=record.trade_name,
        pan=record.pan,
        gstin=record.gstin,
        cin=record.cin,
        entity_type=record.entity_type or EntityType.PRIVATE_LIMITED,
        status=ClientStatus.ACTIVE,
        engaged_on=date.today(),
        manager_id=payload.manager_id or user.id,
        email=payload.email,
        state=derived.get("state"),
        gst_frequency=payload.gst_frequency,
    )
    session.add(client)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="A client with this PAN or GSTIN already exists") from exc

    for director in record.directors or []:
        session.add(
            ClientContact(
                client_id=client.id,
                name=director["name"],
                din=director.get("din"),
                designation=director.get("designation"),
                email=director.get("email"),
                is_signatory=director.get("is_signatory", True),
            )
        )
    session.add(
        ConsentRecord(
            firm_id=user.firm_id,
            client_id=client.id,
            purpose=ConsentPurpose.DATA_PROCESSING,
            granted_by=payload.consent_given_by,
            ip_address=request.client.host if request.client else None,
        )
    )
    record.client_id = client.id
    record.completed_at = datetime.now(UTC)
    record.stage = "COMPLETE"
    created = compliance_engine.generate_tasks(
        session, firm_id=user.firm_id, period=compliance_engine.current_month_period(), client_ids=[client.id]
    )
    audit.record(
        session, user, "ONBOARDING_COMPLETE", resource_type="client", resource_id=client.id,
        meta={"onboarding_id": record.id, "tasks_created": created}, request=request,
    )
    session.commit()
    return {"client_id": str(client.id), "tasks_created": created, "onboarding": _out(record).model_dump(mode="json")}
