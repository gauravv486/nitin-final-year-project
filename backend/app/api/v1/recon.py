"""GST reconciliation endpoints - Module 5.

Stateless: books and portal lines come in, the reconciliation comes out.
Persisting a run against ``gst_reconciliations`` is a separate concern and
needs the database; the matcher itself does not, so these work today.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.ml.recon.matcher import reconcile
from app.ml.recon.types import InvoiceLine, Tolerance

router = APIRouter(prefix="/gst", tags=["gst"])


class InvoiceIn(BaseModel):
    ref: str = Field(max_length=80, description="Your identifier for this row.")
    supplier_name: str = Field(max_length=255)
    supplier_gstin: str | None = Field(default=None, max_length=15)
    invoice_no: str = Field(max_length=50)
    invoice_date: date | None = None
    taxable: Decimal = Field(ge=0, description="Taxable value, excluding tax.")
    tax: Decimal = Field(ge=0, description="Total GST (IGST, or CGST + SGST).")

    def to_line(self) -> InvoiceLine:
        return InvoiceLine(
            ref=self.ref,
            supplier_name=self.supplier_name,
            supplier_gstin=self.supplier_gstin,
            invoice_no=self.invoice_no,
            invoice_date=self.invoice_date,
            taxable=self.taxable,
            tax=self.tax,
        )


class ToleranceIn(BaseModel):
    amount_abs: Decimal = Field(default=Decimal("2.00"), ge=0)
    amount_pct: Decimal = Field(default=Decimal("0.01"), ge=0, le=1)
    date_window_days: int = Field(default=15, ge=0, le=180)
    invoice_similarity: int = Field(default=85, ge=50, le=100)
    max_invoice_edits: int = Field(default=1, ge=0, le=5)
    name_similarity: int = Field(default=88, ge=50, le=100)

    def to_tolerance(self) -> Tolerance:
        return Tolerance(**self.model_dump())


class ReconcileIn(BaseModel):
    period: str = Field(default="", max_length=7, examples=["2026-09"])
    books: list[InvoiceIn] = Field(
        default_factory=list, max_length=5000, description="The purchase register."
    )
    portal: list[InvoiceIn] = Field(
        default_factory=list, max_length=5000, description="GSTR-2B lines."
    )
    tolerance: ToleranceIn = Field(default_factory=ToleranceIn)


class LineOut(BaseModel):
    status: str
    match_pass: str
    supplier_name: str
    supplier_gstin: str | None
    invoice_no: str
    invoice_date: date | None
    books_ref: str | None
    portal_ref: str | None
    books_taxable: Decimal | None
    books_tax: Decimal | None
    portal_taxable: Decimal | None
    portal_tax: Decimal | None
    tax_difference: Decimal
    itc_at_risk: Decimal
    itc_unclaimed: Decimal
    confidence: float
    note: str


class SummaryOut(BaseModel):
    period: str
    headline: str
    total_lines: int
    matched: int
    amount_mismatch: int
    missing_in_books: int
    missing_in_2b: int
    match_rate: float
    books_tax_total: Decimal
    portal_tax_total: Decimal
    #: Credit claimed in the books the portal does not support. The liability.
    itc_at_risk: Decimal
    #: Credit the portal supports that the books have not taken. The
    #: opportunity. Separate from the above because the action is opposite.
    itc_unclaimed: Decimal
    net_itc_impact: Decimal
    #: Pairings that needed a heuristic - worth a human glance even though the
    #: matcher considers them matched.
    fuzzy_matches: int
    lines: list[LineOut]


@router.post("/reconcile", response_model=SummaryOut, summary="Reconcile books against GSTR-2B")
def run_reconciliation(payload: ReconcileIn) -> SummaryOut:
    """Match a purchase register against GSTR-2B and quantify the ITC position.

    Every line from both sides appears in the output exactly once. Each carries
    a plain-language `note` explaining why it was paired or left unmatched -
    a CA may have to justify this to the department, and an unexplained verdict
    is not a justification.
    """
    result = reconcile(
        [row.to_line() for row in payload.books],
        [row.to_line() for row in payload.portal],
        period=payload.period,
        tolerance=payload.tolerance.to_tolerance(),
    )

    return SummaryOut(
        period=result.period,
        headline=result.headline(),
        total_lines=result.total_lines,
        matched=result.matched,
        amount_mismatch=result.amount_mismatch,
        missing_in_books=result.missing_in_books,
        missing_in_2b=result.missing_in_2b,
        match_rate=round(result.match_rate, 4),
        books_tax_total=result.books_tax_total,
        portal_tax_total=result.portal_tax_total,
        itc_at_risk=result.itc_at_risk,
        itc_unclaimed=result.itc_unclaimed,
        net_itc_impact=result.net_itc_impact,
        fuzzy_matches=result.fuzzy_matches,
        lines=[
            LineOut(
                status=row.status.value,
                match_pass=row.match_pass.value,
                supplier_name=row.supplier_name,
                supplier_gstin=row.supplier_gstin,
                invoice_no=row.invoice_no,
                invoice_date=row.invoice_date,
                books_ref=row.books.ref if row.books else None,
                portal_ref=row.portal.ref if row.portal else None,
                books_taxable=row.books.taxable if row.books else None,
                books_tax=row.books.tax if row.books else None,
                portal_taxable=row.portal.taxable if row.portal else None,
                portal_tax=row.portal.tax if row.portal else None,
                tax_difference=row.tax_difference,
                itc_at_risk=row.itc_at_risk,
                itc_unclaimed=row.itc_unclaimed,
                confidence=row.confidence,
                note=row.note,
            )
            for row in result.lines
        ],
    )
