"""GST invoice field extraction - Module 3.

Rule-based over the document's text, and deliberately so. A learned layout
model (LayoutLM and friends) needs thousands of labelled Indian invoices that
do not exist publicly, and the fields that matter here have strong structure
that rules capture well: a GSTIN has a check digit, CGST equals SGST on an
intra-state supply, and taxable value plus tax equals the invoice total.

That structure is also where the **confidence** comes from. Each field starts
from how it was found (beside its label, by heuristic, or derived from other
fields) and is then raised or cut by cross-checks that can genuinely fail:

* arithmetic     taxable + tax ≈ invoice total
* cgst = sgst    both halves of an intra-state levy are equal
* one regime     never IGST *and* CGST/SGST on one invoice
* real rate      tax / taxable is an actual GST rate
* place          same state code on both GSTINs means CGST+SGST; different
                 means IGST

A number that passes all of them is very likely right. One that fails is
shown to the reviewer *with the failed check*, which is far more useful than
a bare low score. Nothing here ever marks a document verified - that is a
person's decision.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.ml.extraction.fields import (
    GstinHit,
    find_gstins,
    first_date,
    labelled_amount,
    labelled_date,
    labelled_text,
)

#: GST rates in percent. 12% and 28% were folded into 5%/18%/40% for most
#: goods from 22 September 2025, but older invoices and some items still
#: carry them, so all are accepted.
KNOWN_RATES = (0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40)

#: The fields whose absence makes an invoice unusable for reconciliation.
KEY_FIELDS = (
    "supplier_gstin",
    "invoice_no",
    "invoice_date",
    "taxable_value",
    "total_tax",
    "invoice_total",
)

_BUYER_WORDS = re.compile(
    r"\b(bill(?:ed)?\s*to|buyer|ship(?:ped)?\s*to|consignee|recipient|customer|sold\s*to|"
    r"party\s*details|receiver)\b",
    re.IGNORECASE,
)
_SUPPLIER_WORDS = re.compile(r"\b(supplier|seller|sold\s*by|from|vendor)\b", re.IGNORECASE)
_COMPANY_SUFFIX = re.compile(
    r"\b(private|pvt|limited|ltd|llp|enterprises?|traders?|trading|industries|"
    r"suppliers?|solutions|services|corporation|corp|company|co\.?|&\s*co|agencies|"
    r"associates|logistics|exports?|imports?|textiles|chemicals|steel|packaging)\b",
    re.IGNORECASE,
)
_NOT_A_NAME = re.compile(
    r"(tax\s*invoice|^invoice$|original|duplicate|triplicate|for\s+recipient|gstin|"
    r"\bpan\b|state\s*code|phone|tel|mobile|e-?mail|@|www\.|https?:|"
    r"\b\d{6}\b|^(plot|shop|flat|unit|no\.?|door|survey|gala)\b|road|nagar|street|"
    r"floor|midc|sector|lane|marg|invoice\s*no|date)",
    re.IGNORECASE,
)


@dataclass(slots=True)
class Check:
    name: str
    passed: bool
    detail: str


@dataclass(slots=True)
class InvoiceExtraction:
    fields: dict[str, object]
    confidence: dict[str, float]
    checks: list[Check] = field(default_factory=list)
    #: Plain-language reasons a reviewer should look closely.
    hints: list[str] = field(default_factory=list)

    @property
    def overall(self) -> float:
        """Mean confidence over the key fields, with a missing field scoring 0.

        A missing GSTIN must drag the score down: an invoice without one cannot
        be reconciled at all, however confident the other five fields are.
        """
        return round(sum(self.confidence.get(k, 0.0) for k in KEY_FIELDS) / len(KEY_FIELDS), 4)

    def to_json(self) -> dict:
        def encode(value):
            if isinstance(value, Decimal):
                return str(value)
            if isinstance(value, date):
                return value.isoformat()
            return value

        return {
            **{k: encode(v) for k, v in self.fields.items()},
            "_confidence": {k: round(v, 4) for k, v in self.confidence.items()},
            "_checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
            "_hints": self.hints,
        }


def _close(a: Decimal, b: Decimal) -> bool:
    """Within ₹2 or 0.5% - invoices carry a "round off" line routinely."""
    difference = abs(a - b)
    return difference <= Decimal("2") or difference <= abs(b) * Decimal("0.005")


#: The copy marker Rule 46 requires on every tax invoice. "Original for
#: Recipient" contains a buyer word, and treating it as a label assigned the
#: *supplier's* GSTIN, printed a few lines below it, to the buyer.
_COPY_MARKER = re.compile(
    r"\b(original|duplicate|triplicate)\s+(?:copy\s+)?for\s+(recipient|buyer|transporter|supplier|seller)\b",
    re.IGNORECASE,
)


def _label_lines(text: str, position: int) -> list[str]:
    """The GSTIN's own line and up to three above it, stopping at another
    party's block - labels sit beside or just above the number they name."""
    lines = text[:position].split("\n")
    out = [lines[-1]]
    for line in reversed(lines[-4:-1]):
        if "GSTIN" in line.upper():
            break
        out.append(line)
    return [_COPY_MARKER.sub(" ", line) for line in out]


