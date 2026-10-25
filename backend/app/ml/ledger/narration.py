"""Bank narration parsing.

An Indian bank statement line is a channel tag, some routing identifiers and a
counterparty name, crammed into 50-120 characters with no agreed format. Real
examples:

    UPI/DR/412345678901/SWIGGY/UTIB/swiggy.upi@axisb/Payment
    NEFT DR-HDFC0000123-DEEPAK STEEL SUPPLIERS-N098765432-INV 4451
    ACH D- TP ACH RELIANCE JIO INFOCOMM-9876543210
    POS 412345XXXXXX1234 AMAZON RETAIL BENGALURU
    INT.PD:01-07-2026 TO 30-09-2026

Two jobs here, and keeping them apart is the point:

1. **Parse** - pull out the channel, counterparty and identifiers as structured
   fields. Deterministic, regex-based, testable.
2. **Normalise** - produce a cleaned string for the classifier, with the
   high-entropy identifiers (UTR numbers, account digits, card numbers)
   *removed*. This matters more than it looks: left in, a TF-IDF model happily
   learns that the 12-digit UPI reference ``412345678901`` means Swiggy, which
   is both useless and a memorisation leak that inflates test accuracy.

The parse is kept on the row as ``normalised_narration`` and ``counterparty``
so the original ``narration`` is never destroyed - a better parser can always
be re-run against the source text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import StrEnum


class Channel(StrEnum):
    """How the money moved. A strong feature in its own right: an ACH debit is
    almost always a recurring bill, an IMPS credit almost never is."""

    UPI = "UPI"
    NEFT = "NEFT"
    RTGS = "RTGS"
    IMPS = "IMPS"
    ACH = "ACH"
    CHEQUE = "CHEQUE"
    ATM = "ATM"
    POS = "POS"
    CASH = "CASH"
    #: Bank's own charges - SMS alerts, folio fees, cheque return charges.
    CHARGE = "CHARGE"
    #: Interest credited or debited by the bank itself.
    INTEREST = "INTEREST"
    #: Transfer between the client's own accounts.
    INTERNAL = "INTERNAL"
    #: Direct tax / GST payments through the bank's portal.
    TAX = "TAX"
    UNKNOWN = "UNKNOWN"


# Ordered: the first match wins, so more specific patterns come first. ACH
# before NEFT because "NACH" contains neither cleanly, and TAX before NEFT
# because a GST payment often arrives as a NEFT with a CPIN in it.
_CHANNEL_PATTERNS: tuple[tuple[Channel, re.Pattern[str]], ...] = (
    (Channel.TAX, re.compile(r"\b(CPIN|CHALLAN|GST\s*(PMT|PAYMENT)|TDS\s*PAYMENT|ITNS|SELF\s*ASST)\b")),
    (Channel.UPI, re.compile(r"\bUPI\b|@(?:ok\w+|paytm|ybl|axisb|hdfcbank|icici|upi|sbi)\b")),
    (Channel.ACH, re.compile(r"\b(N?ACH|ECS|MANDATE|SI\s*DR|AUTO\s*DEBIT)\b")),
    (Channel.RTGS, re.compile(r"\bRTGS\b")),
    (Channel.NEFT, re.compile(r"\bNEFT\b")),
    (Channel.IMPS, re.compile(r"\bIMPS\b")),
    (Channel.POS, re.compile(r"\b(POS|DEBIT\s*CARD|CARD\s*PUR|ECOM|MERCHANT)\b")),
    (Channel.ATM, re.compile(r"\b(ATW|NWD|ATM|CASH\s*WDL|WITHDRAWAL)\b")),
    (Channel.CHEQUE, re.compile(r"\b(CHQ|CHEQUE|CLG|CTS|INWARD\s*CLG|OUTWARD\s*CLG)\b")),
    (Channel.CASH, re.compile(r"\bCASH\s*(DEP|DEPOSIT|RECD)\b")),
    (Channel.INTEREST, re.compile(r"\b(INT\.?\s*(PD|CR|PAID)|CREDIT\s*INTEREST|INTEREST\s*CAPITALISED)\b")),
    (Channel.CHARGE, re.compile(r"\b(CHARGES?|CHG|FEE|COMMISSION\s*DR|GST\s*ON|FOLIO|AMB\s*CHG|PENAL)\b")),
    (Channel.INTERNAL, re.compile(r"\b(SELF|OWN\s*A\/?C|FUND\s*TRF|TRF\s*TO\s*OWN|SWEEP)\b")),
)

#: IFSC: 4 letters, a 0, then 6 alphanumerics.
IFSC_RE = re.compile(r"\b([A-Z]{4}0[A-Z0-9]{6})\b")
#: UPI virtual payment address.
#:
#: The local part deliberately excludes ``-``. Allowing it made the match
#: greedy across a hyphen delimiter, so ``TVS AUTOMOBILES-x@ybl`` matched from
#: ``AUTOMOBILES`` onwards and the stripping step ate the merchant name - the
#: single most informative token in the line. Real VPAs may contain a hyphen,
#: but missing one of those costs almost nothing, while losing a merchant name
#: costs the prediction.
VPA_RE = re.compile(r"\b([a-zA-Z0-9._]{2,})@([a-zA-Z]{2,})\b")
#: UTR / reference: a long digit run, optionally prefixed by a letter.
UTR_RE = re.compile(r"\b[A-Z]?\d{9,22}\b")
#: Masked card or account, e.g. ``412345XXXXXX1234`` or ``XXXXXXXX1234``.
MASKED_RE = re.compile(r"\b[\dX*]{4,6}[X*]{4,8}\d{3,4}\b", re.IGNORECASE)
#: A CPIN is 14 digits; keeping it would be an identifier leak like any other.
CPIN_RE = re.compile(r"\bCPIN[:\s-]*(\d{14})\b")

_DATE_RE = re.compile(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b")
_PURE_DIGITS_RE = re.compile(r"\b\d{4,}\b")
#: A token containing both letters and digits - an identifier fragment.
_ALNUM_MIX_RE = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Z0-9]+$")

#: Tokens that carry no information about which ledger applies. Removing them
#: stops the model spending its capacity on boilerplate.
_STOPWORD_TOKENS = frozenset(
    {
        "DR", "CR", "TO", "FROM", "PAYMENT", "PAYMENTS", "PAID", "PAY",
        "TRANSFER", "TRF", "TXN", "REF", "REFNO", "NO", "A", "AC", "ACC",
        "ACCOUNT", "THE", "OF", "FOR", "VIA", "BY", "P2A", "P2M", "TP",
        "COLLECT", "RECD", "RECEIVED", "SENT", "INB", "IB", "NB", "MB",
    }
)


@dataclass(slots=True)
class ParsedNarration:
    """Structured view of one statement line."""

    raw: str
    channel: Channel
    #: Best guess at the other party. ``None`` when nothing name-like survived.
    counterparty: str | None
    #: Cleaned text for the classifier - identifiers stripped.
    normalised: str
    ifsc: str | None = None
    vpa: str | None = None
    #: The VPA handle, e.g. ``okhdfcbank``. Weakly informative on its own but
    #: cheap to keep.
    vpa_handle: str | None = None
    utr: str | None = None
    masked_account: str | None = None
    cpin: str | None = None
    tokens: list[str] = field(default_factory=list)

    @property
    def has_counterparty(self) -> bool:
        return bool(self.counterparty)


def detect_channel(narration: str) -> Channel:
    upper = narration.upper()
    for channel, pattern in _CHANNEL_PATTERNS:
        if pattern.search(upper):
            return channel
    return Channel.UNKNOWN


def _strip_identifiers(text: str) -> str:
    """Remove every high-entropy identifier.

    Order matters: the composite patterns (masked card, IFSC, VPA) go before
    the generic long-digit sweep, otherwise the digit sweep mangles them into
    fragments that survive as noise tokens.
    """
    out = text
    out = CPIN_RE.sub(" ", out)
    out = MASKED_RE.sub(" ", out)
    out = IFSC_RE.sub(" ", out)
    out = VPA_RE.sub(" ", out)
    out = UTR_RE.sub(" ", out)
    out = _DATE_RE.sub(" ", out)
    out = _PURE_DIGITS_RE.sub(" ", out)
    return out


def _tokenise(text: str) -> list[str]:
    # Split on anything that is not a letter or digit: the separators in bank
    # narrations are arbitrary and inconsistent (``/``, ``-``, ``*``, ``.``).
    rough = re.split(r"[^A-Za-z0-9]+", text.upper())
    return [
        token
        for token in rough
        if len(token) > 1
        and token not in _STOPWORD_TOKENS
        # Pure digits are leftover identifier fragments.
        and not token.isdigit()
        # So are letter+digit mixes. A short IFSC-like stub (HDFC0123), a
        # truncated UTR (N098765432) or a branch code survives the regex sweep
        # because it is neither a full IFSC nor a pure digit run, but it is
        # still a per-transaction identifier - exactly the kind of feature a
        # TF-IDF model would memorise instead of learning the merchant.
        # Indian merchant names essentially never mix digits into a word.
        and not _ALNUM_MIX_RE.match(token)
    ]


def _guess_counterparty(tokens: list[str], channel: Channel) -> str | None:
    """Pick the span most likely to be a party name.

    Heuristic, and honest about it: the longest run of consecutive alphabetic
    tokens. Bank narrations put the name in different positions per channel and
    per bank, but it is reliably the longest stretch of actual words once the
    identifiers and channel tags are gone.
    """
    if channel in {Channel.INTEREST, Channel.CHARGE, Channel.ATM, Channel.CASH}:
        # These have no counterparty - the bank itself is the other side.
        return None

    channel_tags = {c.value for c in Channel} | {"NACH", "ECS", "ATW", "NWD", "CLG", "CTS"}
    best: list[str] = []
    current: list[str] = []

    for token in tokens:
        if token.isalpha() and token not in channel_tags:
            current.append(token)
        else:
            if len(current) > len(best):
                best = current
            current = []
    if len(current) > len(best):
        best = current

    return " ".join(best) if best else None


def parse(narration: str) -> ParsedNarration:
    """Parse one narration into structured fields plus normalised text."""
    raw = narration.strip()
    upper = raw.upper()
    channel = detect_channel(raw)

    ifsc_match = IFSC_RE.search(upper)
    vpa_match = VPA_RE.search(raw)
    utr_match = UTR_RE.search(upper)
    masked_match = MASKED_RE.search(upper)
    cpin_match = CPIN_RE.search(upper)

    stripped = _strip_identifiers(upper)
    tokens = _tokenise(stripped)

    # The channel tag is prepended as an explicit token so the model sees it as
    # a feature even when the original tag was spelled oddly ("NEFT Cr-").
    normalised_tokens = [f"CH_{channel.value}", *tokens]

    return ParsedNarration(
        raw=raw,
        channel=channel,
        counterparty=_guess_counterparty(tokens, channel),
        normalised=" ".join(normalised_tokens),
        ifsc=ifsc_match.group(1) if ifsc_match else None,
        vpa=vpa_match.group(0) if vpa_match else None,
        vpa_handle=vpa_match.group(2).lower() if vpa_match else None,
        utr=utr_match.group(0) if utr_match else None,
        masked_account=masked_match.group(0) if masked_match else None,
        cpin=cpin_match.group(1) if cpin_match else None,
        tokens=tokens,
    )


def normalise(narration: str) -> str:
    """Just the cleaned text. Shorthand for ``parse(n).normalised``."""
    return parse(narration).normalised
