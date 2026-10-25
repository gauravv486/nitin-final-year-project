"""Request-schema validation.

Runs without a database: this is pure Pydantic, and it is where bad data is
supposed to be stopped. The GSTIN checksum test is the one that matters most -
a wrong GSTIN accepted here silently breaks reconciliation for every invoice
from that supplier, and the symptom appears months later as an unexplained
mismatch.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import MAX_PASSWORD_BYTES, LoginIn, RegisterFirmIn
from app.schemas.client import ClientCreateIn, ClientUpdateIn, ContactCreateIn


def register_payload(**overrides) -> dict:
    base = {
        "firm_name": "Sharma & Associates",
        "email": "ca@sharma.in",
        "first_name": "Rohit",
        "last_name": "Sharma",
        "password": "correct horse battery",
    }
    return base | overrides


class TestRegister:
    def test_accepts_a_sound_payload(self) -> None:
        model = RegisterFirmIn(**register_payload())
        assert model.firm_name == "Sharma & Associates"

    @pytest.mark.parametrize("bad", ["short", "1234567", ""])
    def test_rejects_a_short_password(self, bad: str) -> None:
        with pytest.raises(ValidationError):
            RegisterFirmIn(**register_payload(password=bad))

    def test_rejects_a_password_bcrypt_would_truncate(self) -> None:
        """bcrypt ignores everything past 72 bytes.

        Accepting a 200-character password would give the user less security
        than they believe they have, which is worse than refusing it.
        """
        with pytest.raises(ValidationError, match=f"{MAX_PASSWORD_BYTES} bytes"):
            RegisterFirmIn(**register_payload(password="a" * 73))

    def test_multibyte_password_is_measured_in_bytes_not_characters(self) -> None:
        """A 30-character Devanagari password is 90 bytes.

        Counting characters would let it through and then silently truncate it.
        """
        with pytest.raises(ValidationError):
            RegisterFirmIn(**register_payload(password="पासवर्ड" * 15))

    @pytest.mark.parametrize("bad", ["notanemail", "a@", "@b.in", ""])
    def test_rejects_a_malformed_email(self, bad: str) -> None:
        with pytest.raises(ValidationError):
            RegisterFirmIn(**register_payload(email=bad))

    def test_login_requires_both_fields(self) -> None:
        with pytest.raises(ValidationError):
            LoginIn(email="ca@sharma.in")  # type: ignore[call-arg]


def client_payload(**overrides) -> dict:
    base = {"name": "Arora Trading", "legal_name": "Arora Trading Private Limited"}
    return base | overrides


class TestClientIdentifiers:
    def test_minimal_client_is_valid(self) -> None:
        model = ClientCreateIn(**client_payload())
        assert model.pan is None
        assert model.gst_frequency == "MONTHLY"

    def test_pan_is_upper_cased(self) -> None:
        model = ClientCreateIn(**client_payload(pan="aabca1234m"))
        assert model.pan == "AABCA1234M"

    @pytest.mark.parametrize("bad", ["AABCA1234", "1ABCA1234M", "AABC11234M"])
    def test_rejects_a_malformed_pan(self, bad: str) -> None:
        """Wrong shape at the right length - these reach the format validator."""
        with pytest.raises(ValidationError, match="PAN"):
            ClientCreateIn(**client_payload(pan=bad))

    def test_rejects_an_over_long_pan(self) -> None:
        """Caught by max_length before the format validator runs.

        Still rejected, just with Pydantic's own message rather than ours -
        asserted separately so the message assertions above stay precise.
        """
        with pytest.raises(ValidationError, match="at most 10 characters"):
            ClientCreateIn(**client_payload(pan="AABCA12345M"))

    def test_blank_identifier_becomes_none(self) -> None:
        """An empty form field must not be stored as an empty string - the
        per-firm unique constraint would then reject the second client who also
        left it blank."""
        model = ClientCreateIn(**client_payload(pan="", gstin=""))
        assert model.pan is None
        assert model.gstin is None

    def test_rejects_a_gstin_with_a_bad_check_digit(self) -> None:
        """The check the format regex cannot do.

        ``27AABCA1234M1Z5`` is well-formed in shape; whether the final
        character is right depends on the other fourteen. A transposition
        passes the regex and fails here.
        """
        with pytest.raises(ValidationError, match="check digit"):
            ClientCreateIn(**client_payload(gstin="27AABCA1234M1Z9"))

    @pytest.mark.parametrize(
        "bad",
        [
            "27AABCA1234M1Z",    # 14 characters
            "27AABCA1234M1Y5",   # 14th must be Z
            "99AABCA1234M1Z5",   # state code out of range
        ],
    )
    def test_rejects_a_malformed_gstin(self, bad: str) -> None:
        with pytest.raises(ValidationError, match="GSTIN"):
            ClientCreateIn(**client_payload(gstin=bad))

    def test_rejects_a_malformed_cin(self) -> None:
        with pytest.raises(ValidationError, match="CIN"):
            ClientCreateIn(**client_payload(cin="X74999MH2015PTC123456"))

    def test_accepts_a_valid_cin(self) -> None:
        model = ClientCreateIn(**client_payload(cin="u74999mh2015ptc123456"))
        assert model.cin == "U74999MH2015PTC123456"

    def test_rejects_a_malformed_tan(self) -> None:
        with pytest.raises(ValidationError, match="TAN"):
            ClientCreateIn(**client_payload(tan="MUM12345B"))

    @pytest.mark.parametrize("bad", ["WEEKLY", "monthly", ""])
    def test_rejects_an_unsupported_gst_frequency(self, bad: str) -> None:
        with pytest.raises(ValidationError):
            ClientCreateIn(**client_payload(gst_frequency=bad))


class TestClientUpdate:
    def test_omitted_fields_are_not_in_the_dump(self) -> None:
        """What makes PATCH behave like PATCH.

        Without ``exclude_unset`` every absent field would be written as its
        default, so changing one phone number would wipe the address.
        """
        model = ClientUpdateIn(phone="9876543210")
        changes = model.model_dump(exclude_unset=True)
        assert changes == {"phone": "9876543210"}

    def test_explicit_null_is_distinguishable_from_absent(self) -> None:
        """Clearing a field and not mentioning it are different intents."""
        cleared = ClientUpdateIn(**{"notes": None}).model_dump(exclude_unset=True)
        assert cleared == {"notes": None}
        assert ClientUpdateIn().model_dump(exclude_unset=True) == {}

    def test_identifier_validation_applies_on_update_too(self) -> None:
        with pytest.raises(ValidationError, match="check digit"):
            ClientUpdateIn(gstin="27AABCA1234M1Z9")


class TestContact:
    def test_din_must_be_eight_digits(self) -> None:
        with pytest.raises(ValidationError):
            ContactCreateIn(name="R Menon", din="1234567")

    def test_valid_contact(self) -> None:
        model = ContactCreateIn(
            name="R Menon", din="12345678", designation="Director", is_signatory=True
        )
        assert model.is_signatory is True