def _classify_parties(
    hits: list[GstinHit], text: str, own_gstin: str | None, *, purchase: bool
) -> tuple[GstinHit | None, GstinHit | None]:
    """Work out which GSTIN is the supplier's and which the buyer's.

    The client's own GSTIN, when known, settles its own role outright: on a
    purchase invoice the client is the buyer, on a sales invoice the supplier.
    The remaining GSTINs are decided by the labels beside them, and failing
    that by order - billing software prints the seller in the header, so the
    first unlabelled GSTIN on the page is taken as the issuer's.
    """
    own = (own_gstin or "").upper() or None
    supplier = buyer = None
    others: list[GstinHit] = []
    for hit in hits:
        if own and hit.value == own:
            if purchase:
                buyer = buyer or hit
            else:
                supplier = supplier or hit
        else:
            others.append(hit)

    unlabelled: list[GstinHit] = []
    for hit in others:
        current, *above = _label_lines(text, hit.position)
        if _BUYER_WORDS.search(current) or (
            not _SUPPLIER_WORDS.search(current) and any(_BUYER_WORDS.search(x) for x in above)
        ):
            role = "buyer"
        elif _SUPPLIER_WORDS.search(current) or any(_SUPPLIER_WORDS.search(x) for x in above):
            role = "supplier"
        else:
            role = None

        if role == "buyer" and buyer is None:
            buyer = hit
        elif role == "supplier" and supplier is None:
            supplier = hit
        else:
            unlabelled.append(hit)

    for hit in unlabelled:
        if supplier is None:
            supplier = hit
        elif buyer is None:
            buyer = hit
    return supplier, buyer


def _supplier_name(lines: list[str], gstin_line: int | None) -> tuple[str | None, float]:
    labelled = None
    for line in lines[:15]:
        match = re.match(r"\s*(?:supplier|seller|sold\s*by|from|m/s\.?)\s*[:\-]?\s*(.+)", line, re.I)
        if match and len(match.group(1)) > 3:
            labelled = match.group(1)
            break
    if labelled:
        name = re.split(r"\bGSTIN\b", labelled, flags=re.I)[0].strip(" ,:-")
        if name:
            return name[:255], 0.85

    # Search upward from the supplier's GSTIN, then the document head.
    window = list(range((gstin_line or 0) - 1, max(-1, (gstin_line or 0) - 6), -1))
    window += list(range(0, min(len(lines), 8)))
    best, best_score = None, 0.0
    for index in window:
        if index < 0 or index >= len(lines):
            continue
        candidate = re.split(r"\bGSTIN\b", lines[index], flags=re.I)[0].strip(" ,:-|")
        if len(candidate) < 4 or _NOT_A_NAME.search(candidate):
            continue
        letters = sum(c.isalpha() for c in candidate)
        if letters / max(1, len(candidate)) < 0.6:
            continue
        score = 0.75 if _COMPANY_SUFFIX.search(candidate) else 0.5
        if score > best_score:
            best, best_score = candidate[:255], score
    return best, best_score


def _nearest_rate(percent: Decimal) -> float | None:
    nearest = min(KNOWN_RATES, key=lambda r: abs(float(percent) - r))
    return nearest if abs(float(percent) - nearest) <= 0.15 else None


