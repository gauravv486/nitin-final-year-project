"""Primitives shared by the invoice, notice and certificate extractors.

The GSTIN finder is the interesting one. OCR confuses ``0``/``O``, ``1``/``I``,
``5``/``S``, ``8``/``B`` and ``2``/``Z`` constantly, and a GSTIN with one
wrong character silently breaks reconciliation for that supplier. But the
check digit means a misread GSTIN usually *fails* validation - so a candidate
that fails can be repaired by trying the classic confusions at positions where
the GSTIN grammar says the other character class belongs, and accepted only if
the repair makes the checksum pass. The checksum is the referee; the repair is
never a guess the checksum has not confirmed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.utils.identifiers import GSTIN_RE, gstin_checksum_ok
from app.utils.tabular import parse_amount, parse_date

#: Loose: lets OCR-confused characters through so they can be repaired.
_GSTIN_LOOSE = re.compile(r"(?<![A-Z0-9])([0-9OISZB]{2}[A-Z0-9]{13})(?![A-Z0-9])")
_PAN_RE = re.compile(r"(?<![A-Z0-9])([A-Z]{5}[0-9]{4}[A-Z])(?![A-Z0-9])")
_TAN_RE = re.compile(r"(?<![A-Z0-9])([A-Z]{4}[0-9]{5}[A-Z])(?![A-Z0-9])")

#: Letter-for-digit and digit-for-letter confusions in OCR output.
_TO_DIGIT = {"O": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
_TO_LETTER = {v: k for k, v in _TO_DIGIT.items() if k not in ("D", "L", "G")}

#: Position classes in a GSTIN: D digit, L letter, A either.
_GSTIN_SHAPE = "DDLLLLLDDDDLAZA"

AMOUNT_RE = re.compile(r"\(?-?\s*(?:₹|Rs\.?|INR)?\s*\d[\d,]*(?:\.\d{1,2})?\)?")

_DATE_PATTERNS = [
    r"\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}",
    r"\d{4}-\d{2}-\d{2}",
    r"\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s\-,]+\d{2,4}",
]
DATE_RE = re.compile("|".join(f"(?:{p})" for p in _DATE_PATTERNS), re.IGNORECASE)


@dataclass(slots=True)
class GstinHit:
    value: str
    #: Character offset in the text, used to work out which party it belongs to.
    position: int
    #: True if the raw text was repaired to get here.
    repaired: bool
    raw: str


def _repair_gstin(candidate: str) -> str | None:
    """Return a checksum-valid GSTIN reachable by fixing OCR confusions."""
    if GSTIN_RE.match(candidate) and gstin_checksum_ok(candidate):
        return candidate

    # First coerce each position to its grammatical class.
    chars = list(candidate)
    for i, kind in enumerate(_GSTIN_SHAPE):
        if kind == "D" and not chars[i].isdigit():
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])
        elif kind == "L" and not chars[i].isalpha():
            chars[i] = _TO_LETTER.get(chars[i], chars[i])
        elif kind == "Z" and chars[i] == "2":
            chars[i] = "Z"
    coerced = "".join(chars)
    if GSTIN_RE.match(coerced) and gstin_checksum_ok(coerced):
        return coerced
    # Deliberately no further guessing. Positions 13 and 15 accept either a
    # letter or a digit, so swapping a character there changes nothing the
    # grammar can object to - and the checksum alone would accept one wrong
    # swap in 36, turning a misread check digit into a *different taxpayer's*
    # registration. Only characters the grammar says are impossible as read
    # are ever changed.
    return None


def find_gstins(text: str) -> list[GstinHit]:
    upper = text.upper()
    hits: list[GstinHit] = []
    seen: set[str] = set()
    for match in _GSTIN_LOOSE.finditer(upper):
        raw = match.group(1)
        fixed = _repair_gstin(raw)
        if fixed is None or fixed in seen:
            continue
        seen.add(fixed)
        hits.append(GstinHit(value=fixed, position=match.start(), repaired=fixed != raw, raw=raw))
    return hits


def find_pans(text: str) -> list[str]:
    return list(dict.fromkeys(_PAN_RE.findall(text.upper())))


def find_tans(text: str) -> list[str]:
    return list(dict.fromkeys(_TAN_RE.findall(text.upper())))


#: Unmistakably money: a currency marker, Indian/Western digit grouping, or
#: paise. A bare ``2026`` is far more often a year than a rupee amount.
_MONEY_SHAPE = re.compile(r"(?:₹|Rs\.?|INR)\s*\d|\d{1,3}(?:,\d{2,3})+|\d+\.\d{2}\b", re.IGNORECASE)


def amounts_in(line: str, *, strict: bool = False) -> list[Decimal]:
    """Every money-looking number on a line, in order.

    Percentages are dropped first: on ``CGST @ 9% 40,500.00`` the 9 is a rate,
    and taking it as the amount is the classic extraction bug. ``strict``
    additionally drops bare integers - on prose like a notice, "March 2026"
    sits next to the word "payment" and must not become a ₹2,026 demand.
    """
    cleaned = re.sub(r"\d+(?:\.\d+)?\s*%", " ", line)
    values = []
    for token in AMOUNT_RE.findall(cleaned):
        if strict and not _MONEY_SHAPE.search(token):
            continue
        amount = parse_amount(token)
        if amount is not None:
            values.append(amount)
    return values


def labelled_amount(
    lines: list[str],
    labels: list[str],
    *,
    exclude: list[str] | None = None,
    strict: bool = False,
) -> Decimal | None:
    """The amount on the first line that carries one of ``labels``.

    The *last* number on that line is taken: in ``Taxable Value 9 4,50,000``
    leading numbers are quantities or rates, and the line's total is rightmost.
    """
    pattern = re.compile(r"\b(?:" + "|".join(labels) + r")\b", re.IGNORECASE)
    blocked = re.compile(r"\b(?:" + "|".join(exclude) + r")\b", re.IGNORECASE) if exclude else None
    for line in lines:
        if not pattern.search(line) or (blocked and blocked.search(line)):
            continue
        after = line[pattern.search(line).end() :]  # type: ignore[union-attr]
        values = amounts_in(after, strict=strict)
        if values:
            return values[-1]
    return None


def labelled_date(text: str, labels: list[str]) -> date | None:
    pattern = re.compile(
        r"(?:" + "|".join(labels) + r")\s*[:.\-]?\s*(" + DATE_RE.pattern + r")",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if match:
        return parse_date(_tidy_date(match.group(1)))
    return None


def first_date(text: str) -> date | None:
    for match in DATE_RE.finditer(text):
        parsed = parse_date(_tidy_date(match.group(0)))
        if parsed:
            return parsed
    return None


def _tidy_date(value: str) -> str:
    text = re.sub(r"[,]+", " ", value.strip())
    text = re.sub(r"\s+", " ", text)
    # "05 Sept 2026" -> "05 Sep 2026"; strptime knows only three-letter forms.
    text = re.sub(r"(?i)\bsept\b", "Sep", text)
    text = re.sub(
        r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b",
        lambda m: m.group(1).title(),
        text,
    )
    return text


def labelled_text(text: str, labels: list[str], value_pattern: str) -> str | None:
    pattern = re.compile(
        r"(?:" + "|".join(labels) + r")\s*[:.\-#]?\s*(" + value_pattern + r")",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    return match.group(1).strip() if match else None
