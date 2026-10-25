"""Types for GSTR-2B reconciliation.

Vocabulary, because the domain terms are load-bearing:

**books**
    The client's own purchase register - what they have recorded and are
    claiming input tax credit on.
**portal / 2B**
    GSTR-2B, the government's auto-drafted statement of what the client's
    *suppliers* reported. This is the authoritative record of what ITC is
    actually available.
**ITC at risk**
    Credit the client has claimed in their books that the portal does not
    support. If this is wrong, the department disallows it and charges interest.
**Unclaimed ITC**
    The opposite: credit the portal shows but the books have not recorded. Money
    the client is entitled to and has not taken.

Those last two are both "mismatches" and they are *not the same problem*. One is
a liability, the other is an opportunity. Reporting them as a single number -
which the previous implementation did - makes the output useless for deciding
what to do.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum


class MatchStatus(StrEnum):
    """Mirrors ``app.models.enums.MatchStatus`` and the frontend's union."""

    MATCHED = "MATCHED"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    #: Portal has it, books do not. Unclaimed credit.
    MISSING_IN_BOOKS = "MISSING_IN_BOOKS"
    #: Books have it, portal does not. Credit at risk.
    MISSING_IN_2B = "MISSING_IN_2B"


class MatchPass(StrEnum):
    """Which rule paired two lines. Reported so a reviewer can judge how much
    to trust the pairing without reading the code."""

    #: GSTIN + normalised invoice number both equal.
    EXACT = "exact"
    #: Same supplier PAN and invoice number, different GSTIN - a supplier
    #: billing from a second state registration.
    PAN_LEVEL = "pan_level"
    #: GSTIN equal, invoice number similar, amount and date within tolerance.
    FUZZY_INVOICE = "fuzzy_invoice"
    #: No usable GSTIN, so matched on supplier name similarity plus amount.
    FUZZY_NAME = "fuzzy_name"
    UNMATCHED = "unmatched"


@dataclass(slots=True, frozen=True)
class InvoiceLine:
    """One purchase invoice, from either side.

    ``taxable`` and ``tax`` are separate because they fail differently: a
    taxable-value difference is usually a quantity or discount dispute, while a
    tax-only difference is almost always the wrong rate or a place-of-supply
    error. Collapsing them into one total hides which.
    """

    #: Caller's identifier - a journal entry id, a spreadsheet row number.
    ref: str
    supplier_name: str
    supplier_gstin: str | None
    invoice_no: str
    invoice_date: date | None
    taxable: Decimal
    tax: Decimal

    @property
    def total(self) -> Decimal:
        return self.taxable + self.tax


@dataclass(slots=True)
class Tolerance:
    """How much difference still counts as a match.

    Defaults chosen from how the numbers actually go wrong:

    ``amount_abs = 2``
        Rupee rounding. GST is computed per line and rounded per invoice, so
        books and portal routinely differ by a rupee or two on the same
        invoice. Flagging those would bury the real findings.
    ``amount_pct = 0.01``
        One percent, for larger invoices where rounding scales.
    ``date_window_days = 15``
        A supplier reporting an invoice in the following period is normal, not
        an error.
    ``invoice_similarity = 85``
        RapidFuzz score. Below this, two invoice numbers are different
        documents rather than one typed inconsistently.
    ``max_invoice_edits = 1``
        Accepted *as well as* the percentage, because a percentage alone
        penalises short invoice numbers for being short. ``AT101`` vs ``AT1O1``
        is one OCR substitution and scores 80%; the identical single typo in a
        ten-character number scores 90%. Edit distance measures the thing we
        actually care about - how many characters a human or an OCR engine got
        wrong - independently of length.
    """

    amount_abs: Decimal = Decimal("2.00")
    amount_pct: Decimal = Decimal("0.01")
    date_window_days: int = 15
    invoice_similarity: int = 85
    max_invoice_edits: int = 1
    name_similarity: int = 88

    def amounts_agree(self, a: Decimal, b: Decimal) -> bool:
        """Within the absolute floor OR the percentage, whichever is kinder."""
        difference = abs(a - b)
        if difference <= self.amount_abs:
            return True
        larger = max(abs(a), abs(b))
        if larger == 0:
            return difference == 0
        return (difference / larger) <= self.amount_pct


