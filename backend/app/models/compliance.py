"""Compliance tables - Modules 5, 6, 7, 9, 10, 11."""

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

from app.models.base import Base, TimestampMixin, UuidMixin
from app.models.enums import (
    AisHead,
    FilingStatus,
    GstReturnType,
    MatchStatus,
    McaFormType,
    NoticeAuthority,
    NoticeStatus,
    ObligationCategory,
    ObligationFrequency,
    PayrollStatus,
    ReconRunStatus,
)

if TYPE_CHECKING:
    from app.models.tenancy import User


# ============================================================ GST - M5 =====


class GstReturn(Base, UuidMixin, TimestampMixin):
    """Filing status per client, per return type, per period."""

    __tablename__ = "gst_returns"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )

    return_type: Mapped[GstReturnType] = mapped_column(
        SaEnum(GstReturnType, name="gst_return_type")
    )
    #: ``YYYY-MM`` monthly, ``YYYY-Qn`` quarterly.
    period: Mapped[str] = mapped_column(String(7))
    status: Mapped[FilingStatus] = mapped_column(
        SaEnum(FilingStatus, name="filing_status"), default=FilingStatus.NOT_STARTED
    )
    due_date: Mapped[date] = mapped_column(Date, index=True)
    filed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: Acknowledgement Reference Number from the GST portal.
    arn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax_payable: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    late_fee: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "client_id", "return_type", "period", name="uq_gst_returns_client_type_period"
        ),
        Index("ix_gst_returns_firm_status", "firm_id", "status"),
    )


class GstReconciliation(Base, UuidMixin, TimestampMixin):
    """One reconciliation run: the client's books against GSTR-2B for a period.

    Totals are *stored*, not derived on read. A completed run is evidence of
    what the position was when it was signed off; recomputing it later against
    changed books would silently rewrite history.
    """

    __tablename__ = "gst_reconciliations"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    period: Mapped[str] = mapped_column(String(7))
    status: Mapped[ReconRunStatus] = mapped_column(
        SaEnum(ReconRunStatus, name="recon_run_status"), default=ReconRunStatus.DRAFT
    )

    total_lines: Mapped[int] = mapped_column(Integer, default=0)
    matched_lines: Mapped[int] = mapped_column(Integer, default=0)
    mismatched_lines: Mapped[int] = mapped_column(Integer, default=0)

    #: Tax on lines that are not cleanly matched - the input tax credit the
    #: client cannot safely claim until somebody resolves the difference. This
    #: is the single number the whole module exists to produce.
    itc_at_risk: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    books_tax_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    portal_tax_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    #: Tolerances the run used, so an old run stays interpretable after the
    #: defaults change: ``{amount_abs, amount_pct, date_window_days, fuzz_floor}``
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict)

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list[GstReconciliationLine]] = relationship(
        back_populates="reconciliation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("client_id", "period", name="uq_gst_recon_client_period"),
        Index("ix_gst_recon_firm_status", "firm_id", "status"),
    )


class GstReconciliationLine(Base, UuidMixin):
    """One invoice pairing.

    Books columns are NULL for a portal-only invoice and portal columns are
    NULL for a books-only invoice. That absence *is* the finding, which is why
    they are nullable rather than defaulted to zero - a zero would quietly
    become a real amount in a SUM.
    """

    __tablename__ = "gst_reconciliation_lines"

    reconciliation_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("gst_reconciliations.id", ondelete="CASCADE"),
        index=True,
    )

    supplier_name: Mapped[str] = mapped_column(String(255))
    supplier_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True, index=True)
    invoice_no: Mapped[str] = mapped_column(String(50))
    #: Punctuation-stripped, upper-cased invoice number - the actual join key.
    invoice_no_key: Mapped[str] = mapped_column(String(50), index=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    books_taxable: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    books_tax: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    portal_taxable: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    portal_tax: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    status: Mapped[MatchStatus] = mapped_column(SaEnum(MatchStatus, name="match_status"))
    #: 1.0 for an exact key match; lower when the matcher paired these two
    #: heuristically and a human should confirm.
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("1"))
    #: Which pass paired them: ``exact`` | ``normalised`` | ``fuzzy`` | ``none``.
    match_pass: Mapped[str | None] = mapped_column(String(20), nullable=True)
    #: Human-readable account of why they were paired, e.g.
    #: "GSTIN equal, invoice no. 94% similar, dates 3 days apart".
    match_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    reconciliation: Mapped[GstReconciliation] = relationship(back_populates="lines")
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])

    __table_args__ = (Index("ix_recon_lines_recon_status", "reconciliation_id", "status"),)

    @property
    def tax_difference(self) -> Decimal:
        """Portal tax minus books tax, treating a missing side as zero.

        Only meaningful for display; the ITC-at-risk total is computed by the
        matcher, which knows which side is authoritative for each status.
        """
        return (self.portal_tax or Decimal("0")) - (self.books_tax or Decimal("0"))


