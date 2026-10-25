"""Statutory identifier formats and the GSTIN checksum."""

from __future__ import annotations

import pytest

from app.utils.identifiers import (
    gstin_checksum_ok,
    is_cin,
    is_gstin,
    is_pan,
    is_tan,
    normalise_invoice_no,
    normalise_name,
    pan_from_gstin,
    state_code_from_gstin,
    state_name_from_gstin,
)


class TestPan:
    @pytest.mark.parametrize("value", ["AABCA1234M", "aabca1234m", " AABCA1234M "])
    def test_accepts_valid(self, value: str) -> None:
        assert is_pan(value)

    @pytest.mark.parametrize(
        "value",
        [
            "AABCA1234",     # too short
            "AABCA12345M",   # too many digits
            "AABC1A234M",    # digit in the letter block
            "1ABCA1234M",
            "",
            None,
        ],
    )
    def test_rejects_invalid(self, value: str | None) -> None:
        assert not is_pan(value)


class TestGstin:
    def test_accepts_valid_shape(self) -> None:
        assert is_gstin("27AABCA1234M1Z5")

    @pytest.mark.parametrize(
        "value",
        [
            "27AABCA1234M1Z",    # 14 chars
            "27AABCA1234M1Y5",   # 14th char must be Z
            "99AABCA1234M1Z5",   # state code out of range
            "",
        ],
    )
    def test_rejects_invalid(self, value: str) -> None:
        assert not is_gstin(value)

    def test_extracts_embedded_pan(self) -> None:
        assert pan_from_gstin("27AABCA1234M1Z5") == "AABCA1234M"

    def test_extracts_state(self) -> None:
        assert state_code_from_gstin("27AABCA1234M1Z5") == "27"
        assert state_name_from_gstin("27AABCA1234M1Z5") == "Maharashtra"
        assert state_name_from_gstin("29AABCK7890N1Z4") == "Karnataka"

    def test_extraction_returns_none_on_malformed(self) -> None:
        assert pan_from_gstin("nonsense") is None
        assert state_code_from_gstin("nonsense") is None

    def test_checksum_rejects_a_transposition(self) -> None:
        """The point of the checksum: catch a swapped pair at data entry.

        Transposing two characters keeps the format valid, so the regex passes
        and only the check digit notices. At most one of these two can be
        genuine, which is the assertion - a transposition cannot leave the
        checksum intact.
        """
        original = "27AABCA1234M1Z5"
        transposed = "27AABCA1243M1Z5"  # 34 -> 43
        assert is_gstin(transposed), "transposition keeps the format valid"
        assert not (gstin_checksum_ok(original) and gstin_checksum_ok(transposed))

    def test_checksum_requires_valid_format(self) -> None:
        assert not gstin_checksum_ok("garbage")


class TestOtherIdentifiers:
    def test_cin(self) -> None:
        assert is_cin("U74999MH2015PTC123456")
        assert not is_cin("X74999MH2015PTC123456")  # must start L or U

    def test_tan(self) -> None:
        assert is_tan("MUMA12345B")
        assert not is_tan("MUM12345B")


class TestNormalisation:
    def test_invoice_numbers_converge(self) -> None:
        """The reconciliation join key.

        These three are one invoice, and a matcher comparing them raw reports
        two false mismatches.
        """
        variants = ["DS/2026/0441", "ds-2026-0441", "DS 2026 0441", "ds.2026.0441"]
        assert len({normalise_invoice_no(v) for v in variants}) == 1
        assert normalise_invoice_no("DS/2026/0441") == "DS20260441"

    def test_different_invoices_stay_different(self) -> None:
        assert normalise_invoice_no("DS/2026/0441") != normalise_invoice_no("DS/2026/0442")

    def test_names_collapse_whitespace_and_case(self) -> None:
        assert normalise_name("Deepak  Steel ") == "DEEPAK STEEL"
        assert normalise_name("deepak steel") == normalise_name("DEEPAK   STEEL")
