"""Indian statutory identifier formats.

These are *format* checks, not existence checks. A well-formed GSTIN may still
belong to nobody; only the government portal can answer that. Anything here
that claimed more than shape would be lying.

The GSTIN checksum is the exception worth having: it catches a transposed digit
at the point of entry, and a transposed digit in a supplier GSTIN silently
breaks reconciliation for that invoice for ever.
"""

from __future__ import annotations

import re

#: ``AAAAA9999A`` - five letters, four digits, one letter.
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

#: 15 characters: 2-digit state code, the holder's 10-character PAN, a 1-digit
#: entity number, a filler letter (currently always Z), then a checksum.
GSTIN_RE = re.compile(r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")

#: 21 characters, e.g. ``U74999MH2015PTC123456``.
CIN_RE = re.compile(r"^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$")

#: ``AAAA99999A``
TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]$")

#: Director Identification Number - 8 digits.
DIN_RE = re.compile(r"^[0-9]{8}$")

#: Universal Account Number (PF) - 12 digits.
UAN_RE = re.compile(r"^[0-9]{12}$")

#: 6 digits, first may not be zero.
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")

_BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def is_pan(value: str | None) -> bool:
    return bool(value) and PAN_RE.match(value.strip().upper()) is not None  # type: ignore[union-attr]


def is_gstin(value: str | None) -> bool:
    return bool(value) and GSTIN_RE.match(value.strip().upper()) is not None  # type: ignore[union-attr]


def is_cin(value: str | None) -> bool:
    return bool(value) and CIN_RE.match(value.strip().upper()) is not None  # type: ignore[union-attr]


def is_tan(value: str | None) -> bool:
    return bool(value) and TAN_RE.match(value.strip().upper()) is not None  # type: ignore[union-attr]


def gstin_check_digit(first14: str) -> str | None:
    """The check character for the first 14 characters of a GSTIN.

    A base-36 weighted sum with alternating weights of 1 and 2, where each
    product's overflow past 36 is folded back in. ``None`` if any character is
    outside 0-9/A-Z.
    """
    total = 0
    for index, char in enumerate(first14.upper()[:14]):
        code_point = _BASE36.find(char)
        if code_point < 0:
            return None
        weighted = code_point * (1 if index % 2 == 0 else 2)
        total += weighted // 36 + weighted % 36
    return _BASE36[(36 - (total % 36)) % 36]


def gstin_checksum_ok(value: str) -> bool:
    """Verify the 15th character against the first 14."""
    gstin = value.strip().upper()
    if not GSTIN_RE.match(gstin):
        return False
    return gstin_check_digit(gstin[:14]) == gstin[14]


def pan_from_gstin(gstin: str) -> str | None:
    """The 10 PAN characters embedded in a GSTIN, positions 3-12."""
    upper = gstin.strip().upper()
    return upper[2:12] if GSTIN_RE.match(upper) else None


def state_code_from_gstin(gstin: str) -> str | None:
    upper = gstin.strip().upper()
    return upper[:2] if GSTIN_RE.match(upper) else None


def normalise_invoice_no(value: str) -> str:
    """Strip every non-alphanumeric character and upper-case the rest.

    The invoice number is the reconciliation join key, and suppliers are wildly
    inconsistent about punctuation: ``DS/2026/0441``, ``ds-2026-0441`` and
    ``DS 2026 0441`` are one invoice. Normalising before comparison is what
    turns a false mismatch into a match.
    """
    return re.sub(r"[^A-Za-z0-9]", "", value).upper()


def normalise_name(value: str) -> str:
    """Collapse whitespace and casing, so ``Deepak  Steel`` meets ``DEEPAK STEEL``."""
    return re.sub(r"\s+", " ", value).strip().upper()


def normalise_gstin(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s", "", value).upper()
    return cleaned or None


#: GST state codes, used to label a supplier's state and to decide whether a
#: supply is inter-state (which changes whether IGST or CGST+SGST applies).
GST_STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
}


def state_name_from_gstin(gstin: str) -> str | None:
    code = state_code_from_gstin(gstin)
    return GST_STATE_CODES.get(code) if code else None