def extract_invoice(
    text: str, *, own_gstin: str | None = None, purchase: bool = True
) -> InvoiceExtraction:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    joined = "\n".join(lines)
    fields: dict[str, object] = dict.fromkeys(
        (
            "supplier_name",
            "supplier_gstin",
            "buyer_gstin",
            "invoice_no",
            "invoice_date",
            "taxable_value",
            "cgst",
            "sgst",
            "igst",
            "cess",
            "total_tax",
            "invoice_total",
            "tax_rate_percent",
            "supply_type",
        )
    )
    confidence: dict[str, float] = {}
    checks: list[Check] = []
    hints: list[str] = []

    # ---------------------------------------------------------- parties ----
    hits = find_gstins(joined)
    supplier_hit, buyer_hit = _classify_parties(hits, joined, own_gstin, purchase=purchase)
    gstin_line = None
    if supplier_hit:
        fields["supplier_gstin"] = supplier_hit.value
        confidence["supplier_gstin"] = 0.8 if supplier_hit.repaired else 0.98
        gstin_line = joined[: supplier_hit.position].count("\n")
        if supplier_hit.repaired:
            hints.append(
                f"Supplier GSTIN read as {supplier_hit.raw} and repaired to "
                f"{supplier_hit.value} (the check digit confirms the repair)"
            )
    else:
        hints.append("No valid supplier GSTIN found - unregistered supplier, or unreadable")
    if buyer_hit:
        fields["buyer_gstin"] = buyer_hit.value
        confidence["buyer_gstin"] = 0.8 if buyer_hit.repaired else 0.95

    name, name_conf = _supplier_name(lines, gstin_line)
    if name:
        fields["supplier_name"], confidence["supplier_name"] = name, name_conf

    # --------------------------------------------------- number and date ---
    number = labelled_text(
        joined,
        [
            r"(?:tax\s+)?invoice\s*(?:no|number|num)\.?",
            r"inv\.?\s*(?:no|num)\.?",
            r"invoice\s*#",
            r"bill\s*(?:no|number)\.?",
            r"document\s*no\.?",
        ],
        r"[A-Z0-9][A-Z0-9/\-_.]{0,29}",
    )
    if number and re.search(r"\d", number):
        fields["invoice_no"] = number.rstrip("./-_")
        confidence["invoice_no"] = 0.88
    else:
        hints.append("Invoice number not found beside an 'Invoice No' label")

    invoice_date = labelled_date(
        joined,
        [
            r"invoice\s*date",
            r"inv\.?\s*date",
            r"date\s*of\s*(?:invoice|issue)",
            r"bill\s*date",
            r"dated",
        ],
    )
    date_conf = 0.9
    if invoice_date is None:
        invoice_date = labelled_date(joined, [r"\bdate"])
        date_conf = 0.75
    if invoice_date is None:
        invoice_date, date_conf = first_date(joined), 0.5
    if invoice_date:
        fields["invoice_date"], confidence["invoice_date"] = invoice_date, date_conf
    else:
        hints.append("Invoice date not found")

    # ----------------------------------------------------------- amounts ---
    found: dict[str, Decimal | None] = {
        "taxable_value": labelled_amount(
            lines,
            [
                r"total\s*taxable\s*value",
                r"taxable\s*(?:value|amount|amt)",
                r"assessable\s*value",
                r"sub\s*-?\s*total",
            ],
        ),
        "cgst": labelled_amount(lines, [r"cgst", r"central\s*(?:tax|gst)"], exclude=[r"igst"]),
        "sgst": labelled_amount(
            lines, [r"sgst", r"utgst", r"state\s*(?:tax|gst)"], exclude=[r"igst"]
        ),
        "igst": labelled_amount(lines, [r"igst", r"integrated\s*(?:tax|gst)"]),
        "cess": labelled_amount(lines, [r"cess"], exclude=[r"process"]),
        "total_tax": labelled_amount(
            lines, [r"total\s*(?:tax|gst)(?:\s*amount)?", r"tax\s*amount", r"gst\s*amount"],
            exclude=[r"taxable"],
        ),
        "invoice_total": labelled_amount(
            list(reversed(lines)),
            [
                r"grand\s*total",
                r"invoice\s*(?:total|value)",
                r"total\s*invoice\s*value",
                r"total\s*amount(?:\s*after\s*tax)?",
                r"amount\s*payable",
                r"net\s*(?:payable|amount)",
            ],
            exclude=[r"taxable", r"before\s*tax"],
        ),
    }
    derived: set[str] = set()
    for key, value in found.items():
        if value is not None:
            fields[key] = value
            confidence[key] = 0.85

    parts = [found[k] for k in ("cgst", "sgst", "igst", "cess") if found[k] is not None]
    if found["total_tax"] is None and parts:
        found["total_tax"] = sum(parts, Decimal("0"))
        fields["total_tax"], confidence["total_tax"] = found["total_tax"], 0.8
        derived.add("total_tax")

    taxable, tax, total = found["taxable_value"], found["total_tax"], found["invoice_total"]
    if taxable is None and tax is not None and total is not None:
        taxable = total - tax
        fields["taxable_value"], confidence["taxable_value"] = taxable, 0.7
        derived.add("taxable_value")
        hints.append("Taxable value derived as total minus tax")
    if total is None and taxable is not None and tax is not None:
        total = taxable + tax
        fields["invoice_total"], confidence["invoice_total"] = total, 0.7
        derived.add("invoice_total")
        hints.append("Invoice total derived as taxable plus tax")

    # ------------------------------------------------------------ checks ---
    amount_keys = ("taxable_value", "total_tax", "invoice_total", "cgst", "sgst", "igst")

    # Only meaningful when both sides were read: a derived taxable value or
    # total satisfies the arithmetic by construction and proves nothing.
    if (
        taxable is not None
        and tax is not None
        and total is not None
        and not ({"taxable_value", "invoice_total"} & derived)
    ):
        ok = _close(taxable + tax, total)
        checks.append(
            Check("arithmetic", ok, f"taxable {taxable} + tax {tax} = {taxable + tax}, invoice total {total}")
        )
        for key in amount_keys:
            if key in confidence:
                confidence[key] = max(confidence[key], 0.97) if ok else min(confidence[key], 0.45)
        if not ok:
            hints.append("Taxable value plus tax does not equal the invoice total")

    cgst, sgst, igst = found["cgst"], found["sgst"], found["igst"]
    if cgst is not None and sgst is not None:
        ok = _close(cgst, sgst)
        checks.append(Check("cgst_equals_sgst", ok, f"CGST {cgst}, SGST {sgst}"))
        if not ok:
            hints.append("CGST and SGST differ - they are always equal halves")
            confidence["cgst"] = min(confidence.get("cgst", 0.5), 0.5)
            confidence["sgst"] = min(confidence.get("sgst", 0.5), 0.5)
    if igst and (cgst or sgst):
        checks.append(Check("single_regime", False, "Both IGST and CGST/SGST present"))
        hints.append("An invoice charges IGST or CGST+SGST, never both")
    elif igst or cgst or sgst:
        checks.append(Check("single_regime", True, "One tax regime"))
    if igst:
        fields["supply_type"] = "INTER"
    elif cgst or sgst:
        fields["supply_type"] = "INTRA"

    if taxable and tax is not None and taxable > 0:
        percent = (tax - (found["cess"] or Decimal("0"))) / taxable * 100
        rate = _nearest_rate(percent)
        if rate is not None:
            fields["tax_rate_percent"] = rate
            checks.append(Check("rate_plausible", True, f"effective rate {percent:.2f}% = {rate}% slab"))
        else:
            checks.append(Check("rate_plausible", False, f"effective rate {percent:.2f}% is not a GST rate"))
            hints.append(f"Effective tax rate {percent:.2f}% matches no GST slab - mixed rates, or a misread")
            for key in amount_keys:
                if key in confidence:
                    confidence[key] *= 0.8

    supplier_state = str(fields["supplier_gstin"])[:2] if fields["supplier_gstin"] else None
    buyer_state = str(fields["buyer_gstin"])[:2] if fields["buyer_gstin"] else None
    if supplier_state and buyer_state and fields["supply_type"]:
        expected = "INTRA" if supplier_state == buyer_state else "INTER"
        ok = expected == fields["supply_type"]
        checks.append(
            Check(
                "place_of_supply",
                ok,
                f"supplier state {supplier_state}, buyer state {buyer_state}: expected "
                f"{'CGST+SGST' if expected == 'INTRA' else 'IGST'}",
            )
        )
        if not ok:
            hints.append(
                "Tax type does not match the two states - check place of supply; "
                "ITC on wrongly charged tax is not available"
            )

    return InvoiceExtraction(
        fields=fields,
        confidence={k: round(v, 4) for k, v in confidence.items()},
        checks=checks,
        hints=hints,
    )
