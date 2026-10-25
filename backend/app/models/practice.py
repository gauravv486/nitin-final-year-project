"""Clients, contacts, onboarding and documents - Modules 2 and 3."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SaEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UuidMixin
from app.models.enums import (
    ClientStatus,
    DocumentKind,
    DocumentStatus,
    EntityType,
)

if TYPE_CHECKING:
    from app.models.books import JournalEntry
    from app.models.tenancy import Firm, User


class Client(Base, UuidMixin, TimestampMixin, SoftDeleteMixin):
    """A business the firm acts for."""

    __tablename__ = "clients"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )

    #: Short name shown in lists; ``legal_name`` is what goes on filings.
    name: Mapped[str] = mapped_column(String(255))
    legal_name: Mapped[str] = mapped_column(String(255))
    trade_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    cin: Mapped[str | None] = mapped_column(String(21), nullable=True)
    tan: Mapped[str | None] = mapped_column(String(10), nullable=True)

    entity_type: Mapped[EntityType] = mapped_column(
        SaEnum(EntityType, name="entity_type"), default=EntityType.PRIVATE_LIMITED
    )
    status: Mapped[ClientStatus] = mapped_column(
        SaEnum(ClientStatus, name="client_status"), default=ClientStatus.ACTIVE
    )

    #: When the engagement began. Decides which periods have obligations at all.
    engaged_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: Staff member who owns the relationship. Drives row visibility for
    #: non-partner roles - see ClientScope in app/core/deps.py.
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(6), nullable=True)

    #: ``MONTHLY`` or ``QUARTERLY``. Decides which GST deadlines get generated.
    gst_frequency: Mapped[str] = mapped_column(String(10), default="MONTHLY")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    firm: Mapped[Firm] = relationship(back_populates="clients")
    manager: Mapped[User | None] = relationship(foreign_keys=[manager_id])
    portal_users: Mapped[list[User]] = relationship(
        back_populates="client", foreign_keys="User.client_id"
    )
    contacts: Mapped[list[ClientContact]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )

    # PAN and GSTIN are unique per firm, not globally: two firms may act for the
    # same company, and a group shares one PAN across several GSTINs.
    __table_args__ = (
        UniqueConstraint("firm_id", "pan", name="uq_clients_firm_id_pan"),
        UniqueConstraint("firm_id", "gstin", name="uq_clients_firm_id_gstin"),
        Index("ix_clients_firm_status", "firm_id", "status"),
        Index("ix_clients_firm_manager", "firm_id", "manager_id"),
    )


class ClientContact(Base, UuidMixin, TimestampMixin):
    """Directors, partners and authorised signatories."""

    __tablename__ = "client_contacts"

    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    #: Director Identification Number, required on ROC filings.
    din: Mapped[str | None] = mapped_column(String(8), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_signatory: Mapped[bool] = mapped_column(Boolean, default=False)

    client: Mapped[Client] = relationship(back_populates="contacts")


class Document(Base, UuidMixin, TimestampMixin, SoftDeleteMixin):
    """Module 3. File metadata.

    The bytes live wherever the storage driver put them; ``storage_key`` is
    opaque to this table and is always relative to the storage root - an
    absolute path would not survive a restore onto another machine.
    """

    __tablename__ = "documents"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    file_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(127))
    size_bytes: Mapped[int] = mapped_column(Integer)
    #: SHA-256 of the file. The unique constraint below uses it to refuse the
    #: same invoice twice for one client, which is the cheapest possible
    #: duplicate-entry control.
    checksum: Mapped[str] = mapped_column(String(64))

    kind: Mapped[DocumentKind] = mapped_column(
        SaEnum(DocumentKind, name="document_kind"), default=DocumentKind.OTHER
    )
    status: Mapped[DocumentStatus] = mapped_column(
        SaEnum(DocumentStatus, name="document_status"), default=DocumentStatus.QUEUED
    )
    #: Free-text folder path for the explorer tree, e.g. ``2026-27/GST/Q2``.
    folder: Mapped[str] = mapped_column(String(255), default="/")
    #: Period the document belongs to, ``YYYY-MM``.
    period: Mapped[str | None] = mapped_column(String(7), nullable=True)

    client: Mapped[Client] = relationship(back_populates="documents")
    uploaded_by: Mapped[User | None] = relationship(foreign_keys=[uploaded_by_id])
    extraction: Mapped[DocumentExtraction | None] = relationship(
        back_populates="document", uselist=False, cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list[JournalEntry]] = relationship(back_populates="document")

    __table_args__ = (
        UniqueConstraint("client_id", "checksum", name="uq_documents_client_id_checksum"),
        Index("ix_documents_firm_status", "firm_id", "status"),
        Index("ix_documents_client_kind", "client_id", "kind"),
    )


class DocumentExtraction(Base, UuidMixin, TimestampMixin):
    """Module 3. Extraction output - one row per document.

    Split from ``Document`` because ``raw_text`` can be hundreds of kilobytes
    and the document list never needs it.
    """

    __tablename__ = "document_extractions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), unique=True
    )

    #: Which extractor ran: ``pdfplumber``, ``tesseract``, ``layoutlm``.
    engine: Mapped[str] = mapped_column(String(50))
    #: Plain text, for full-text and semantic search.
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Structured fields. A ``null`` entry means "not found" - which is
    #: different from zero, and conflating the two is how a missing tax amount
    #: becomes a silent ₹0 in a reconciliation.
    fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    #: Mean field-level confidence in [0, 1].
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    #: Set when a human corrected the extracted values. These rows are the only
    #: real labelled data the project will ever accumulate, so they are worth
    #: keeping separately from the original guess.
    corrected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    corrected_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    document: Mapped[Document] = relationship(back_populates="extraction")