# ===================================================== income tax - M6 =====


class AisStatement(Base, UuidMixin, TimestampMixin):
    """An AIS/TIS statement for one client and assessment year."""

    __tablename__ = "ais_statements"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    #: ``2026-27``
    assessment_year: Mapped[str] = mapped_column(String(7))
    status: Mapped[FilingStatus] = mapped_column(
        SaEnum(FilingStatus, name="filing_status", create_type=False),
        default=FilingStatus.NOT_STARTED,
    )

    #: Original parsed payload, kept verbatim so a mapping fix can be re-run
    #: against the source rather than needing the file again.
    source_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    ais_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    books_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    variance_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    itr_filed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    acknowledgement: Mapped[str | None] = mapped_column(String(30), nullable=True)

    lines: Mapped[list[AisLine]] = relationship(
        back_populates="statement", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("client_id", "assessment_year", name="uq_ais_client_ay"),
    )


class AisLine(Base, UuidMixin):
    """One head of income compared against the books."""

    __tablename__ = "ais_lines"

    statement_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("ais_statements.id", ondelete="CASCADE"), index=True
    )
    head: Mapped[AisHead] = mapped_column(SaEnum(AisHead, name="ais_head"))
    #: Deductor / payer name as printed on the statement.
    counterparty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tan: Mapped[str | None] = mapped_column(String(10), nullable=True)

    ais_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    #: NULL means the books have no corresponding entry at all - a different
    #: finding from "the books say zero".
    books_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    tds_credit: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    variance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    #: True when |variance| exceeded the tolerance the match was run with.
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    statement: Mapped[AisStatement] = relationship(back_populates="lines")

    __table_args__ = (Index("ix_ais_lines_stmt_flagged", "statement_id", "flagged"),)


# ====================================================== litigation - M7 =====


class TaxNotice(Base, UuidMixin, TimestampMixin):
    """A statutory notice and its response."""

    __tablename__ = "tax_notices"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    notice_number: Mapped[str] = mapped_column(String(100))
    authority: Mapped[NoticeAuthority] = mapped_column(
        SaEnum(NoticeAuthority, name="notice_authority")
    )
    #: e.g. ``143(1)``, ``148A(b)``, ``ASMT-10``.
    section_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)

    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    demand_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    status: Mapped[NoticeStatus] = mapped_column(
        SaEnum(NoticeStatus, name="notice_status"), default=NoticeStatus.RECEIVED
    )
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: LLM-drafted reply. Never filed without an explicit human approval, which
    #: is exactly what ``response_approved_at`` records - an unapproved draft
    #: has no standing.
    draft_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    response_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    filed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    hearing_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    #: Cases a human selected from the search results:
    #: ``[{citation, court, year, note}]``. Never auto-filled - citing a
    #: judgment the model retrieved but nobody read is how fabricated
    #: authorities end up in a filing.
    cited_cases: Mapped[list] = mapped_column(JSONB, default=list)

    __table_args__ = (
        UniqueConstraint("firm_id", "notice_number", name="uq_notices_firm_number"),
        Index("ix_notices_firm_status", "firm_id", "status"),
    )


# ========================================================= payroll - M9 =====


class PayrollRun(Base, UuidMixin, TimestampMixin):
    """A month's payroll for one client."""

    __tablename__ = "payroll_runs"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    period: Mapped[str] = mapped_column(String(7))
    status: Mapped[PayrollStatus] = mapped_column(
        SaEnum(PayrollStatus, name="payroll_status"), default=PayrollStatus.DRAFT
    )

    headcount: Mapped[int] = mapped_column(Integer, default=0)
    gross_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    net_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    #: Employee + employer share, which is what actually gets remitted.
    pf_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    esi_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    pt_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    tds_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    #: Statutory rates and ceilings this run used. Rates change by notification;
    #: last year's payslip must keep showing last year's arithmetic.
    rate_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)

    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    lines: Mapped[list[PayrollLine]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("client_id", "period", name="uq_payroll_client_period"),
    )


