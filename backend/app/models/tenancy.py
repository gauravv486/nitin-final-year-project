"""Firm, user, session and audit tables - the tenant boundary.

``firm_id`` on a table is not decoration: it is the column every query filters
on, and the one thing standing between one practice's client list and another's.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy import (
    Enum as SaEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UuidMixin
from app.models.enums import (
    AuditOutcome,
    ConsentPurpose,
    ConsentStatus,
    FirmRole,
    NotificationStatus,
    NotificationType,
    SubscriptionTier,
    UserStatus,
)

if TYPE_CHECKING:
    from app.models.practice import Client


class Firm(Base, UuidMixin, TimestampMixin, SoftDeleteMixin):
    """A chartered accountancy practice. Root of every tenant-scoped query."""

    __tablename__ = "firms"

    name: Mapped[str] = mapped_column(String(255))
    #: Firm Registration Number issued by ICAI.
    frn: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(6), nullable=True)
    tier: Mapped[SubscriptionTier] = mapped_column(
        SaEnum(SubscriptionTier, name="subscription_tier"),
        default=SubscriptionTier.STARTER,
    )

    settings: Mapped[FirmSettings | None] = relationship(
        back_populates="firm", uselist=False, cascade="all, delete-orphan"
    )
    users: Mapped[list[User]] = relationship(
        back_populates="firm",
        cascade="all, delete-orphan",
        foreign_keys="User.firm_id",
    )
    clients: Mapped[list[Client]] = relationship(
        back_populates="firm", cascade="all, delete-orphan"
    )


class FirmSettings(Base, UuidMixin, TimestampMixin):
    """Module 15. Split from ``Firm`` so branding blobs stay out of the hot path
    of every tenant lookup."""

    __tablename__ = "firm_settings"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), unique=True
    )

    #: ``{logo_url, accent_hex, letterhead_html}``
    branding: Mapped[dict] = mapped_column(JSONB, default=dict)
    #: ``{email_digest: bool, deadline_lead_days: [int], channels: [str]}``
    notification_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    #: ``{copilot_enabled: bool, drafting_enabled: bool}``
    ai_rules: Mapped[dict] = mapped_column(JSONB, default=dict)

    #: Per-firm override of ``settings.LEDGER_AUTO_APPLY_FLOOR``. A cautious
    #: firm raises it; nobody can set it to zero and auto-post everything.
    auto_apply_floor: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.90")
    )
    #: ``MM-DD``. Almost always 03-31 in India, but a few entities differ.
    financial_year_end: Mapped[str] = mapped_column(String(5), default="03-31")
    timezone: Mapped[str] = mapped_column(String(40), default="Asia/Kolkata")

    firm: Mapped[Firm] = relationship(back_populates="settings")


class User(Base, UuidMixin, TimestampMixin, SoftDeleteMixin):
    """A person who signs in.

    One firm per user. There is no firm switcher in the product, so a
    membership join table would be cost with no benefit.

    A ``CLIENT``-role user is narrowed further by ``client_id``: they see
    exactly one client's records through the portal.
    """

    __tablename__ = "users"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    #: ``use_alter`` breaks a genuine circular dependency: a portal user points
    #: at a client, and ``clients.manager_id`` points back at a user. Neither
    #: table can be created first, so without this the dependency sort has no
    #: solution - Alembic silently falls back to alphabetical order and the
    #: migration fails on the first forward reference. With it, the constraint
    #: is emitted as a separate ALTER once both tables exist.
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    role: Mapped[FirmRole] = mapped_column(
        SaEnum(FirmRole, name="firm_role"), default=FirmRole.STAFF
    )
    status: Mapped[UserStatus] = mapped_column(
        SaEnum(UserStatus, name="user_status"), default=UserStatus.ACTIVE
    )

    #: Display only. Never consulted for authorisation.
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)

    firm: Mapped[Firm] = relationship(back_populates="users", foreign_keys=[firm_id])
    client: Mapped[Client | None] = relationship(
        foreign_keys=[client_id], back_populates="portal_users"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_users_firm_role", "firm_id", "role"),)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class RefreshToken(Base, UuidMixin):
    """A rotating refresh token.

    The raw token never reaches the database - only its SHA-256 digest - so a
    dump of this table cannot be replayed. ``replaced_by_id`` chains rotations,
    which is what makes reuse detection possible: if a token that has already
    been rotated is presented again, the chain has leaked and the whole family
    should be revoked.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class AuditLog(Base, UuidMixin):
    """Module 14. Append-only.

    No update or delete path exists anywhere in the codebase; ``AuditService``
    is the only writer. That is what makes the table append-only in practice
    rather than merely in intention.
    """

    __tablename__ = "audit_logs"

    firm_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    #: ``VERB_NOUN``, e.g. ``CLIENT_CREATE``, ``DOCUMENT_DOWNLOAD``.
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    outcome: Mapped[AuditOutcome] = mapped_column(
        SaEnum(AuditOutcome, name="audit_outcome"), default=AuditOutcome.SUCCESS
    )
    #: Changed fields only. Never a whole row, and never a credential - see the
    #: redaction list in app/services/audit.py.
    meta: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_audit_logs_firm_created", "firm_id", "created_at"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )


class ConsentRecord(Base, UuidMixin):
    """Module 14. DPDP Act consent.

    Withdrawal sets ``withdrawn_at`` and flips the status; the row is never
    deleted, because the record of what was consented to and when *is* the
    compliance artifact.
    """

    __tablename__ = "consent_records"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )

    purpose: Mapped[ConsentPurpose] = mapped_column(
        SaEnum(ConsentPurpose, name="consent_purpose")
    )
    status: Mapped[ConsentStatus] = mapped_column(
        SaEnum(ConsentStatus, name="consent_status"), default=ConsentStatus.GRANTED
    )
    #: Name and capacity of the person who gave it.
    granted_by: Mapped[str] = mapped_column(String(255))
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Version of the privacy notice that was shown at the time.
    notice_version: Mapped[str] = mapped_column(String(10), default="1.0")
    evidence_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)


class Notification(Base, UuidMixin):
    __tablename__ = "notifications"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    type: Mapped[NotificationType] = mapped_column(
        SaEnum(NotificationType, name="notification_type"), default=NotificationType.SYSTEM
    )
    status: Mapped[NotificationStatus] = mapped_column(
        SaEnum(NotificationStatus, name="notification_status"),
        default=NotificationStatus.UNREAD,
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: In-app route this points at, e.g. ``/gst?client=...``.
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_notifications_user_status", "user_id", "status", "created_at"),
    )
