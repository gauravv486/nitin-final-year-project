"""Onboarding, client collaboration and report exports - Modules 2, 13, 16."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
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

from app.models.base import Base, TimestampMixin, UuidMixin
from app.models.enums import (
    ApprovalStatus,
    EntityType,
    MessageAuthorKind,
    ReportFormat,
    ReportStatus,
    ThreadChannel,
    ThreadStatus,
)

if TYPE_CHECKING:
    from app.models.tenancy import User


class OnboardingRecord(Base, UuidMixin, TimestampMixin):
    """Module 2. The intake wizard's state.

    Separate from ``Client`` because an onboarding can be abandoned halfway,
    and a half-finished client row would then show up in every list, count and
    compliance calendar as though it were a live engagement.
    """

    __tablename__ = "onboarding_records"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    #: Set at the moment the wizard completes and a real Client is created.
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    #: ``IDENTIFICATION`` | ``REGISTRY_REVIEW`` | ``ENGAGEMENT_LETTER``
    #: | ``PORTAL_INVITE`` | ``COMPLETE``
    stage: Mapped[str] = mapped_column(String(30), default="IDENTIFICATION", index=True)

    legal_name: Mapped[str] = mapped_column(String(255))
    trade_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    cin: Mapped[str | None] = mapped_column(String(21), nullable=True)
    entity_type: Mapped[EntityType | None] = mapped_column(
        SaEnum(EntityType, name="entity_type", create_type=False), nullable=True
    )

    #: Verbatim response from whatever registry lookup produced it, so a later
    #: change to the field mapping can be re-applied without re-querying.
    registry_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    #: ``[{name, din, designation}]``
    directors: Mapped[list] = mapped_column(JSONB, default=list)

    engagement_letter_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement_letter_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    #: NULL until a human has read and accepted the drafted letter. A generated
    #: engagement letter is a proposal, never a contract.
    letter_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner: Mapped[User | None] = relationship(foreign_keys=[owner_id])


class CollaborationThread(Base, UuidMixin, TimestampMixin):
    """Module 13. A conversation with a client."""

    __tablename__ = "collaboration_threads"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )

    subject: Mapped[str] = mapped_column(String(255))
    channel: Mapped[ThreadChannel] = mapped_column(
        SaEnum(ThreadChannel, name="thread_channel"), default=ThreadChannel.CLIENT_PORTAL
    )
    status: Mapped[ThreadStatus] = mapped_column(
        SaEnum(ThreadStatus, name="thread_status"), default=ThreadStatus.OPEN
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    messages: Mapped[list[ThreadMessage]] = relationship(
        back_populates="thread", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_threads_firm_status", "firm_id", "status"),
        Index("ix_threads_client_last", "client_id", "last_message_at"),
    )


class ThreadMessage(Base, UuidMixin):
    """Module 13. One message.

    Rows rather than a JSON array on the thread: a JSON column cannot be
    paginated, cannot be searched, and cannot carry a per-message read receipt.
    """

    __tablename__ = "thread_messages"

    thread_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("collaboration_threads.id", ondelete="CASCADE"),
        index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_kind: Mapped[MessageAuthorKind] = mapped_column(
        SaEnum(MessageAuthorKind, name="message_author_kind"),
        default=MessageAuthorKind.FIRM_USER,
    )

    body: Mapped[str] = mapped_column(Text)
    #: ``[{document_id, file_name}]``
    attachments: Mapped[list] = mapped_column(JSONB, default=list)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    thread: Mapped[CollaborationThread] = relationship(back_populates="messages")
    author: Mapped[User | None] = relationship(foreign_keys=[author_id])

    __table_args__ = (Index("ix_messages_thread_created", "thread_id", "created_at"),)


class ApprovalRequest(Base, UuidMixin, TimestampMixin):
    """Module 13. A client sign-off request.

    The emailed link carries a raw token; only its digest is stored, and it is
    single-use and expiring. ``response_ip`` captured at the moment of approval
    is the evidence that the client, not the firm, clicked it.
    """

    __tablename__ = "approval_requests"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("collaboration_threads.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: What is being approved: ``GSTR-3B Oct 2026``, ``Engagement letter``.
    artefact: Mapped[str] = mapped_column(String(200))

    status: Mapped[ApprovalStatus] = mapped_column(
        SaEnum(ApprovalStatus, name="approval_status"), default=ApprovalStatus.REQUESTED
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    response_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    requested_by: Mapped[User | None] = relationship(foreign_keys=[requested_by_id])

    __table_args__ = (Index("ix_approvals_firm_status", "firm_id", "status"),)


class Report(Base, UuidMixin, TimestampMixin):
    """Module 16. A generated export."""

    __tablename__ = "reports"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    generated_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    name: Mapped[str] = mapped_column(String(255))
    #: Which builder produced it: ``client-portfolio``, ``gst-recon``,
    #: ``task-status``, ``risk-register``.
    kind: Mapped[str] = mapped_column(String(50), index=True)
    format: Mapped[ReportFormat] = mapped_column(
        SaEnum(ReportFormat, name="report_format"), default=ReportFormat.CSV
    )
    status: Mapped[ReportStatus] = mapped_column(
        SaEnum(ReportStatus, name="report_status"), default=ReportStatus.QUEUED
    )

    #: The filter set it ran with, so it can be reproduced exactly.
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: SHA-256 of the file, printed on the export so a recipient can verify it
    #: was not altered after it left the firm.
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    generated_by: Mapped[User | None] = relationship(foreign_keys=[generated_by_id])
    shares: Mapped[list[ReportShare]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_reports_firm_kind_created", "firm_id", "kind", "created_at"),)


class ReportShare(Base, UuidMixin):
    """Module 16. A time-limited, download-capped share link."""

    __tablename__ = "report_shares"

    report_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    #: Optional passphrase gate, hashed at the same cost as a user password -
    #: this one is human-chosen, so unlike the token it does need a slow hash.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_downloads: Mapped[int] = mapped_column(Integer, default=10)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    report: Mapped[Report] = relationship(back_populates="shares")
