"""GSTR-2B reconciliation, persisted - Module 5.

The matcher (app/ml/recon) is pure. This module supplies its two inputs and
stores its output:

* **Portal side** - GSTR-2B as downloaded from the GST portal (JSON), or any
  CSV/XLSX with recognisable columns.
* **Books side** - either an uploaded purchase register, or the purchase
  invoices this firm has already uploaded and a person has *verified*. The
  latter is the real pipeline: upload invoice -> extract -> verify ->
  reconcile. Unverified extractions are deliberately excluded; reconciling
  against a guess would make the ITC figure a guess.

A stored run is evidence of the position when it was run. Re-running the same
client and period therefore needs an explicit ``replace`` - the previous result
is not silently rewritten.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.recon.matcher import reconcile
from app.ml.recon.types import InvoiceLine, Tolerance
from app.models.compliance import GstReconciliation, GstReconciliationLine
from app.models.enums import DocumentKind, DocumentStatus, ReconRunStatus
from app.models.enums import MatchStatus as DbMatchStatus
from app.models.practice import Document, DocumentExtraction
from app.utils.identifiers import normalise_invoice_no
from app.utils.periods import month_bounds
from app.utils.tabular import TableError, parse_amount, parse_date, pick, read_table


class SourceError(ValueError):
    """An input file could not be turned into invoice lines. User-facing."""


# ------------------------------------------------------------ portal side ---


def _money(value) -> Decimal:
    amount = parse_amount(value)
    return amount if amount is not None else Decimal("0")


def _portal_date(value: str | None) -> date | None:
    # The portal writes dd-mm-yyyy; parse_date is day-first already.
    return parse_date(value)


def parse_gstr2b_json(data: bytes) -> tuple[list[InvoiceLine], dict]:
    """Lines from the GST portal's GSTR-2B JSON download.

    Reads ``docdata.b2b[].inv[]``. Invoice-level ``txval``/``igst``/``cgst``/
    ``sgst``/``cess`` are used when present; otherwise the ``items`` array is
    summed - both layouts occur in practice.

    Credit and debit notes (``cdnr``) are counted and reported but not
    reconciled: matching a note to the invoice it amends needs the original
    invoice reference, which the books side rarely carries.
    """
    try:
        payload = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SourceError("GSTR-2B file is not valid JSON") from exc

    root = payload.get("data", payload) if isinstance(payload, dict) else {}
    docdata = root.get("docdata", root)
    b2b = docdata.get("b2b")
    if not isinstance(b2b, list):
        raise SourceError("No b2b section found - is this a GSTR-2B JSON download?")

    lines: list[InvoiceLine] = []
    for supplier in b2b:
        gstin = (supplier.get("ctin") or "").strip().upper() or None
        name = (supplier.get("trdnm") or gstin or "Unknown supplier").strip()
        for index, inv in enumerate(supplier.get("inv") or []):
            items = inv.get("items") or []

            def amount(key: str, inv=inv, items=items) -> Decimal:
                if inv.get(key) is not None:
                    return _money(inv.get(key))
                return sum((_money(item.get(key)) for item in items), Decimal("0"))

            tax = amount("igst") + amount("cgst") + amount("sgst") + amount("cess")
            invoice_no = str(inv.get("inum") or "").strip()
            if not invoice_no:
                continue
            lines.append(
                InvoiceLine(
                    ref=f"2b:{gstin}:{invoice_no}:{index}",
                    supplier_name=name,
                    supplier_gstin=gstin,
                    invoice_no=invoice_no,
                    invoice_date=_portal_date(inv.get("dt")),
                    taxable=amount("txval"),
                    tax=tax,
                )
            )

    meta = {
        "source": "gstr2b_json",
        "return_period": root.get("rtnprd"),
        "recipient_gstin": root.get("gstin"),
        "credit_notes_not_reconciled": sum(
            len(s.get("nt") or []) for s in (docdata.get("cdnr") or [])
        ),
    }
    return lines, meta


def parse_register(data: bytes, filename: str, *, side: str) -> tuple[list[InvoiceLine], dict]:
    """Lines from a CSV/XLSX purchase register or 2B export.

    Tax may arrive as one column or split into IGST/CGST/SGST/cess; both work.
    """
    try:
        rows = read_table(data, filename)
    except TableError as exc:
        raise SourceError(str(exc)) from exc

    lines: list[InvoiceLine] = []
    skipped = 0
    for row_no, row in enumerate(rows, start=2):
        invoice_no = pick(row, "invoice no", "invoice number", "inv no", "invoice", "bill no", "inum")
        if not invoice_no:
            skipped += 1
            continue
        tax_total = parse_amount(pick(row, "tax", "total tax", "gst", "tax amount"))
        if tax_total is None:
            tax_total = sum(
                (
                    _money(pick(row, column))
                    for column in ("igst", "integrated tax", "cgst", "central tax", "sgst", "state tax", "utgst", "cess")
                ),
                Decimal("0"),
            )
        gstin = pick(row, "gstin", "supplier gstin", "gstin of supplier", "ctin").upper() or None
        lines.append(
            InvoiceLine(
                ref=f"{side}:{row_no}",
                supplier_name=pick(row, "supplier", "supplier name", "trade name", "party", "vendor", "trdnm")
                or (gstin or "Unknown supplier"),
                supplier_gstin=gstin,
                invoice_no=invoice_no.strip(),
                invoice_date=parse_date(pick(row, "invoice date", "date", "inv date", "dt")),
                taxable=_money(pick(row, "taxable", "taxable value", "taxable amount", "txval")),
                tax=tax_total,
            )
        )
    return lines, {"source": f"{side}_register", "rows_without_invoice_no": skipped}


def read_source(data: bytes, filename: str, *, side: str) -> tuple[list[InvoiceLine], dict]:
    if filename.lower().endswith(".json"):
        if side != "portal":
            raise SourceError("A JSON file is only accepted for the GSTR-2B side")
        return parse_gstr2b_json(data)
    return parse_register(data, filename, side=side)


# ------------------------------------------------------------- books side ---


def books_from_documents(
    session: Session, *, client_id: uuid.UUID, period: str
) -> tuple[list[InvoiceLine], dict]:
    """Verified purchase invoices whose invoice date falls in ``period``.

    Human corrections win over the extractor's values - that is the whole
    point of the verification step.
    """
    start, end = month_bounds(period)
    rows = session.execute(
        select(Document, DocumentExtraction)
        .join(DocumentExtraction, DocumentExtraction.document_id == Document.id)
        .where(
            Document.client_id == client_id,
            Document.kind == DocumentKind.PURCHASE_INVOICE,
            Document.status == DocumentStatus.VERIFIED,
            Document.deleted_at.is_(None),
        )
    ).all()

    lines: list[InvoiceLine] = []
    for document, extraction in rows:
        fields = {**(extraction.fields or {}), **(extraction.corrected_fields or {})}
        invoice_date = parse_date(fields.get("invoice_date"))
        if invoice_date is None or not (start <= invoice_date <= end):
            continue
        if not fields.get("invoice_no"):
            continue
        tax = parse_amount(fields.get("total_tax"))
        if tax is None:
            tax = sum((_money(fields.get(k)) for k in ("igst", "cgst", "sgst", "cess")), Decimal("0"))
        lines.append(
            InvoiceLine(
                ref=f"doc:{document.id}",
                supplier_name=fields.get("supplier_name") or fields.get("supplier_gstin") or "Unknown",
                supplier_gstin=(fields.get("supplier_gstin") or "").upper() or None,
                invoice_no=str(fields["invoice_no"]),
                invoice_date=invoice_date,
                taxable=_money(fields.get("taxable_value")),
                tax=tax,
            )
        )
    return lines, {"source": "verified_documents", "documents": len(lines)}


# ---------------------------------------------------------------- the run ---


@dataclass(slots=True)
class RunTotals:
    itc_unclaimed: Decimal
    fuzzy_matches: int
    match_rate: float


def totals_from_lines(lines: list[GstReconciliationLine]) -> RunTotals:
    """Figures the run table does not store, derived from the stored lines.

    Derived from what was persisted, not by re-running the matcher, so a
    historic run still reports its own position.
    """
    unclaimed = Decimal("0")
    fuzzy = 0
    matched = 0
    for line in lines:
        books_tax = line.books_tax or Decimal("0")
        portal_tax = line.portal_tax or Decimal("0")
        if line.status is DbMatchStatus.MISSING_IN_BOOKS:
            unclaimed += portal_tax
        elif line.status is DbMatchStatus.AMOUNT_MISMATCH:
            unclaimed += max(Decimal("0"), portal_tax - books_tax)
        if line.status is DbMatchStatus.MATCHED:
            matched += 1
            if line.match_pass not in (None, "exact"):
                fuzzy += 1
    return RunTotals(
        itc_unclaimed=unclaimed,
        fuzzy_matches=fuzzy,
        match_rate=matched / len(lines) if lines else 0.0,
    )


def run_reconciliation(
    session: Session,
    *,
    firm_id: uuid.UUID,
    client_id: uuid.UUID,
    period: str,
    books: list[InvoiceLine],
    portal: list[InvoiceLine],
    tolerance: Tolerance,
    sources: dict,
    replace: bool,
) -> GstReconciliation:
    existing = session.execute(
        select(GstReconciliation).where(
            GstReconciliation.client_id == client_id, GstReconciliation.period == period
        )
    ).scalar_one_or_none()
    if existing is not None and not replace:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A reconciliation for {period} already exists. Pass replace=true to "
                "overwrite it - the existing result is evidence and is not rewritten silently."
            ),
        )
    if existing is not None:
        session.delete(existing)
        session.flush()

    started = datetime.now(UTC)
    result = reconcile(books, portal, period=period, tolerance=tolerance)

    run = GstReconciliation(
        firm_id=firm_id,
        client_id=client_id,
        period=period,
        status=ReconRunStatus.COMPLETED,
        total_lines=result.total_lines,
        matched_lines=result.matched,
        mismatched_lines=result.mismatched,
        itc_at_risk=result.itc_at_risk,
        books_tax_total=result.books_tax_total,
        portal_tax_total=result.portal_tax_total,
        parameters={
            "tolerance": {
                "amount_abs": str(tolerance.amount_abs),
                "amount_pct": str(tolerance.amount_pct),
                "date_window_days": tolerance.date_window_days,
                "invoice_similarity": tolerance.invoice_similarity,
                "max_invoice_edits": tolerance.max_invoice_edits,
                "name_similarity": tolerance.name_similarity,
            },
            "sources": sources,
            "books_lines": len(books),
            "portal_lines": len(portal),
        },
        started_at=started,
        completed_at=datetime.now(UTC),
    )
    session.add(run)
    session.flush()

    for line in result.lines:
        session.add(
            GstReconciliationLine(
                reconciliation_id=run.id,
                supplier_name=line.supplier_name[:255],
                supplier_gstin=line.supplier_gstin,
                invoice_no=line.invoice_no[:50],
                invoice_no_key=normalise_invoice_no(line.invoice_no)[:50],
                invoice_date=line.invoice_date,
                books_taxable=line.books.taxable if line.books else None,
                books_tax=line.books.tax if line.books else None,
                portal_taxable=line.portal.taxable if line.portal else None,
                portal_tax=line.portal.tax if line.portal else None,
                status=DbMatchStatus(line.status.value),
                confidence=Decimal(f"{line.confidence:.4f}"),
                match_pass=line.match_pass.value,
                match_note=line.note,
            )
        )
    return run