@dataclass(slots=True)
class MatchResult:
    """One line of the reconciliation output."""

    status: MatchStatus
    match_pass: MatchPass
    supplier_name: str
    supplier_gstin: str | None
    invoice_no: str
    invoice_date: date | None
    books: InvoiceLine | None
    portal: InvoiceLine | None
    #: 1.0 for an exact key match, lower for a heuristic pairing.
    confidence: float
    #: Why these two were paired, or why the line is unmatched. Written for a
    #: reviewer, not for a log.
    note: str

    @property
    def books_tax(self) -> Decimal:
        return self.books.tax if self.books else Decimal("0")

    @property
    def portal_tax(self) -> Decimal:
        return self.portal.tax if self.portal else Decimal("0")

    @property
    def tax_difference(self) -> Decimal:
        return self.portal_tax - self.books_tax

    @property
    def itc_at_risk(self) -> Decimal:
        """Credit claimed in the books that the portal does not support.

        Only the *excess* counts. If the books claim ₹18,000 and the portal
        shows ₹14,000, ₹4,000 is at risk - not the whole ₹18,000, because
        ₹14,000 of it is properly supported.
        """
        if self.status is MatchStatus.MISSING_IN_2B:
            return self.books_tax
        if self.status is MatchStatus.AMOUNT_MISMATCH:
            return max(Decimal("0"), self.books_tax - self.portal_tax)
        return Decimal("0")

    @property
    def itc_unclaimed(self) -> Decimal:
        """Credit the portal supports that the books have not taken.

        Money the client is owed. Worth surfacing separately because the action
        is the opposite of the at-risk case: claim it, rather than reverse it.
        """
        if self.status is MatchStatus.MISSING_IN_BOOKS:
            return self.portal_tax
        if self.status is MatchStatus.AMOUNT_MISMATCH:
            return max(Decimal("0"), self.portal_tax - self.books_tax)
        return Decimal("0")


@dataclass(slots=True)
class ReconSummary:
    """Totals for a run."""

    period: str
    total_lines: int = 0
    matched: int = 0
    amount_mismatch: int = 0
    missing_in_books: int = 0
    missing_in_2b: int = 0

    books_taxable_total: Decimal = Decimal("0")
    books_tax_total: Decimal = Decimal("0")
    portal_taxable_total: Decimal = Decimal("0")
    portal_tax_total: Decimal = Decimal("0")

    itc_at_risk: Decimal = Decimal("0")
    itc_unclaimed: Decimal = Decimal("0")

    #: Pairings that needed a heuristic. These are the lines a reviewer should
    #: confirm even though the matcher considers them matched.
    fuzzy_matches: int = 0

    lines: list[MatchResult] = field(default_factory=list)

    @property
    def mismatched(self) -> int:
        return self.amount_mismatch + self.missing_in_books + self.missing_in_2b

    @property
    def match_rate(self) -> float:
        return self.matched / self.total_lines if self.total_lines else 0.0

    @property
    def net_itc_impact(self) -> Decimal:
        """Unclaimed minus at-risk. Positive means the client is under-claiming
        overall; negative means they are over-claiming."""
        return self.itc_unclaimed - self.itc_at_risk

    def headline(self) -> str:
        return (
            f"{self.period}: {self.total_lines} invoices, "
            f"{self.matched} matched ({self.match_rate:.0%}), "
            f"{self.mismatched} to resolve · "
            f"ITC at risk Rs {self.itc_at_risk:,.2f} · "
            f"unclaimed Rs {self.itc_unclaimed:,.2f}"
        )
