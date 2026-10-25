"""Request and response bodies for clients - Module 2."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import ClientStatus, EntityType
from app.utils.identifiers import (
    gstin_checksum_ok,
    is_cin,
    is_gstin,
    is_pan,
    is_tan,
    normalise_gstin,
)


def _validate_pan(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    upper = value.strip().upper()
    if not is_pan(upper):
        raise ValueError("PAN must be 5 letters, 4 digits, 1 letter (e.g. AABCA1234M)")
    return upper


def _validate_gstin(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    upper = normalise_gstin(value)
    assert upper is not None
    if not is_gstin(upper):
        raise ValueError(
            "GSTIN must be 15 characters: 2-digit state code, 10-character PAN, "
            "entity digit, Z, check digit"
        )
    # The check digit catches a transposition that the format check cannot. A
    # wrong GSTIN silently breaks reconciliation for every invoice from that
    # supplier, so this is worth refusing at entry rather than discovering in
    # a mismatch report three months later.
    if not gstin_checksum_ok(upper):
        raise ValueError(
            f"GSTIN {upper} has an invalid check digit - the last character does "
            "not match the rest. Check for transposed characters."
        )
    return upper


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Short name for lists.")
    legal_name: str = Field(min_length=1, max_length=255)
    trade_name: str | None = Field(default=None, max_length=255)

    pan: str | None = Field(default=None, max_length=10)
    gstin: str | None = Field(default=None, max_length=15)
    cin: str | None = Field(default=None, max_length=21)
    tan: str | None = Field(default=None, max_length=10)

    entity_type: EntityType = EntityType.PRIVATE_LIMITED
    engaged_on: date | None = None
    manager_id: uuid.UUID | None = Field(
        default=None, description="Staff member who owns the relationship."
    )

    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=6)

    gst_frequency: str = Field(default="MONTHLY", pattern="^(MONTHLY|QUARTERLY)$")
    notes: str | None = None

    _check_pan = field_validator("pan")(_validate_pan)
    _check_gstin = field_validator("gstin")(_validate_gstin)

    @field_validator("cin")
    @classmethod
    def _check_cin(cls, value: str | None) -> str | None:
        if not value:
            return None
        upper = value.strip().upper()
        if not is_cin(upper):
            raise ValueError("CIN must be 21 characters, e.g. U74999MH2015PTC123456")
        return upper

    @field_validator("tan")
    @classmethod
    def _check_tan(cls, value: str | None) -> str | None:
        if not value:
            return None
        upper = value.strip().upper()
        if not is_tan(upper):
            raise ValueError("TAN must be 4 letters, 5 digits, 1 letter (e.g. MUMA12345B)")
        return upper


class ClientCreateIn(ClientBase):
    pass


class ClientUpdateIn(BaseModel):
    """Every field optional - a PATCH that required the whole object would make
    changing one phone number a chance to clobber everything else."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    legal_name: str | None = Field(default=None, min_length=1, max_length=255)
    trade_name: str | None = Field(default=None, max_length=255)
    pan: str | None = Field(default=None, max_length=10)
    gstin: str | None = Field(default=None, max_length=15)
    cin: str | None = Field(default=None, max_length=21)
    tan: str | None = Field(default=None, max_length=10)
    entity_type: EntityType | None = None
    status: ClientStatus | None = None
    engaged_on: date | None = None
    manager_id: uuid.UUID | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=6)
    gst_frequency: str | None = Field(default=None, pattern="^(MONTHLY|QUARTERLY)$")
    notes: str | None = None

    _check_pan = field_validator("pan")(_validate_pan)
    _check_gstin = field_validator("gstin")(_validate_gstin)


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firm_id: uuid.UUID
    name: str
    legal_name: str
    trade_name: str | None
    pan: str | None
    gstin: str | None
    cin: str | None
    tan: str | None
    entity_type: EntityType
    status: ClientStatus
    engaged_on: date | None
    manager_id: uuid.UUID | None
    email: str | None
    phone: str | None
    city: str | None
    state: str | None
    gst_frequency: str
    created_at: datetime
    updated_at: datetime


class ClientListOut(BaseModel):
    data: list[ClientOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class ContactCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    designation: str | None = Field(default=None, max_length=100)
    din: str | None = Field(default=None, pattern=r"^\d{8}$")
    pan: str | None = Field(default=None, max_length=10)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    is_signatory: bool = False

    _check_pan = field_validator("pan")(_validate_pan)


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    designation: str | None
    din: str | None
    pan: str | None
    email: str | None
    phone: str | None
    is_signatory: bool
