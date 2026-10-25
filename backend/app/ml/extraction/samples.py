"""Render synthetic GST invoices and notices as real PDF files.

Used by the tests and by scripts/seed.py. The point is that the seeded
"extracted" values are produced by running the actual extractor over an actual
PDF - not typed into the database to look like extraction output. If the
extractor breaks, the seed shows it.

Every document rendered here is fictitious and says so in its footer.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.utils.identifiers import gstin_check_digit


def make_gstin(state_code: str, pan: str, entity: str = "1") -> str:
    """A GSTIN with a correct check digit, for test and demo data."""
    first14 = f"{state_code}{pan}{entity}Z"
    return first14 + (gstin_check_digit(first14) or "0")


def _inr(value: Decimal) -> str:
    """Indian digit grouping: 4,50,000.00 - what real invoices print."""
    quantised = f"{value:.2f}"
    whole, fraction = quantised.split(".")
    negative = whole.startswith("-")
    whole = whole.lstrip("-")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups) + "," + tail
    return f"{'-' if negative else ''}{whole}.{fraction}"


@dataclass(slots=True)
class SampleInvoice:
    supplier_name: str
    supplier_gstin: str
    supplier_address: str
    buyer_name: str
    buyer_gstin: str
    invoice_no: str
    invoice_date: date
    description: str
    taxable: Decimal
    rate_percent: Decimal = Decimal("18")

    @property
    def intra_state(self) -> bool:
        return self.supplier_gstin[:2] == self.buyer_gstin[:2]

    @property
    def tax(self) -> Decimal:
        return (self.taxable * self.rate_percent / 100).quantize(Decimal("0.01"))

    @property
    def total(self) -> Decimal:
        return self.taxable + self.tax


def render_invoice(invoice: SampleInvoice) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    y = 56.0

    def line(text: str, size: float = 10, x: float = 50) -> None:
        nonlocal y
        page.insert_text((x, y), text, fontsize=size, fontname="helv")
        y += size + 8

    line("TAX INVOICE", 15)
    line("Original for Recipient", 8)
    y += 6
    line(invoice.supplier_name, 12)
    line(invoice.supplier_address, 9)
    line(f"GSTIN: {invoice.supplier_gstin}")
    y += 8
    line(f"Invoice No: {invoice.invoice_no}")
    line(f"Invoice Date: {invoice.invoice_date:%d/%m/%Y}")
    y += 8
    line(f"Bill To: {invoice.buyer_name}")
    line(f"GSTIN: {invoice.buyer_gstin}")
    y += 12
    line(f"Description: {invoice.description}")
    y += 6
    line(f"Taxable Value                          {_inr(invoice.taxable)}")
    if invoice.intra_state:
        half_rate = invoice.rate_percent / 2
        half = (invoice.tax / 2).quantize(Decimal("0.01"))
        line(f"CGST @ {half_rate:g}%                             {_inr(half)}")
        line(f"SGST @ {half_rate:g}%                             {_inr(invoice.tax - half)}")
    else:
        line(f"IGST @ {invoice.rate_percent:g}%                            {_inr(invoice.tax)}")
    line(f"Grand Total                            {_inr(invoice.total)}", 11)
    y += 30
    line("Fictitious invoice generated for CA-OS testing. Not a real document.", 7)

    data = doc.tobytes()
    doc.close()
    return data


def gstr2b_json(
    recipient_gstin: str,
    period: str,
    invoices: list[tuple[SampleInvoice, dict]],
) -> bytes:
    """A GSTR-2B JSON in the portal's layout, for the given invoices.

    Each invoice carries an ``overrides`` dict for the differences a real 2B
    shows against the books: ``invoice_no`` (supplier typed it differently),
    ``taxable``/``tax`` (supplier reported another amount), ``date``.
    """
    import json

    by_supplier: dict[str, dict] = {}
    year, month = period.split("-")
    for invoice, overrides in invoices:
        supplier = by_supplier.setdefault(
            invoice.supplier_gstin,
            {"ctin": invoice.supplier_gstin, "trdnm": invoice.supplier_name.upper(),
             "supprd": f"{month}{year}", "inv": []},
        )
        taxable = Decimal(str(overrides.get("taxable", invoice.taxable)))
        tax = Decimal(str(overrides.get("tax", invoice.tax)))
        intra = invoice.intra_state
        half = (tax / 2).quantize(Decimal("0.01"))
        supplier["inv"].append(
            {
                "inum": overrides.get("invoice_no", invoice.invoice_no),
                "typ": "R",
                "dt": overrides.get("date", invoice.invoice_date).strftime("%d-%m-%Y"),
                "val": float(taxable + tax),
                "pos": invoice.buyer_gstin[:2],
                "rev": "N",
                "itcavl": "Y",
                "txval": float(taxable),
                "igst": 0.0 if intra else float(tax),
                "cgst": float(half) if intra else 0.0,
                "sgst": float(tax - half) if intra else 0.0,
                "cess": 0.0,
            }
        )
    payload = {
        "chksum": "fictitious",
        "data": {
            "gstin": recipient_gstin,
            "rtnprd": f"{month}{year}",
            "version": "1.0",
            "gendt": f"14-{int(month) % 12 + 1:02d}-{year if month != '12' else int(year) + 1}",
            "docdata": {"b2b": list(by_supplier.values()), "cdnr": []},
        },
    }
    return json.dumps(payload, indent=1).encode("utf-8")


@dataclass(slots=True)
class SampleNotice:
    authority_header: str
    din: str
    section_text: str
    issued_on: date
    reply_by: date
    taxpayer_name: str
    taxpayer_id: str
    subject: str
    body: str
    demand: Decimal | None


def render_notice(notice: SampleNotice) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    y = 56.0

    def line(text: str, size: float = 10) -> None:
        nonlocal y
        page.insert_text((50, y), text, fontsize=size, fontname="helv")
        y += size + 8

    line(notice.authority_header, 12)
    y += 6
    line(f"DIN: {notice.din}")
    line(f"Dated: {notice.issued_on:%d/%m/%Y}")
    line(f"To: {notice.taxpayer_name} ({notice.taxpayer_id})")
    y += 6
    line(f"Subject: {notice.subject}")
    y += 6
    for paragraph in notice.body.split("\n"):
        line(paragraph, 9)
    line(notice.section_text, 9)
    if notice.demand is not None:
        line(f"Amount payable: Rs. {_inr(notice.demand)}")
    line(f"You are required to reply on or before {notice.reply_by:%d/%m/%Y}.")
    y += 30
    line("Fictitious notice generated for CA-OS testing. Not a real document.", 7)

    data = doc.tobytes()
    doc.close()
    return data
