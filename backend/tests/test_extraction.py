"""Document extraction, end to end over real PDF bytes.

Every invoice test renders an actual PDF and reads it back through the same
text layer a user's upload goes through - not a string fed to the parser - so
a change in the PDF libraries shows up here.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.ml.extraction.fields import amounts_in, find_gstins
from app.ml.extraction.invoice import extract_invoice
from app.ml.extraction.notice import extract_form16a, extract_notice
from app.ml.extraction.samples import (
    SampleInvoice,
    SampleNotice,
    make_gstin,
    render_invoice,
    render_notice,
)
from app.ml.extraction.text import JPEG, PDF, PNG, extract_text, sniff_mime
from app.utils.identifiers import gstin_checksum_ok

BUYER = "27AABCA1234M1ZU"


def invoice(**overrides) -> SampleInvoice:
    base = {
        "supplier_name": "Deepak Steel Suppliers Private Limited",
        "supplier_gstin": make_gstin("27", "AACCD1122E"),
        "supplier_address": "Plot 12, MIDC Bhosari, Pune 411026",
        "buyer_name": "Arora Trading Private Limited",
        "buyer_gstin": BUYER,
        "invoice_no": "DS/2026/0441",
        "invoice_date": date(2026, 9, 4),
        "description": "MS steel sheets",
        "taxable": Decimal("450000"),
    }
    return SampleInvoice(**(base | overrides))


def read(sample: SampleInvoice, **kwargs):
    text = extract_text(render_invoice(sample), PDF)
    assert text.engine.startswith("pdfplumber")
    return extract_invoice(text.text, own_gstin=kwargs.get("own", BUYER), purchase=kwargs.get("purchase", True))


class TestInvoiceRoundTrip:
    def test_intra_state_invoice_every_field(self) -> None:
        sample = invoice()
        result = read(sample)
        f = result.fields
        assert f["supplier_gstin"] == sample.supplier_gstin
        assert f["buyer_gstin"] == BUYER
        assert f["supplier_name"] == sample.supplier_name
        assert f["invoice_no"] == "DS/2026/0441"
        assert f["invoice_date"] == date(2026, 9, 4)
        assert f["taxable_value"] == Decimal("450000.00")
        assert f["cgst"] == f["sgst"] == Decimal("40500.00")
        assert f["igst"] is None
        assert f["invoice_total"] == Decimal("531000.00")
        assert f["supply_type"] == "INTRA"
        assert all(c.passed for c in result.checks)
        assert result.overall > 0.9

    def test_inter_state_invoice_charges_igst(self) -> None:
        sample = invoice(supplier_gstin=make_gstin("24", "AACCD1122E"))
        f = read(sample).fields
        assert f["igst"] == Decimal("81000.00")
        assert f["cgst"] is None
        assert f["supply_type"] == "INTER"

    def test_copy_marker_does_not_make_the_supplier_the_buyer(self) -> None:
        """Regression. "Original for Recipient" - the copy marker on every tax
        invoice - contains a buyer word. With a short supplier header it sat
        inside the context window of the supplier's GSTIN, and the buyer's own
        GSTIN was recorded as the supplier. Reconciliation caught it."""
        sample = invoice(
            supplier_name="Mehta Packaging Industries",
            supplier_gstin=make_gstin("24", "AAFPM7781K"),
            supplier_address="GIDC Vatva, Ahmedabad 382445",
        )
        f = read(sample).fields
        assert f["supplier_gstin"] == sample.supplier_gstin
        assert f["buyer_gstin"] == BUYER
        assert f["supplier_name"] == "Mehta Packaging Industries"

    def test_roles_resolved_by_labels_when_own_gstin_unknown(self) -> None:
        sample = invoice()
        f = read(sample, own=None).fields
        assert f["supplier_gstin"] == sample.supplier_gstin
        assert f["buyer_gstin"] == BUYER

    def test_sales_invoice_puts_the_client_as_supplier(self) -> None:
        own = make_gstin("27", "AACCD1122E")
        f = read(invoice(), own=own, purchase=False).fields
        assert f["supplier_gstin"] == own

    @pytest.mark.parametrize("rate", ["5", "12", "18", "28", "40"])
    def test_every_slab_passes_the_rate_check(self, rate: str) -> None:
        result = read(invoice(rate_percent=Decimal(rate), taxable=Decimal("10000")))
        assert result.fields["tax_rate_percent"] == float(rate)

    def test_percentage_is_never_taken_as_the_amount(self) -> None:
        """On ``CGST @ 9% 40,500.00`` the 9 is a rate."""
        assert amounts_in("CGST @ 9% 40,500.00") == [Decimal("40500.00")]


class TestCrossChecks:
    TEXT = (
        "TAX INVOICE\nAcme Traders\nGSTIN: {s}\nInvoice No: AC-77\nInvoice Date: 02/09/2026\n"
        "Bill To: Buyer Ltd\nGSTIN: {b}\nTaxable Value 10,000.00\nCGST @ 9% {c}\nSGST @ 9% 900.00\n"
        "Grand Total {t}\n"
    )

    def text(self, cgst="900.00", total="11,800.00") -> str:
        return self.TEXT.format(s=make_gstin("27", "AAACA1111A"), b=BUYER, c=cgst, t=total)

    def test_consistent_invoice_scores_high(self) -> None:
        result = extract_invoice(self.text(), own_gstin=BUYER)
        assert result.confidence["invoice_total"] >= 0.97

    def test_arithmetic_failure_cuts_confidence_and_says_why(self) -> None:
        result = extract_invoice(self.text(total="12,800.00"), own_gstin=BUYER)
        arithmetic = next(c for c in result.checks if c.name == "arithmetic")
        assert not arithmetic.passed
        assert result.confidence["invoice_total"] <= 0.45
        assert any("does not equal" in h for h in result.hints)

    def test_unequal_halves_flagged(self) -> None:
        result = extract_invoice(self.text(cgst="800.00", total="11,700.00"), own_gstin=BUYER)
        assert not next(c for c in result.checks if c.name == "cgst_equals_sgst").passed

    def test_missing_gstin_drags_overall_down(self) -> None:
        text = self.text().replace(make_gstin("27", "AAACA1111A"), "")
        result = extract_invoice(text, own_gstin=BUYER)
        assert result.fields["supplier_gstin"] is None
        assert result.overall < 0.85


class TestGstinRepair:
    def test_ocr_letter_o_repaired_when_checksum_confirms(self) -> None:
        gstin = make_gstin("27", "AACCD1122E")
        damaged = gstin.replace("1122", "11ZZ")  # 2 read as Z, twice
        hits = find_gstins(f"GSTIN: {damaged}")
        assert hits and hits[0].value == gstin and hits[0].repaired

    def test_unrepairable_candidate_is_dropped_not_guessed(self) -> None:
        gstin = make_gstin("27", "AACCD1122E")
        wrong_check = gstin[:-1] + ("A" if gstin[-1] != "A" else "B")
        assert not gstin_checksum_ok(wrong_check)
        assert find_gstins(f"GSTIN: {wrong_check}") == []


class TestNotices:
    def notice_text(self) -> str:
        pdf = render_notice(
            SampleNotice(
                authority_header="Office of the Assistant Commissioner, CGST Division",
                din="ZD2709260123456",
                section_text="This notice is issued under section 73 of the CGST Act, 2017 in FORM GST DRC-01.",
                issued_on=date(2026, 9, 28),
                reply_by=date(2026, 11, 2),
                taxpayer_name="Gupta Textiles Private Limited",
                taxpayer_id="09AADCG9012P1Z6",
                subject="Short payment of tax for April 2025 to March 2026",
                body="Discrepancy observed between GSTR-1 and GSTR-3B.",
                demand=Decimal("284000"),
            )
        )
        return extract_text(pdf, PDF).text

    def test_fields(self) -> None:
        f = extract_notice(self.notice_text()).fields
        assert f["authority"] == "GST"
        assert f["notice_number"] == "ZD2709260123456"
        assert f["due_date"] == date(2026, 11, 2)
        assert f["issued_on"] == date(2026, 9, 28)

    def test_section_is_the_proceeding_not_a_return_mentioned_in_passing(self) -> None:
        """Regression: GSTR-1 appears in the body; the notice is under s.73."""
        f = extract_notice(self.notice_text()).fields
        assert f["section_code"] == "73"
        assert f["form"] == "DRC-01"

    def test_demand_is_not_a_year(self) -> None:
        """Regression: "... March 2026" sat beside a demand label."""
        assert extract_notice(self.notice_text()).fields["demand_amount"] == Decimal("284000.00")

    def test_relative_reply_date_is_computed_and_marked(self) -> None:
        text = "Income Tax Department\nDIN: ITBA/AST/2026/1234567\nDated: 01/10/2026\nReply within 30 days."
        result = extract_notice(text)
        assert result.fields["due_date"] == date(2026, 10, 31)
        assert result.confidence["due_date"] < 0.7
        assert any("computed" in h for h in result.hints)

    def test_form16a(self) -> None:
        text = (
            "FORM NO. 16A\nTAN of deductor: MUMA12345B\nPAN of deductee: AABCK7890N\n"
            "Section 194J Quarter Q2 Assessment Year 2027-28\nAmount paid/credited 1,25,000.00\n"
            "Tax deducted 12,500.00"
        )
        f = extract_form16a(text).fields
        assert f["deductor_tan"] == "MUMA12345B"
        assert f["section"] == "194J"
        assert f["amount_paid"] == Decimal("125000.00")
        assert f["tds_amount"] == Decimal("12500.00")


class TestSniffing:
    def test_types_come_from_bytes_not_names(self) -> None:
        assert sniff_mime(b"%PDF-1.7 ...", "x.pdf") == PDF
        assert sniff_mime(b"\x89PNG\r\n\x1a\n...", "x.png") == PNG
        assert sniff_mime(b"\xff\xd8\xff\xe0...", "x.jpg") == JPEG

    def test_executable_named_pdf_is_refused(self) -> None:
        assert sniff_mime(b"MZ\x90\x00\x03", "invoice.pdf") is None

    def test_scan_without_tesseract_needs_ocr_rather_than_empty(self) -> None:
        result = extract_text(b"\x89PNG\r\n\x1a\nnot-really", PNG)
        if result.engine == "none":
            assert result.needs_ocr and "Tesseract" in (result.note or "")
