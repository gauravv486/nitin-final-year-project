"""GSTR-2B reconciliation.

These are the tests that matter most in the project: a CA signs a return on
this output. A matcher that silently drops a line, double-claims a portal
invoice, or reports order-dependent results would produce a wrong return.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.ml.recon.matcher import reconcile
from app.ml.recon.types import InvoiceLine, MatchPass, MatchStatus, Tolerance


def line(
    ref: str,
    supplier: str,
    gstin: str | None,
    invoice: str,
    taxable: str,
    tax: str,
    day: int = 10,
) -> InvoiceLine:
    return InvoiceLine(
        ref=ref,
        supplier_name=supplier,
        supplier_gstin=gstin,
        invoice_no=invoice,
        invoice_date=date(2026, 9, day),
        taxable=Decimal(taxable),
        tax=Decimal(tax),
    )


GSTIN_A = "27AACCD1122E1Z9"
GSTIN_B = "24AAFFM5678K1Z2"


class TestExactMatch:
    def test_identical_lines_match(self) -> None:
        books = [line("b1", "Deepak Steel", GSTIN_A, "DS/2026/0441", "450000", "81000")]
        portal = [line("p1", "Deepak Steel", GSTIN_A, "DS/2026/0441", "450000", "81000")]

        result = reconcile(books, portal, period="2026-09")

        assert result.total_lines == 1
        assert result.matched == 1
        assert result.itc_at_risk == Decimal("0")
        assert result.lines[0].match_pass is MatchPass.EXACT
        assert result.lines[0].confidence == 1.0

    def test_invoice_punctuation_is_ignored(self) -> None:
        """``DS/2026/0441`` and ``ds-2026-0441`` are one invoice.

        Without normalisation this is a false mismatch, and false mismatches
        are what make a reconciliation tool useless - the reviewer stops
        trusting the output and checks everything by hand.
        """
        books = [line("b1", "Deepak Steel", GSTIN_A, "DS/2026/0441", "450000", "81000")]
        portal = [line("p1", "Deepak Steel", GSTIN_A, "ds-2026-0441", "450000", "81000")]

        assert reconcile(books, portal).matched == 1


class TestAmountMismatch:
    def test_tax_difference_is_flagged(self) -> None:
        books = [line("b1", "Mehta Packaging", GSTIN_B, "MP-8891", "75000", "13500")]
        portal = [line("p1", "Mehta Packaging", GSTIN_B, "MP-8891", "78500", "14130")]

        result = reconcile(books, portal)
        row = result.lines[0]

        assert row.status is MatchStatus.AMOUNT_MISMATCH
        # The books claim LESS than the portal allows, so nothing is at risk -
        # the shortfall is unclaimed credit.
        assert row.itc_at_risk == Decimal("0")
        assert row.itc_unclaimed == Decimal("630")

    def test_over_claim_is_at_risk(self) -> None:
        """The dangerous direction: books claim more than the portal supports.

        Only the excess is at risk, not the whole claim - ₹14,130 of it is
        properly supported.
        """
        books = [line("b1", "Mehta Packaging", GSTIN_B, "MP-8891", "78500", "18000")]
        portal = [line("p1", "Mehta Packaging", GSTIN_B, "MP-8891", "78500", "14130")]

        row = reconcile(books, portal).lines[0]

        assert row.status is MatchStatus.AMOUNT_MISMATCH
        assert row.itc_at_risk == Decimal("3870")
        assert row.itc_unclaimed == Decimal("0")

    def test_rupee_rounding_is_not_a_mismatch(self) -> None:
        """GST is rounded per invoice, so a one-rupee gap on the same invoice
        is normal. Flagging it would bury the real findings."""
        books = [line("b1", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000")]
        portal = [line("p1", "Deepak Steel", GSTIN_A, "DS/0441", "450001", "81001")]

        assert reconcile(books, portal).matched == 1

    def test_percentage_tolerance_scales(self) -> None:
        # ₹50 on ₹10,00,000 is 0.005% - inside the 1% band.
        books = [line("b1", "Big Supplier", GSTIN_A, "INV-1", "1000000", "180000")]
        portal = [line("p1", "Big Supplier", GSTIN_A, "INV-1", "1000050", "180000")]

        assert reconcile(books, portal).matched == 1

    def test_taxable_agreeing_but_tax_not_is_still_a_mismatch(self) -> None:
        """Usually the wrong rate or a place-of-supply error. Collapsing
        taxable and tax into one total would hide it."""
        books = [line("b1", "X", GSTIN_A, "INV-1", "100000", "18000")]
        portal = [line("p1", "X", GSTIN_A, "INV-1", "100000", "5000")]

        assert reconcile(books, portal).lines[0].status is MatchStatus.AMOUNT_MISMATCH


class TestUnmatched:
    def test_books_only_is_itc_at_risk(self) -> None:
        books = [line("b1", "Vector Office", GSTIN_A, "VOS/1120", "128000", "23040")]

        result = reconcile(books, [])

        assert result.missing_in_2b == 1
        assert result.itc_at_risk == Decimal("23040")
        assert result.itc_unclaimed == Decimal("0")

    def test_portal_only_is_unclaimed_credit(self) -> None:
        """The opposite problem, and the opposite action: claim it, not reverse
        it. Reporting both as one 'mismatch' number makes the output
        undecidable."""
        portal = [line("p1", "Sunrise Chemicals", GSTIN_A, "SC-307", "96000", "17280")]

        result = reconcile([], portal)

        assert result.missing_in_books == 1
        assert result.itc_unclaimed == Decimal("17280")
        assert result.itc_at_risk == Decimal("0")

    def test_every_input_line_appears_exactly_once(self) -> None:
        """The invariant that stops a silent data loss bug.

        Two matched pairs plus one orphan each side = 4 output lines covering
        6 input lines.
        """
        books = [
            line("b1", "A", GSTIN_A, "INV-1", "1000", "180"),
            line("b2", "B", GSTIN_B, "INV-2", "2000", "360"),
            line("b3", "C", GSTIN_A, "INV-3", "3000", "540"),
        ]
        portal = [
            line("p1", "A", GSTIN_A, "INV-1", "1000", "180"),
            line("p2", "B", GSTIN_B, "INV-2", "2000", "360"),
            line("p4", "D", GSTIN_B, "INV-4", "4000", "720"),
        ]

        result = reconcile(books, portal)

        assert result.total_lines == 4
        seen_books = {r.books.ref for r in result.lines if r.books}
        seen_portal = {r.portal.ref for r in result.lines if r.portal}
        assert seen_books == {"b1", "b2", "b3"}
        assert seen_portal == {"p1", "p2", "p4"}


class TestOneToOne:
    def test_a_portal_invoice_cannot_be_claimed_twice(self) -> None:
        """Two books lines, one portal line. Exactly one may match.

        Without this, a duplicated purchase entry would appear fully supported
        and the duplicate ITC claim would go undetected - which is precisely
        the error the reconciliation exists to catch.
        """
        books = [
            line("b1", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000"),
            line("b2", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000"),
        ]
        portal = [line("p1", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000")]

        result = reconcile(books, portal)

        assert result.matched == 1
        assert result.missing_in_2b == 1
        assert result.itc_at_risk == Decimal("81000")


class TestDeterminism:
    def test_result_does_not_depend_on_input_order(self) -> None:
        """Greedy best-first assignment, not first-come.

        If row order changed the outcome, two people reconciling the same
        period from the same files would get different answers.
        """
        books = [
            line("b1", "Alpha Traders", GSTIN_A, "AT-100", "10000", "1800"),
            line("b2", "Alpha Traders", GSTIN_A, "AT-101", "10000", "1800"),
        ]
        portal = [
            line("p1", "Alpha Traders", GSTIN_A, "AT-100", "10000", "1800"),
            line("p2", "Alpha Traders", GSTIN_A, "AT-1O1", "10000", "1800"),  # O for 0
        ]

        forward = reconcile(books, portal)
        reversed_ = reconcile(list(reversed(books)), list(reversed(portal)))

        assert forward.matched == reversed_.matched
        assert forward.itc_at_risk == reversed_.itc_at_risk
        assert forward.total_lines == reversed_.total_lines


class TestFuzzyPasses:
    def test_ocr_typo_in_invoice_number_still_matches(self) -> None:
        """``AT-1O1`` (letter O) vs ``AT-101`` (zero) - a classic OCR
        substitution. GSTIN and amount agree, so it is the same invoice."""
        books = [line("b1", "Alpha", GSTIN_A, "AT-101", "10000", "1800")]
        portal = [line("p1", "Alpha", GSTIN_A, "AT-1O1", "10000", "1800")]

        result = reconcile(books, portal)
        row = result.lines[0]

        assert row.status is MatchStatus.MATCHED
        assert row.match_pass is MatchPass.FUZZY_INVOICE
        assert row.confidence < 1.0, "a heuristic pairing must not claim full confidence"
        assert result.fuzzy_matches == 1

    def test_pan_level_match_across_two_state_registrations(self) -> None:
        """One supplier, two GSTINs sharing a PAN. The invoice number is still
        theirs, so PAN + invoice number is a safe key."""
        maharashtra = "27AACCD1122E1Z9"
        gujarat = "24AACCD1122E1Z3"  # same PAN, different state
        books = [line("b1", "Deepak Steel", maharashtra, "DS/0441", "450000", "81000")]
        portal = [line("p1", "Deepak Steel", gujarat, "DS/0441", "450000", "81000")]

        row = reconcile(books, portal).lines[0]

        assert row.status is MatchStatus.MATCHED
        assert row.match_pass is MatchPass.PAN_LEVEL

    def test_two_real_but_different_gstins_never_match_on_name(self) -> None:
        """Two valid, different GSTINs mean two different registrations.

        Name similarity must not override that - they are separate taxable
        persons and the credit belongs to one of them.
        """
        books = [line("b1", "Acme Traders", GSTIN_A, "INV-1", "10000", "1800")]
        portal = [line("p1", "Acme Traders", GSTIN_B, "INV-1", "10000", "1800")]

        result = reconcile(books, portal)

        assert result.matched == 0
        assert result.missing_in_2b == 1
        assert result.missing_in_books == 1

    def test_name_match_only_when_a_gstin_is_absent(self) -> None:
        books = [line("b1", "Sunrise Chemicals Pvt Ltd", None, "SC-307", "96000", "17280")]
        portal = [line("p1", "Sunrise Chemicals", GSTIN_A, "SC-307", "96000", "17280")]

        row = reconcile(books, portal).lines[0]

        assert row.status is MatchStatus.MATCHED
        assert row.match_pass is MatchPass.FUZZY_NAME

    def test_unrelated_invoices_of_equal_value_do_not_match(self) -> None:
        """Equal amounts are not evidence. Without the name/invoice gate, every
        ₹10,000 invoice in a period would pair with every other one."""
        books = [line("b1", "Alpha Traders", None, "AT-1", "10000", "1800")]
        portal = [line("p1", "Zeta Industries", None, "ZI-9", "10000", "1800")]

        assert reconcile(books, portal).matched == 0

    def test_date_outside_the_window_does_not_match(self) -> None:
        books = [line("b1", "Alpha", GSTIN_A, "AT-101", "10000", "1800", day=1)]
        portal = [line("p1", "Alpha", GSTIN_A, "AT-1O1", "10000", "1800", day=28)]

        # 27 days apart, window is 15.
        assert reconcile(books, portal).matched == 0


class TestSummary:
    @pytest.fixture
    def mixed(self) -> object:
        books = [
            line("b1", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000"),
            line("b2", "Mehta Pack", GSTIN_B, "MP-8891", "75000", "18000"),
            line("b3", "Vector Office", GSTIN_A, "VOS/1120", "128000", "23040"),
        ]
        portal = [
            line("p1", "Deepak Steel", GSTIN_A, "DS/0441", "450000", "81000"),
            line("p2", "Mehta Pack", GSTIN_B, "MP-8891", "75000", "13500"),
            line("p4", "Sunrise Chem", GSTIN_B, "SC-307", "96000", "17280"),
        ]
        return reconcile(books, portal, period="2026-09")

    def test_counts(self, mixed) -> None:
        assert mixed.total_lines == 4
        assert mixed.matched == 1
        assert mixed.amount_mismatch == 1
        assert mixed.missing_in_2b == 1
        assert mixed.missing_in_books == 1
        assert mixed.mismatched == 3

    def test_itc_split(self, mixed) -> None:
        # b2 over-claims by 4,500; b3 claims 23,040 with no portal support.
        assert mixed.itc_at_risk == Decimal("27540")
        # p4 is 17,280 of credit never recorded.
        assert mixed.itc_unclaimed == Decimal("17280")
        assert mixed.net_itc_impact == Decimal("-10260")

    def test_totals_are_sums_of_the_present_sides(self, mixed) -> None:
        assert mixed.books_tax_total == Decimal("122040")
        assert mixed.portal_tax_total == Decimal("111780")

    def test_worst_lines_sort_first(self, mixed) -> None:
        """The review queue order. A reviewer with ten minutes should spend
        them on the biggest exposure, not the first row in the file."""
        assert mixed.lines[0].status is MatchStatus.MISSING_IN_2B
        assert mixed.lines[-1].status is MatchStatus.MATCHED

    def test_headline_reports_both_itc_numbers(self, mixed) -> None:
        text = mixed.headline()
        assert "27,540" in text
        assert "17,280" in text

    def test_every_line_carries_an_explanation(self, mixed) -> None:
        """No unexplained verdicts: a CA has to justify this to the department."""
        assert all(len(row.note) > 20 for row in mixed.lines)


class TestEdgeCases:
    def test_both_sides_empty(self) -> None:
        result = reconcile([], [], period="2026-09")
        assert result.total_lines == 0
        assert result.match_rate == 0.0

    def test_missing_dates_do_not_block_an_exact_match(self) -> None:
        books = [
            InvoiceLine("b1", "A", GSTIN_A, "INV-1", None, Decimal("1000"), Decimal("180"))
        ]
        portal = [
            InvoiceLine("p1", "A", GSTIN_A, "INV-1", None, Decimal("1000"), Decimal("180"))
        ]
        assert reconcile(books, portal).matched == 1

    def test_zero_value_invoice(self) -> None:
        books = [line("b1", "A", GSTIN_A, "INV-1", "0", "0")]
        portal = [line("p1", "A", GSTIN_A, "INV-1", "0", "0")]
        assert reconcile(books, portal).matched == 1

    def test_tighter_tolerance_turns_rounding_into_a_mismatch(self) -> None:
        books = [line("b1", "A", GSTIN_A, "INV-1", "450000", "81000")]
        portal = [line("p1", "A", GSTIN_A, "INV-1", "450001", "81001")]

        strict = Tolerance(amount_abs=Decimal("0"), amount_pct=Decimal("0"))
        assert reconcile(books, portal, tolerance=strict).amount_mismatch == 1
