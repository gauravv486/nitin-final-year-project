"""Chart of accounts and transaction ledger mapping - Module 4.

These two tables are where the ledger classifier's output lands, so the shape
matters more than usual. The rule is that the machine's opinion and the human's
decision are stored in *separate columns*:

    suggested_ledger_id  +  confidence   -> what the model predicted
    posted_ledger_id     +  reviewed_by  -> what a person decided
    overridden                            -> they disagreed

Keeping both is what makes two things possible: an audit trail that shows a
human made the call, and a training set of real corrections that improves the
next model. Overwriting the prediction with the correction would destroy both.
"""

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

from app.models.base import Base, TimestampMixin, UuidMixin
from app.models.enums import JournalStatus, LedgerGroup, TransactionDirection

if TYPE_CHECKING:
    from app.models.practice import Document
    from app.models.tenancy import User


class LedgerAccount(Base, UuidMixin, TimestampMixin):
    """One entry in a firm's chart of accounts.

    Firm-scoped rather than global so a practice can name its accounts the way
    its clients' books already do - "Printing & Stationery" in one firm is
    "Office Consumables" in another, and the classifier predicts *this firm's*
    labels.
    """

    __tablename__ = "ledger_accounts"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255))
    group: Mapped[LedgerGroup] = mapped_column(SaEnum(LedgerGroup, name="ledger_group"))

    #: Self-reference, for sub-ledgers under a control account.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("ledger_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    #: Set on the accounts seeded from the standard chart. The classifier is
    #: trained against these, so a firm's own extra accounts are predictable
    #: only after enough corrections exist for them.
    is_standard: Mapped[bool] = mapped_column(Boolean, default=False)

    parent: Mapped[LedgerAccount | None] = relationship(
        remote_side="LedgerAccount.id", back_populates="children"
    )
    children: Mapped[list[LedgerAccount]] = relationship(back_populates="parent")

    __table_args__ = (
        UniqueConstraint("firm_id", "code", name="uq_ledger_accounts_firm_id_code"),
        Index("ix_ledger_accounts_firm_group", "firm_id", "group"),
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.code} {self.name}"


class JournalEntry(Base, UuidMixin, TimestampMixin):
    """A bank, cash or invoice line awaiting or holding a ledger mapping.

    This is the classifier's unit of work: ``narration`` in, a ledger and a
    calibrated ``confidence`` out.
    """

    __tablename__ = "journal_entries"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    #: Source document, when the line came from an extraction rather than a
    #: bank statement import.
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )

    transaction_date: Mapped[date] = mapped_column(Date)
    #: Raw bank narration, exactly as imported. Never cleaned in place - the
    #: normalised form goes in ``normalised_narration`` so the original is
    #: always available to re-run a better parser against.
    narration: Mapped[str] = mapped_column(Text)
    normalised_narration: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: Counterparty extracted from the narration, when one could be found.
    counterparty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    #: Always positive. Direction lives in its own column, because a signed
    #: amount makes every aggregation query need to know the sign convention.
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    direction: Mapped[TransactionDirection] = mapped_column(
        SaEnum(TransactionDirection, name="transaction_direction")
    )

    # ---- the model's opinion -------------------------------------------
    suggested_ledger_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("ledger_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    #: Calibrated probability in [0, 1]. Compared directly against the firm's
    #: auto-apply floor, which is only meaningful because it is calibrated.
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    #: Version of the artifact that produced the prediction, e.g.
    #: ``ledger-clf-2026-10-25-tfidf-svm``. Without this you cannot tell which
    #: model produced a bad batch.
    model_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    #: Top-k alternatives: ``[{ledger_id, name, probability}]``. Shown to the
    #: reviewer so correcting a wrong guess is one click, not a search.
    alternatives: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # ---- the human's decision ------------------------------------------
    posted_ledger_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("ledger_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[JournalStatus] = mapped_column(
        SaEnum(JournalStatus, name="journal_status"), default=JournalStatus.SUGGESTED
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: True when the reviewer picked something other than the suggestion. This
    #: flag is the single most valuable column in the schema for improving the
    #: model - it marks exactly the rows the classifier got wrong.
    overridden: Mapped[bool] = mapped_column(Boolean, default=False)

    period: Mapped[str] = mapped_column(String(7), index=True)

    document: Mapped[Document | None] = relationship(back_populates="journal_entries")
    suggested_ledger: Mapped[LedgerAccount | None] = relationship(
        foreign_keys=[suggested_ledger_id]
    )
    posted_ledger: Mapped[LedgerAccount | None] = relationship(
        foreign_keys=[posted_ledger_id]
    )
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])

    __table_args__ = (
        Index("ix_journal_entries_firm_status", "firm_id", "status"),
        Index("ix_journal_entries_client_period", "client_id", "period"),
        Index("ix_journal_entries_client_date", "client_id", "transaction_date"),
    )

    @property
    def effective_ledger_id(self) -> uuid.UUID | None:
        """What the books should actually use: the human's call if made."""
        return self.posted_ledger_id or self.suggested_ledger_id
