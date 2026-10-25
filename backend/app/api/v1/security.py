"""Members, audit trail, consent, and firm settings - Modules 14 and 15."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.roles import at_least, ui_role
from app.models.enums import ConsentPurpose, ConsentStatus, FirmRole, UserStatus
from app.models.practice import Client
from app.models.tenancy import AuditLog, ConsentRecord, Firm, FirmSettings, User
from app.services import audit

router = APIRouter(tags=["security"])


# --------------------------------------------------------------- members ----


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: FirmRole
    ui_role: str
    status: UserStatus
    client_id: uuid.UUID | None
    last_login_at: datetime | None
    mfa_enabled: bool


class MemberUpdateIn(BaseModel):
    role: FirmRole | None = None
    status: UserStatus | None = None


@router.get("/security/members", response_model=list[MemberOut], summary="Firm members")
def members(session: SessionDep, user: CurrentUserDep) -> list[MemberOut]:
    forbid_portal(user, "list members")
    rows = session.execute(
        select(User).where(User.firm_id == user.firm_id, User.deleted_at.is_(None)).order_by(User.role, User.first_name)
    ).scalars()
    return [
        MemberOut(
            id=u.id, name=u.full_name, email=u.email, role=u.role, ui_role=ui_role(u.role),
            status=u.status, client_id=u.client_id, last_login_at=u.last_login_at, mfa_enabled=u.mfa_enabled,
        )
        for u in rows
    ]


@router.patch("/security/members/{member_id}", response_model=MemberOut, summary="Change role or suspend")
def update_member(member_id: uuid.UUID, payload: MemberUpdateIn, request: Request, session: SessionDep, user: CurrentUserDep):
    """Partners and owners. Nobody may change their own role or suspend
    themselves - that is how a firm ends up with no owner."""
    if not at_least(user.role, FirmRole.PARTNER):
        raise HTTPException(status_code=403, detail="Partners and owners manage members")
    member = session.get(User, member_id)
    if member is None or member.firm_id != user.firm_id or member.deleted_at is not None:
        raise HTTPException(status_code=404, detail="No such member")
    if member.id == user.id:
        raise HTTPException(status_code=409, detail="You cannot change your own role or status")
    if payload.role is FirmRole.OWNER and user.role is not FirmRole.OWNER:
        raise HTTPException(status_code=403, detail="Only an owner can appoint another owner")
    if member.role is FirmRole.OWNER and user.role is not FirmRole.OWNER:
        raise HTTPException(status_code=403, detail="Only an owner can change an owner")
    if payload.role is FirmRole.CLIENT or (member.role is FirmRole.CLIENT and payload.role):
        raise HTTPException(status_code=422, detail="Portal access is granted by invitation, not by role change")

    before = {"role": member.role, "status": member.status}
    if payload.role:
        member.role = payload.role
    if payload.status:
        member.status = payload.status
    audit.record(
        session, user, "MEMBER_UPDATE", resource_type="user", resource_id=member.id,
        meta={"before": before, "after": {"role": member.role, "status": member.status}}, request=request,
    )
    session.commit()
    return MemberOut(
        id=member.id, name=member.full_name, email=member.email, role=member.role, ui_role=ui_role(member.role),
        status=member.status, client_id=member.client_id, last_login_at=member.last_login_at, mfa_enabled=member.mfa_enabled,
    )


# ------------------------------------------------------------- audit log ----


class AuditOut(BaseModel):
    id: uuid.UUID
    at: datetime
    actor: str
    action: str
    resource_type: str | None
    resource_id: str | None
    outcome: str
    meta: dict
    ip_address: str | None


class AuditPageOut(BaseModel):
    data: list[AuditOut]
    page: int
    page_size: int
    total: int


@router.get("/security/audit-log", response_model=AuditPageOut, summary="Audit trail")
def audit_log(
    session: SessionDep,
    user: CurrentUserDep,
    action: Annotated[str | None, Query(max_length=80)] = None,
    actor_id: uuid.UUID | None = None,
    since: date | None = None,
    until: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditPageOut:
    """Managers and above. Read-only - there is no endpoint that edits it."""
    if not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above read the audit log")
    conditions = [AuditLog.firm_id == user.firm_id]
    if action:
        conditions.append(AuditLog.action == action)
    if actor_id:
        conditions.append(AuditLog.user_id == actor_id)
    if since:
        conditions.append(AuditLog.created_at >= datetime.combine(since, datetime.min.time(), UTC))
    if until:
        conditions.append(AuditLog.created_at < datetime.combine(until, datetime.max.time(), UTC))
    total = session.execute(select(func.count()).select_from(AuditLog).where(*conditions)).scalar_one()
    rows = session.execute(
        select(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .where(*conditions)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return AuditPageOut(
        data=[
            AuditOut(
                id=a.id, at=a.created_at, actor=u.full_name if u else "System", action=a.action,
                resource_type=a.resource_type, resource_id=a.resource_id, outcome=a.outcome.value,
                meta=a.meta or {}, ip_address=a.ip_address,
            )
            for a, u in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


# --------------------------------------------------------------- consent ----


class ConsentIn(BaseModel):
    purpose: ConsentPurpose
    granted_by: str = Field(min_length=2, max_length=255)
    notice_version: str = Field(default="1.0", max_length=10)


class ConsentOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    purpose: ConsentPurpose
    status: ConsentStatus
    granted_by: str
    granted_at: datetime
    withdrawn_at: datetime | None
    notice_version: str


def _consent_out(c: ConsentRecord, name: str) -> ConsentOut:
    return ConsentOut(
        id=c.id, client_id=c.client_id, client_name=name, purpose=c.purpose, status=c.status,
        granted_by=c.granted_by, granted_at=c.granted_at, withdrawn_at=c.withdrawn_at, notice_version=c.notice_version,
    )


@router.get("/security/consents", response_model=list[ConsentOut], summary="DPDP consent records")
def consents(session: SessionDep, user: CurrentUserDep, client_id: uuid.UUID | None = None) -> list[ConsentOut]:
    conditions = [ConsentRecord.firm_id == user.firm_id, ConsentRecord.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(ConsentRecord.client_id == client_id)
    rows = session.execute(
        select(ConsentRecord, Client.name).join(Client, Client.id == ConsentRecord.client_id)
        .where(*conditions).order_by(ConsentRecord.granted_at.desc())
    ).all()
    return [_consent_out(c, n) for c, n in rows]


@router.post("/clients/{client_id}/consents", response_model=ConsentOut, status_code=status.HTTP_201_CREATED)
def grant_consent(client_id: uuid.UUID, payload: ConsentIn, request: Request, session: SessionDep, user: CurrentUserDep):
    client = authorise_client(session, user, client_id)
    record = ConsentRecord(
        firm_id=user.firm_id, client_id=client_id, purpose=payload.purpose, granted_by=payload.granted_by,
        notice_version=payload.notice_version, ip_address=request.client.host if request.client else None,
    )
    session.add(record)
    session.flush()
    audit.record(session, user, "CONSENT_GRANT", resource_type="consent", resource_id=record.id,
                 meta={"purpose": payload.purpose}, request=request)
    session.commit()
    session.refresh(record)
    return _consent_out(record, client.name)


@router.post("/consents/{consent_id}/withdraw", response_model=ConsentOut, summary="Withdraw consent")
def withdraw(consent_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    """The row is kept and marked withdrawn - the record of what was
    consented to, and when it stopped, is itself the compliance artifact."""
    record = session.get(ConsentRecord, consent_id)
    if record is None or record.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such consent")
    client = authorise_client(session, user, record.client_id)
    if record.status is ConsentStatus.WITHDRAWN:
        raise HTTPException(status_code=409, detail="Already withdrawn")
    record.status = ConsentStatus.WITHDRAWN
    record.withdrawn_at = datetime.now(UTC)
    audit.record(session, user, "CONSENT_WITHDRAW", resource_type="consent", resource_id=record.id, request=request)
    session.commit()
    return _consent_out(record, client.name)


# -------------------------------------------------------------- settings ----


class SettingsOut(BaseModel):
    firm_name: str
    frn: str | None
    pan: str | None
    gstin: str | None
    email: str
    phone: str | None
    address_line1: str | None
    city: str | None
    state: str | None
    pincode: str | None
    tier: str
    auto_apply_floor: float
    financial_year_end: str
    timezone: str
    ai_rules: dict
    notification_rules: dict


class SettingsIn(BaseModel):
    firm_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, pattern=r"^[1-9]\d{5}$")
    #: Floor of 0.5: below that the "auto" in auto-apply means "unreviewed".
    auto_apply_floor: Decimal | None = Field(default=None, ge=Decimal("0.5"), le=Decimal("1"))
    ai_rules: dict | None = None
    notification_rules: dict | None = None


def _settings_out(firm: Firm, s: FirmSettings) -> SettingsOut:
    return SettingsOut(
        firm_name=firm.name, frn=firm.frn, pan=firm.pan, gstin=firm.gstin, email=firm.email, phone=firm.phone,
        address_line1=firm.address_line1, city=firm.city, state=firm.state, pincode=firm.pincode,
        tier=firm.tier.value, auto_apply_floor=float(s.auto_apply_floor), financial_year_end=s.financial_year_end,
        timezone=s.timezone, ai_rules=s.ai_rules or {}, notification_rules=s.notification_rules or {},
    )


def _firm_settings(session, firm_id) -> tuple[Firm, FirmSettings]:
    firm = session.get(Firm, firm_id)
    settings_row = session.execute(select(FirmSettings).where(FirmSettings.firm_id == firm_id)).scalar_one_or_none()
    if settings_row is None:
        settings_row = FirmSettings(firm_id=firm_id)
        session.add(settings_row)
        session.flush()
    return firm, settings_row


@router.get("/settings", response_model=SettingsOut, summary="Firm settings")
def get_settings(session: SessionDep, user: CurrentUserDep) -> SettingsOut:
    forbid_portal(user, "see firm settings")
    firm, s = _firm_settings(session, user.firm_id)
    session.commit()
    return _settings_out(firm, s)


@router.patch("/settings", response_model=SettingsOut, summary="Update firm settings")
def update_settings(payload: SettingsIn, request: Request, session: SessionDep, user: CurrentUserDep) -> SettingsOut:
    if not at_least(user.role, FirmRole.PARTNER):
        raise HTTPException(status_code=403, detail="Partners and owners change firm settings")
    firm, s = _firm_settings(session, user.firm_id)
    changes = payload.model_dump(exclude_unset=True)
    for key in ("email", "phone", "address_line1", "city", "state", "pincode"):
        if key in changes:
            setattr(firm, key, changes[key])
    if "firm_name" in changes:
        firm.name = changes["firm_name"]
    for key in ("auto_apply_floor", "ai_rules", "notification_rules"):
        if key in changes:
            setattr(s, key, changes[key])
    audit.record(session, user, "SETTINGS_UPDATE", resource_type="firm", resource_id=firm.id,
                 meta={"fields": sorted(changes)}, request=request)
    session.commit()
    return _settings_out(firm, s)