class PayrollLine(Base, UuidMixin):
    """One employee's payslip within a run.

    Every component is stored rather than recomputed on read, for the reason in
    ``PayrollRun.rate_snapshot``.
    """

    __tablename__ = "payroll_lines"

    run_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), index=True
    )
    employee_code: Mapped[str] = mapped_column(String(30))
    employee_name: Mapped[str] = mapped_column(String(255))
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    uan: Mapped[str | None] = mapped_column(String(12), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)

    #: Days actually paid, for pro-rating a mid-month joiner.
    paid_days: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("30"))
    basic: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    hra: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    allowances: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    gross: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    pf_employee: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    pf_employer: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    esi_employee: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    esi_employer: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    professional_tax: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    tds: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    other_deductions: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    net: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    run: Mapped[PayrollRun] = relationship(back_populates="lines")

    __table_args__ = (
        UniqueConstraint("run_id", "employee_code", name="uq_payroll_lines_run_employee"),
    )


# ==================================================== secretarial - M10 =====


class McaFiling(Base, UuidMixin, TimestampMixin):
    """An MCA/ROC e-form and its filing state."""

    __tablename__ = "mca_filings"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )

    form_type: Mapped[McaFormType] = mapped_column(SaEnum(McaFormType, name="mca_form_type"))
    #: ``2025-26``
    financial_year: Mapped[str] = mapped_column(String(7))
    status: Mapped[FilingStatus] = mapped_column(
        SaEnum(FilingStatus, name="filing_status", create_type=False),
        default=FilingStatus.NOT_STARTED,
    )
    due_date: Mapped[date] = mapped_column(Date, index=True)
    submitted_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: Service Request Number returned by the MCA portal.
    srn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    filing_fee: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    #: Late-filing additional fee, which is a multiple of the normal fee.
    additional_fee: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    meeting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    meeting_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    resolution_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    minutes_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "client_id", "form_type", "financial_year", name="uq_mca_client_form_fy"
        ),
        Index("ix_mca_firm_status", "firm_id", "status"),
    )


# ===================================================== calendar - M11 =======


class ComplianceObligation(Base, UuidMixin, TimestampMixin):
    """The statutory calendar *template*.

    "GSTR-3B is due on the 20th of the following month" is an obligation;
    "Arora Trading's GSTR-3B for Oct 2026, due 20 Nov" is a task. Firm-scoped
    so a practice can add its own internal deadlines beside the statutory ones.
    """

    __tablename__ = "compliance_obligations"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    #: ``GSTR-3B``, ``TDS 26Q``, ``AOC-4``
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    category: Mapped[ObligationCategory] = mapped_column(
        SaEnum(ObligationCategory, name="obligation_category")
    )
    frequency: Mapped[ObligationFrequency] = mapped_column(
        SaEnum(ObligationFrequency, name="obligation_frequency")
    )
    #: Day of the month the filing falls due.
    due_day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Months after the period ends, e.g. 1 for "20th of next month".
    due_month_offset: Mapped[int] = mapped_column(Integer, default=1)

    #: Entity types this applies to. Empty means all of them.
    applies_to: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)
    is_statutory: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tasks: Mapped[list[ComplianceTask]] = relationship(back_populates="obligation")

    __table_args__ = (UniqueConstraint("firm_id", "code", name="uq_obligations_firm_code"),)


class ComplianceTask(Base, UuidMixin, TimestampMixin):
    """A concrete deadline for one client in one period."""

    __tablename__ = "compliance_tasks"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    obligation_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("compliance_obligations.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    #: Denormalised from the obligation deliberately: a closed task must still
    #: say what it was for even if its template is later edited or deleted.
    form: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(500))
    #: ``Oct 2026``, ``Q2 FY26-27``, ``FY 2025-26`` - the label the UI shows.
    period: Mapped[str] = mapped_column(String(20))

    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[FilingStatus] = mapped_column(
        SaEnum(FilingStatus, name="filing_status", create_type=False),
        default=FilingStatus.PENDING,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Set when a CBIC/CBDT notification pushes a deadline. The original date is
    #: kept so "was this late under the original rules?" stays answerable.
    extended_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    extension_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    obligation: Mapped[ComplianceObligation | None] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id])

    __table_args__ = (
        UniqueConstraint("client_id", "form", "period", name="uq_tasks_client_form_period"),
        Index("ix_tasks_firm_status_due", "firm_id", "status", "due_date"),
        Index("ix_tasks_firm_assignee", "firm_id", "assignee_id"),
    )
