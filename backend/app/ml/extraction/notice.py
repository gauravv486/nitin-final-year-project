"""Tax notice and TDS certificate extraction - Modules 6 and 7.

Notices are the document a practice least wants to misread: the reply date is
a hard statutory deadline. So the extractor reports *where* each value came
from, and a reply date that had to be computed ("within 30 days of issue")
is marked as computed rather than presented as printed on the page.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from app.ml.extraction.fields import (
    find_pans,
    find_tans,
    labelled_amount,
    labelled_date,
    labelled_text,
)


@dataclass(slots=True)
class NoticeExtraction:
    fields: dict[str, object]
    confidence: dict[str, float]
    hints: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        def encode(value):
            if isinstance(value, Decimal):
                return str(value)
            if isinstance(value, date):
                return value.isoformat()
            return value

        return {
            **{k: encode(v) for k, v in self.fields.items()},
            "_confidence": self.confidence,
            "_hints": self.hints,
        }


_AUTHORITY_RULES = [
    ("GST", r"\b(goods\s+and\s+services\s+tax|cgst|sgst|igst|gstin|gst\s+act|drc-0\d|asmt-\d+)\b"),
    ("TDS_CPC", r"\b(traces|tds\s+cpc|centralized\s+processing\s+cell\s*\(tds\))\b"),
    ("INCOME_TAX", r"\b(income[\s-]*tax|itba|cpc|assessing\s+officer|income\s+tax\s+act)\b"),
    ("ROC_MCA", r"\b(registrar\s+of\s+companies|companies\s+act|ministry\s+of\s+corporate)\b"),
]

_SECTION_RE = re.compile(
    r"(?:section|u/s\.?|under\s+sec(?:tion)?\.?)\s*"
    r"(\d{1,3}[A-Z]{0,2}(?:\(\d+[A-Z]?\))?(?:\([a-z]+\))?)",
    re.IGNORECASE,
)
#: Forms that *open a proceeding*. GSTR-n is deliberately absent: a notice
#: mentions returns constantly ("mismatch between GSTR-1 and GSTR-3B") but a
#: return is the subject of the dispute, never the instrument of it.
_PROCEEDING_FORM_RE = re.compile(r"\b((?:ASMT|DRC|REG|RFD|ADT|MOV)-\d{1,2}[A-Z]?)\b", re.IGNORECASE)


def extract_notice(text: str) -> NoticeExtraction:
    joined = "\n".join(ln.strip() for ln in text.splitlines() if ln.strip())
    lines = joined.split("\n")
    fields: dict[str, object] = {}
    confidence: dict[str, float] = {}
    hints: list[str] = []

    authority = "OTHER"
    for name, pattern in _AUTHORITY_RULES:
        if re.search(pattern, joined, re.IGNORECASE):
            authority = name
            break
    fields["authority"] = authority
    confidence["authority"] = 0.9 if authority != "OTHER" else 0.3

    number = labelled_text(
        joined,
        [
            r"\bDIN\b",
            r"document\s+identification\s+number",
            r"notice\s*(?:no|number)\.?",
            r"reference\s*(?:no|number)\.?",
            r"ref\.?\s*no\.?",
        ],
        r"[A-Z0-9][A-Z0-9/()\-.]{5,60}",
    )
    if number:
        fields["notice_number"] = number.rstrip(".")
        confidence["notice_number"] = 0.85
    else:
        hints.append("No DIN or notice number found - every valid notice carries one")

    section = _SECTION_RE.search(joined)
    form = _PROCEEDING_FORM_RE.search(joined)
    if form:
        fields["form"] = form.group(1).upper()
    if section:
        fields["section_code"], confidence["section_code"] = section.group(1), 0.85
    elif form:
        fields["section_code"], confidence["section_code"] = form.group(1).upper(), 0.7

    subject = labelled_text(joined, [r"\bsub(?:ject)?\b"], r"[^\n]{5,300}")
    if subject:
        fields["subject"] = subject[:500]
        confidence["subject"] = 0.8

    issued = labelled_date(joined, [r"date\s*of\s*issue", r"issued\s*on", r"dated", r"\bdate"])
    if issued:
        fields["issued_on"], confidence["issued_on"] = issued, 0.8

    due = labelled_date(
        joined,
        [
            r"on\s*or\s*before",
            r"reply\s*by",
            r"due\s*date(?:\s*for\s*(?:reply|response|compliance))?",
            r"last\s*date",
            r"latest\s*by",
            r"by\s*the",
        ],
    )
    if due:
        fields["due_date"], confidence["due_date"] = due, 0.85
    else:
        within = re.search(r"within\s+(\d{1,3})\s+days", joined, re.IGNORECASE)
        if within and issued:
            fields["due_date"] = issued + timedelta(days=int(within.group(1)))
            confidence["due_date"] = 0.6
            hints.append(
                f"Reply date computed as {within.group(1)} days from the issue date - "
                "confirm against the notice; service date may differ"
            )
        else:
            hints.append("No reply date found - set it manually before relying on reminders")

    demand = labelled_amount(
        lines,
        [
            r"demand",
            r"amount\s*payable",
            r"tax\s*payable",
            r"outstanding",
            r"sum\s*of",
            r"total\s*amount",
        ],
        strict=True,
    )
    if demand is not None:
        fields["demand_amount"], confidence["demand_amount"] = demand, 0.75

    return NoticeExtraction(fields=fields, confidence=confidence, hints=hints)


def extract_form16a(text: str) -> NoticeExtraction:
    """Form 16A: who deducted, from whom, under which section, how much."""
    joined = "\n".join(ln.strip() for ln in text.splitlines() if ln.strip())
    lines = joined.split("\n")
    fields: dict[str, object] = {}
    confidence: dict[str, float] = {}
    hints: list[str] = []

    tans = find_tans(joined)
    if tans:
        fields["deductor_tan"], confidence["deductor_tan"] = tans[0], 0.9
    pans = find_pans(joined)
    # The deductee's PAN is the one that is not embedded in the deductor's TAN
    # line; when several appear, the last one is usually the deductee block.
    if pans:
        fields["deductee_pan"], confidence["deductee_pan"] = pans[-1], 0.7

    section = re.search(r"\b(19[2-6][A-Z]{0,3})\b", joined)
    if section:
        fields["section"], confidence["section"] = section.group(1), 0.85

    quarter = re.search(r"\bQ([1-4])\b", joined)
    if quarter:
        fields["quarter"] = f"Q{quarter.group(1)}"
    ay = re.search(r"\b(20\d{2}-\d{2})\b", joined)
    if ay:
        fields["assessment_year"] = ay.group(1)

    paid = labelled_amount(lines, [r"amount\s*(?:paid|credited)", r"amount\s*of\s*payment"])
    tds = labelled_amount(lines, [r"tax\s*deducted", r"tds\s*amount", r"amount\s*of\s*tax"])
    if paid is not None:
        fields["amount_paid"], confidence["amount_paid"] = paid, 0.8
    if tds is not None:
        fields["tds_amount"], confidence["tds_amount"] = tds, 0.8
    if paid and tds and paid > 0 and tds / paid > Decimal("0.35"):
        hints.append("TDS is over 35% of the payment - check the two amounts are not swapped")
    if "deductor_tan" not in fields:
        hints.append("No deductor TAN found - a certificate without one cannot be matched to 26AS")

    return NoticeExtraction(fields=fields, confidence=confidence, hints=hints)
