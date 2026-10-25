"""GSTR-2B reconciliation engine.

Deliberately **not** machine learning, and that is the design decision worth
defending. A CA signs a return on the back of this output and may have to
justify it to the department. "The model scored this pairing 0.83" is not a
defence; "GSTIN equal, invoice number 94% similar, dates 3 days apart, amounts
within ₹1" is. Every pairing here is produced by a stated rule and carries the
reason in ``MatchResult.note``.

Four passes, strictest first:

1. ``EXACT`` - GSTIN and normalised invoice number both equal.
2. ``PAN_LEVEL`` - same supplier PAN, same invoice number, different GSTIN. A
   supplier billing from a second state registration.
3. ``FUZZY_INVOICE`` - GSTIN equal, invoice number similar, amount and date
   within tolerance. Catches typos and OCR errors in the invoice number.
4. ``FUZZY_NAME`` - no usable GSTIN on one side, so supplier name similarity
   plus amount and date. The weakest pass, and flagged as such.

Matching is **one-to-one**: a portal invoice already claimed by one books line
cannot be claimed by another. Within the fuzzy passes, candidate pairs are
scored and assigned greedily best-first, rather than first-come - otherwise the
order of rows in the input file changes the result, which would be indefensible
in a review.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date

from rapidfuzz import fuzz
from rapidfuzz.distance import Levenshtein

from app.ml.recon.types import (
    InvoiceLine,
    MatchPass,
    MatchResult,
    MatchStatus,
    ReconSummary,
    Tolerance,
)
from app.utils.identifiers import normalise_invoice_no, normalise_name, pan_from_gstin

logger = logging.getLogger(__name__)


def _date_gap(a: date | None, b: date | None) -> int | None:
    if a is None or b is None:
        return None
    return abs((a - b).days)


def _classify(books: InvoiceLine, portal: InvoiceLine, tolerance: Tolerance) -> MatchStatus:
    """A paired line is MATCHED only if taxable AND tax both agree."""
    if tolerance.amounts_agree(books.taxable, portal.taxable) and tolerance.amounts_agree(
        books.tax, portal.tax
    ):
        return MatchStatus.MATCHED
    return MatchStatus.AMOUNT_MISMATCH


def _pair_note(
    books: InvoiceLine,
    portal: InvoiceLine,
    match_pass: MatchPass,
    *,
    invoice_score: float | None = None,
    invoice_edits: int | None = None,
    name_score: float | None = None,
) -> str:
    """The sentence a reviewer reads instead of trusting a number."""
    parts: list[str] = []

    if match_pass is MatchPass.EXACT:
        parts.append("GSTIN and invoice number both match exactly")
    elif match_pass is MatchPass.PAN_LEVEL:
        parts.append(
            f"same supplier PAN but different GSTIN "
            f"({books.supplier_gstin} in books, {portal.supplier_gstin} on the portal)"
        )
    elif match_pass is MatchPass.FUZZY_INVOICE:
        # Lead with the edit count when it is small: "differs by 1 character"
        # is a far clearer justification than "80% similar".
        if invoice_edits is not None and invoice_edits <= 2:
            detail = f"differs by {invoice_edits} character{'s' if invoice_edits != 1 else ''}"
        else:
            detail = f"{invoice_score:.0f}% similar"
        parts.append(
            f"GSTIN matches, invoice number {detail} "
            f"({books.invoice_no!r} vs {portal.invoice_no!r})"
        )
    elif match_pass is MatchPass.FUZZY_NAME:
        parts.append(
            f"no usable GSTIN; supplier name {name_score:.0f}% similar "
            f"({books.supplier_name!r} vs {portal.supplier_name!r})"
        )

    gap = _date_gap(books.invoice_date, portal.invoice_date)
    if gap is not None and gap > 0:
        parts.append(f"dates {gap} day{'s' if gap != 1 else ''} apart")

    taxable_diff = portal.taxable - books.taxable
    tax_diff = portal.tax - books.tax
    if taxable_diff or tax_diff:
        parts.append(
            f"portal is Rs {taxable_diff:+,.2f} taxable / Rs {tax_diff:+,.2f} tax "
            f"against the books"
        )
    else:
        parts.append("amounts identical")

    return "; ".join(parts)


def reconcile(
    books: list[InvoiceLine],
    portal: list[InvoiceLine],
    *,
    period: str = "",
    tolerance: Tolerance | None = None,
) -> ReconSummary:
    """Reconcile a purchase register against GSTR-2B.

    Returns every line from both sides exactly once: matched pairs, amount
    mismatches, and the unmatched remainder from each side.
    """
    tol = tolerance or Tolerance()
    summary = ReconSummary(period=period)

    # Portal lines still available to be claimed. Indexed by ref because the
    # same (gstin, invoice) key can legitimately appear twice - a supplier
    # issuing two invoices with the same number in different years does happen.
    unclaimed_portal: dict[str, InvoiceLine] = {line.ref: line for line in portal}
    unmatched_books: list[InvoiceLine] = []

    if len(unclaimed_portal) != len(portal):
        logger.warning(
            "portal input has duplicate refs; %d of %d lines will be ignored",
            len(portal) - len(unclaimed_portal),
            len(portal),
        )

    # ---------------------------------------------------- pass 1: exact ----
    exact_index: dict[tuple[str, str], list[str]] = defaultdict(list)
    for line in portal:
        gstin = (line.supplier_gstin or "").upper()
        if gstin:
            exact_index[(gstin, normalise_invoice_no(line.invoice_no))].append(line.ref)

    for book_line in books:
        gstin = (book_line.supplier_gstin or "").upper()
        key = (gstin, normalise_invoice_no(book_line.invoice_no))
        claimed = None
        if gstin:
            for ref in exact_index.get(key, []):
                if ref in unclaimed_portal:
                    claimed = unclaimed_portal.pop(ref)
                    break
        if claimed is not None:
            summary.lines.append(
                _build_pair(book_line, claimed, MatchPass.EXACT, tol, confidence=1.0)
            )
        else:
            unmatched_books.append(book_line)

    # ------------------------------------------------- pass 2: PAN level ---
    # A supplier registered in two states has two GSTINs sharing one PAN. The
    # invoice number is still theirs, so PAN + invoice number is a safe key.
    pan_index: dict[tuple[str, str], list[str]] = defaultdict(list)
    for ref, line in unclaimed_portal.items():
        pan = pan_from_gstin(line.supplier_gstin or "")
        if pan:
            pan_index[(pan, normalise_invoice_no(line.invoice_no))].append(ref)

    still_unmatched: list[InvoiceLine] = []
    for book_line in unmatched_books:
        pan = pan_from_gstin(book_line.supplier_gstin or "")
        claimed = None
        if pan:
            key = (pan, normalise_invoice_no(book_line.invoice_no))
            for ref in pan_index.get(key, []):
                if ref in unclaimed_portal:
                    claimed = unclaimed_portal.pop(ref)
                    break
        if claimed is not None:
            summary.lines.append(
                _build_pair(book_line, claimed, MatchPass.PAN_LEVEL, tol, confidence=0.95)
            )
        else:
            still_unmatched.append(book_line)
    unmatched_books = still_unmatched

    # --------------------------------- passes 3 and 4: scored, best-first ---
    # Score every plausible pair, then assign in descending score order. Greedy
    # best-first rather than first-come, so the result does not depend on the
    # order of rows in the uploaded file.
    candidates: list[tuple[float, MatchPass, InvoiceLine, str, dict]] = []

    for book_line in unmatched_books:
        book_gstin = (book_line.supplier_gstin or "").upper()
        book_invoice = normalise_invoice_no(book_line.invoice_no)
        book_name = normalise_name(book_line.supplier_name)

        for ref, portal_line in unclaimed_portal.items():
            portal_gstin = (portal_line.supplier_gstin or "").upper()
            gap = _date_gap(book_line.invoice_date, portal_line.invoice_date)
            if gap is not None and gap > tol.date_window_days:
                continue

            # The total must be close, whichever pass we are in. Without this,
            # supplier-name similarity alone pairs unrelated invoices.
            if not tol.amounts_agree(book_line.total, portal_line.total):
                continue

            if book_gstin and book_gstin == portal_gstin:
                portal_invoice = normalise_invoice_no(portal_line.invoice_no)
                score = fuzz.ratio(book_invoice, portal_invoice)
                edits = Levenshtein.distance(book_invoice, portal_invoice)
                # Either test is sufficient. See Tolerance.max_invoice_edits
                # for why the percentage alone is not enough on short numbers.
                if score >= tol.invoice_similarity or edits <= tol.max_invoice_edits:
                    candidates.append(
                        (
                            score,
                            MatchPass.FUZZY_INVOICE,
                            book_line,
                            ref,
                            {"invoice_score": score, "invoice_edits": edits},
                        )
                    )
                continue

            # Name-based matching only where a GSTIN is genuinely unavailable.
            # Two different GSTINs that both exist mean two different
            # registrations, and pairing them on name would be wrong.
            if not book_gstin or not portal_gstin:
                score = fuzz.token_set_ratio(
                    book_name, normalise_name(portal_line.supplier_name)
                )
                if score >= tol.name_similarity:
                    candidates.append(
                        (
                            score - 10,  # rank below any invoice-number match
                            MatchPass.FUZZY_NAME,
                            book_line,
                            ref,
                            {"name_score": score},
                        )
                    )

    candidates.sort(key=lambda row: row[0], reverse=True)

    consumed_books: set[str] = set()
    for score, match_pass, book_line, portal_ref, extra in candidates:
        if book_line.ref in consumed_books or portal_ref not in unclaimed_portal:
            continue
        portal_line = unclaimed_portal.pop(portal_ref)
        consumed_books.add(book_line.ref)
        summary.lines.append(
            _build_pair(
                book_line,
                portal_line,
                match_pass,
                tol,
                confidence=round(score / 100.0, 4),
                **extra,
            )
        )

    # ------------------------------------------------------- the remainder --
    for book_line in unmatched_books:
        if book_line.ref in consumed_books:
            continue
        summary.lines.append(
            MatchResult(
                status=MatchStatus.MISSING_IN_2B,
                match_pass=MatchPass.UNMATCHED,
                supplier_name=book_line.supplier_name,
                supplier_gstin=book_line.supplier_gstin,
                invoice_no=book_line.invoice_no,
                invoice_date=book_line.invoice_date,
                books=book_line,
                portal=None,
                confidence=1.0,
                note=(
                    "In the books but not in GSTR-2B. The supplier has not reported "
                    f"it, so the Rs {book_line.tax:,.2f} credit is not available yet. "
                    "Chase the supplier, or reverse the claim."
                ),
            )
        )

    for portal_line in unclaimed_portal.values():
        summary.lines.append(
            MatchResult(
                status=MatchStatus.MISSING_IN_BOOKS,
                match_pass=MatchPass.UNMATCHED,
                supplier_name=portal_line.supplier_name,
                supplier_gstin=portal_line.supplier_gstin,
                invoice_no=portal_line.invoice_no,
                invoice_date=portal_line.invoice_date,
                books=None,
                portal=portal_line,
                confidence=1.0,
                note=(
                    "In GSTR-2B but not in the books. This is credit of "
                    f"Rs {portal_line.tax:,.2f} the client is entitled to and has "
                    "not taken - record the purchase."
                ),
            )
        )

    _tally(summary)
    return summary


def _build_pair(
    books: InvoiceLine,
    portal: InvoiceLine,
    match_pass: MatchPass,
    tolerance: Tolerance,
    *,
    confidence: float,
    invoice_score: float | None = None,
    invoice_edits: int | None = None,
    name_score: float | None = None,
) -> MatchResult:
    status = _classify(books, portal, tolerance)
    return MatchResult(
        status=status,
        match_pass=match_pass,
        # Prefer the portal's spelling of the supplier: it comes from the
        # GSTN registry, whereas the books hold whatever someone typed.
        supplier_name=portal.supplier_name or books.supplier_name,
        supplier_gstin=portal.supplier_gstin or books.supplier_gstin,
        invoice_no=books.invoice_no,
        invoice_date=books.invoice_date or portal.invoice_date,
        books=books,
        portal=portal,
        confidence=confidence,
        note=_pair_note(
            books,
            portal,
            match_pass,
            invoice_score=invoice_score,
            invoice_edits=invoice_edits,
            name_score=name_score,
        ),
    )


def _tally(summary: ReconSummary) -> None:
    for line in summary.lines:
        summary.total_lines += 1

        if line.status is MatchStatus.MATCHED:
            summary.matched += 1
        elif line.status is MatchStatus.AMOUNT_MISMATCH:
            summary.amount_mismatch += 1
        elif line.status is MatchStatus.MISSING_IN_BOOKS:
            summary.missing_in_books += 1
        elif line.status is MatchStatus.MISSING_IN_2B:
            summary.missing_in_2b += 1

        if line.match_pass in (MatchPass.FUZZY_INVOICE, MatchPass.FUZZY_NAME):
            summary.fuzzy_matches += 1

        if line.books:
            summary.books_taxable_total += line.books.taxable
            summary.books_tax_total += line.books.tax
        if line.portal:
            summary.portal_taxable_total += line.portal.taxable
            summary.portal_tax_total += line.portal.tax

        summary.itc_at_risk += line.itc_at_risk
        summary.itc_unclaimed += line.itc_unclaimed

    # Worst first: biggest exposure at the top of the review queue, since that
    # is the order a person should work them in.
    priority = {
        MatchStatus.MISSING_IN_2B: 0,
        MatchStatus.AMOUNT_MISMATCH: 1,
        MatchStatus.MISSING_IN_BOOKS: 2,
        MatchStatus.MATCHED: 3,
    }
    summary.lines.sort(
        key=lambda line: (
            priority[line.status],
            -float(max(line.itc_at_risk, line.itc_unclaimed)),
        )
    )
