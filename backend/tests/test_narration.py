"""Narration parsing and the identifier-stripping guarantee."""

from __future__ import annotations

import pytest

from app.ml.ledger.narration import Channel, normalise, parse


class TestChannelDetection:
    @pytest.mark.parametrize(
        ("narration", "channel"),
        [
            ("UPI/DR/412345678901/SWIGGY/UTIB/swiggy.upi@axisb/Payment", Channel.UPI),
            ("NEFT DR-HDFC0000123-DEEPAK STEEL-N098765432", Channel.NEFT),
            ("RTGS-HDFCR52024010112345-GUPTA TEXTILES", Channel.RTGS),
            ("IMPS-412345678901-RAHUL SHARMA-HDFC", Channel.IMPS),
            ("ACH D- TP ACH RELIANCE JIO INFOCOMM-9876543210", Channel.ACH),
            ("NACH DR-LICI-LIC PREMIUM-123456", Channel.ACH),
            ("POS 412345XXXXXX1234 AMAZON RETAIL", Channel.POS),
            ("ATW-432112XXXXXX3456-HDFC ATM MUMBAI", Channel.ATM),
            ("CHQ PAID-123456-VENDOR", Channel.CHEQUE),
            ("INT.PD:01-07-2026 TO 30-09-2026", Channel.INTEREST),
            ("SMS ALERT CHG", Channel.CHARGE),
            ("GST PAYMENT CPIN 23041700012345", Channel.TAX),
            ("", Channel.UNKNOWN),
        ],
    )
    def test_detects(self, narration: str, channel: Channel) -> None:
        assert parse(narration).channel is channel

    def test_tax_beats_neft(self) -> None:
        """A GST payment often arrives as a NEFT with a CPIN in it.

        TAX is the more informative label, so it must win - which is why the
        pattern order in _CHANNEL_PATTERNS is load-bearing.
        """
        assert parse("NEFT DR-HDFC0000123-GST PAYMENT CPIN 23041700012345").channel is Channel.TAX


class TestIdentifierStripping:
    """The guarantee the model's honesty depends on.

    If identifiers survive into the features, TF-IDF learns that a particular
    12-digit UTR means Swiggy: useless at serving time, and it inflates holdout
    accuracy because the same identifiers appear on both sides of the split.
    """

    @pytest.mark.parametrize(
        "narration",
        [
            "UPI/DR/412345678901/SWIGGY/UTIB/swiggy.upi@axisb/Payment",
            "NEFT DR-HDFC0000123-DEEPAK STEEL SUPPLIERS-N098765432-INV 4451",
            "POS 412345XXXXXX1234 AMAZON RETAIL BENGALURU",
            "GST PAYMENT CPIN 23041700012345",
            "IMPS-412345678901-RAHUL SHARMA-HDFC-XXXXXXXX1234-RENT",
            "INT.PD:01-07-2026 TO 30-09-2026",
        ],
    )
    def test_no_identifier_token_survives(self, narration: str) -> None:
        """No token may carry a digit at all.

        Stricter than "no long digit runs", because the loose version let
        letter+digit stubs like ``HDFC0123`` and truncated UTRs like
        ``N098765432`` through - they are neither a full IFSC nor a pure digit
        run, but they are still per-transaction identifiers.
        """
        normalised = normalise(narration)
        leaked = [
            token
            # CH_ is the channel tag this module adds on purpose.
            for token in normalised.split()
            if not token.startswith("CH_") and any(c.isdigit() for c in token)
        ]
        assert not leaked, f"identifier leaked into features: {leaked}"

    def test_merchant_adjacent_to_a_vpa_is_not_eaten(self) -> None:
        """Regression: the VPA pattern allowed ``-`` in the local part, so it
        matched greedily across the delimiter and stripped the merchant name
        along with the address."""
        normalised = normalise("UPI-TVS AUTOMOBILES-x@ybl-HDFC0123-123456789012")
        assert "AUTOMOBILES" in normalised

    def test_ifsc_removed_from_text_but_kept_as_a_field(self) -> None:
        parsed = parse("NEFT DR-HDFC0000123-DEEPAK STEEL-N098765432")
        assert parsed.ifsc == "HDFC0000123"
        assert "HDFC0000123" not in parsed.normalised

    def test_vpa_removed_from_text_but_kept_as_a_field(self) -> None:
        parsed = parse("UPI/DR/412345678901/SWIGGY/UTIB/swiggy.upi@axisb/Payment")
        assert parsed.vpa == "swiggy.upi@axisb"
        assert parsed.vpa_handle == "axisb"
        assert "@" not in parsed.normalised

    def test_masked_card_captured(self) -> None:
        parsed = parse("POS 412345XXXXXX1234 AMAZON RETAIL BENGALURU")
        assert parsed.masked_account == "412345XXXXXX1234"

    def test_cpin_captured(self) -> None:
        assert parse("GST PAYMENT CPIN 23041700012345").cpin == "23041700012345"


class TestNormalisedOutput:
    def test_channel_tag_is_prepended(self) -> None:
        """So the model sees the channel as a feature even when the original
        tag was spelled oddly ("NEFT Cr-")."""
        assert normalise("NEFT Cr-HDFC0000123-ACME-123456").startswith("CH_NEFT")

    def test_merchant_survives(self) -> None:
        assert "SWIGGY" in normalise("UPI/DR/412345678901/SWIGGY/UTIB/x@axisb/Payment")

    def test_vowel_stripped_text_still_shares_character_grams(self) -> None:
        """Why char_wb n-grams are the primary feature: the corrupted and clean
        forms share no whole word, but most of their character grams."""
        clean = normalise("UPI-TVS AUTOMOBILES-x@ybl-HDFC0123-123456789012")
        corrupted = normalise("UPI-TVS ATMBLS-x@ybl-HDFC0123-123456789012")
        assert "TVS" in clean and "TVS" in corrupted
        assert "AUTOMOBILES" in clean
        assert "AUTOMOBILES" not in corrupted

    def test_empty_input_does_not_raise(self) -> None:
        assert normalise("") == "CH_UNKNOWN"


class TestCounterparty:
    def test_extracts_a_name(self) -> None:
        parsed = parse("NEFT DR-HDFC0000123-DEEPAK STEEL SUPPLIERS-N098765432")
        assert parsed.counterparty is not None
        assert "DEEPAK STEEL SUPPLIERS" in parsed.counterparty

    @pytest.mark.parametrize(
        "narration",
        ["INT.PD:01-07-2026 TO 30-09-2026", "SMS ALERT CHG", "ATW-432112XXXXXX3456-ATM"],
    )
    def test_no_counterparty_for_bank_side_entries(self, narration: str) -> None:
        """Interest, charges and ATM withdrawals have no other party - the bank
        itself is the counterparty - so claiming one would be noise."""
        assert parse(narration).counterparty is None
