"""Risk findings, copilot interactions and the case-law corpus.

Modules 8 and 12 - the parts that are genuinely machine learning rather than
business rules, plus the audit trail that makes their output defensible.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SaEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.models.base import Base, TimestampMixin, UuidMixin
from app.models.enums import CourtTier, RiskCheck, RiskSeverity, RiskStatus


def _embedding_column_type():
    """The storage type for a case-law embedding.

    Resolved once, from configuration rather than from the live server, because
    Alembic has to be able to render the schema without a connection - and
    because the type must not silently differ between the migration that
    created the column and the model that reads it.

    See ``settings.PGVECTOR_ENABLED`` for why both branches exist.
    """
    if settings.PGVECTOR_ENABLED:
        from pgvector.sqlalchemy import Vector

        return Vector(settings.EMBEDDING_DIM)
    # ``double precision[]`` holds the same numbers; what it lacks is the
    # distance operators and the ANN index. Dimension is not enforced by the
    # column, so it is asserted on write instead.
    return ARRAY(Float)

if TYPE_CHECKING:
    from app.models.tenancy import User


class RiskFinding(Base, UuidMixin, TimestampMixin):
    """Module 8. Output of the analytical checks over a client's ledger.

    Every check is unsupervised or rule-based. That is not a shortcut: there
    are no labelled fraud cases in this domain to train a supervised model on,
    and manufacturing some would make any reported accuracy meaningless.
    """

    __tablename__ = "risk_findings"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )

    check: Mapped[RiskCheck] = mapped_column(SaEnum(RiskCheck, name="risk_check"))
    severity: Mapped[RiskSeverity] = mapped_column(SaEnum(RiskSeverity, name="risk_severity"))
    status: Mapped[RiskStatus] = mapped_column(
        SaEnum(RiskStatus, name="risk_status"), default=RiskStatus.OPEN
    )

    title: Mapped[str] = mapped_column(String(255))
    #: Why the check fired, phrased so a reviewer can act without reading code.
    detail: Mapped[str] = mapped_column(Text)
    #: The statistics behind it, e.g. for Benford:
    #: ``{chi_square, p_value, observed, expected, n}``. Stored so the finding
    #: can be defended in a review, not just asserted.
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict)

    #: Journal entries that triggered it.
    entry_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PgUUID(as_uuid=True)), default=list
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    #: 0-100, composite of the check's own statistic and the severity band.
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    period: Mapped[str | None] = mapped_column(String(7), nullable=True)

    triaged_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    triaged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: A finding marked FALSE_POSITIVE with a reason is how the thresholds get
    #: tuned. Without the note it is just a dismissed alert.
    triage_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    triaged_by: Mapped[User | None] = relationship(foreign_keys=[triaged_by_id])

    __table_args__ = (
        Index("ix_risk_firm_status_sev", "firm_id", "status", "severity"),
        Index("ix_risk_client_period", "client_id", "period"),
    )


class AiInteraction(Base, UuidMixin):
    """Module 12. Every copilot exchange.

    Logged for three reasons, in order of importance: so an answer can be
    traced back to the rows it came from, so the feedback score tells us
    whether the answers are any good, and so token spend is visible.
    """

    __tablename__ = "ai_interactions"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: Groups a multi-turn conversation.
    conversation_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), index=True)

    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    response: Mapped[str] = mapped_column(Text)

    #: Which intent the router classified the question as, and how sure it was.
    #: The copilot answers by running a vetted parameterised query for the
    #: intent - never by generating SQL - so this is the whole decision.
    intent: Mapped[str | None] = mapped_column(String(60), nullable=True)
    intent_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)

    #: Rows the answer was derived from: ``[{table, id, label}]``. An answer
    #: without citations is one nobody can check.
    citations: Mapped[list] = mapped_column(JSONB, default=list)

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    #: 1-5, set by the user afterwards.
    feedback_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (Index("ix_ai_firm_created", "firm_id", "created_at"),)


class CaseLawDocument(Base, UuidMixin, TimestampMixin):
    """A judgment in the case-law corpus - Phase 6.

    Not firm-scoped: case law is public and shared across every tenant. That
    also means nothing client-confidential may ever be written here.
    """

    __tablename__ = "case_law_documents"

    #: Neutral citation, e.g. ``[2024] 162 taxmann.com 318 (SC)``.
    citation: Mapped[str] = mapped_column(String(255), unique=True)
    title: Mapped[str] = mapped_column(String(500))
    court: Mapped[CourtTier] = mapped_column(SaEnum(CourtTier, name="court_tier"))
    bench: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decided_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: Statutory sections the judgment turns on, e.g. ``["IT-68", "IT-69A"]``.
    sections: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)
    #: Which side won - the first thing anyone wants to know.
    outcome: Mapped[str | None] = mapped_column(String(60), nullable=True)
    headnote: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    chunks: Mapped[list[CaseLawChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_case_law_court_date", "court", "decided_on"),)


class CaseLawChunk(Base, UuidMixin):
    """An embedded passage of a judgment.

    Chunked rather than embedded whole because a judgment runs to tens of
    thousands of words and a single vector over all of it retrieves nothing
    precisely. One vector per passage is what makes the search usable.

    The column width is driven by ``settings.EMBEDDING_DIM`` and must match
    both the embedding model and the migration. Changing the model means
    re-embedding the corpus - there is no partial upgrade.

    The column *type* depends on ``settings.PGVECTOR_ENABLED``; see
    ``_embedding_column_type``.
    """

    __tablename__ = "case_law_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("case_law_documents.id", ondelete="CASCADE"),
        index=True,
    )
    #: Position within the judgment, so retrieved passages can be shown in order.
    ordinal: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[list[float]] = mapped_column(_embedding_column_type())
    #: Which model produced the vector. A corpus with mixed embeddings returns
    #: nonsense, so this is checked before a search runs.
    embedding_model: Mapped[str] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped[CaseLawDocument] = relationship(back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("document_id", "ordinal", name="uq_case_chunks_doc_ordinal"),
    )


class LedgerTrainingExample(Base, UuidMixin):
    """A labelled (narration -> ledger) pair for training the classifier.

    Three sources, and the distinction matters when reporting results:

    ``synthetic``
        Generated by scripts/generate_dataset.py from real Indian bank
        narration grammars. Plentiful, and fine for learning the patterns,
        but accuracy measured on it overstates real performance.
    ``correction``
        Harvested from ``JournalEntry`` rows a human overrode. Few, slow to
        accumulate, and the most valuable rows in the table.
    ``curated``
        Hand-labelled by a person from real statements. The held-out set that
        the honest headline metric is computed on.

    Keeping ``source`` on every row is what lets the evaluation say "94% on
    synthetic, 81% on curated" instead of one number that flatters itself.
    """

    __tablename__ = "ledger_training_examples"

    #: NULL for rows shipped with the project; set for firm-specific corrections.
    firm_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=True
    )

    narration: Mapped[str] = mapped_column(Text)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    direction: Mapped[str] = mapped_column(String(10))
    #: The label: a ledger *code*, not an id, so the dataset survives a
    #: chart-of-accounts rebuild and can be shared between firms.
    ledger_code: Mapped[str] = mapped_column(String(20), index=True)

    source: Mapped[str] = mapped_column(String(20), index=True)
    #: True for the held-out evaluation split. Fixed at generation time so the
    #: split never moves between training runs and the metric stays comparable.
    is_holdout: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (Index("ix_training_source_holdout", "source", "is_holdout"),)
