"""Request and response bodies for authentication."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import FirmRole, UserStatus

#: bcrypt truncates at 72 bytes, so accepting more would silently ignore the
#: tail. Rejecting it is honest; 8 is the lower bound worth enforcing.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72


class PasswordMixin(BaseModel):
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)

    @field_validator("password")
    @classmethod
    def _fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(
                f"Password must be at most {MAX_PASSWORD_BYTES} bytes; "
                "bcrypt ignores anything beyond that, so a longer one would "
                "give you less security than it appears to."
            )
        return value


class RegisterFirmIn(PasswordMixin):
    """Creates a firm and its first user in one transaction.

    There is no separate "create firm" endpoint: a firm with no users is
    unreachable, and a user with no firm has no tenant. Both or neither.
    """

    firm_name: str = Field(min_length=2, max_length=255)
    frn: str | None = Field(default=None, max_length=20, description="ICAI registration number.")
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10)


class InviteUserIn(BaseModel):
    """Adds a colleague to the caller's firm.

    No password: the invitee sets their own. An invite that carries a password
    chosen by somebody else is a credential two people know.
    """

    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: FirmRole = FirmRole.STAFF
    phone: str | None = Field(default=None, max_length=20)
    #: Required when role is CLIENT - a portal user must be pinned to one client.
    client_id: uuid.UUID | None = None


class AcceptInviteIn(PasswordMixin):
    token: str = Field(min_length=10)


class ChangePasswordIn(PasswordMixin):
    current_password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firm_id: uuid.UUID
    client_id: uuid.UUID | None
    email: EmailStr
    first_name: str
    last_name: str
    phone: str | None
    role: FirmRole
    status: UserStatus
    last_login_at: datetime | None
    created_at: datetime


class MeOut(UserOut):
    """``/me``, with the extras the frontend needs.

    ``ui_role`` collapses the seven database roles onto the three the existing
    ``frontend/lib/nav.ts`` switches on, so the sidebar needs no changes.
    """

    full_name: str
    ui_role: str
    firm_name: str


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    #: Seconds until the access token expires, for the client's refresh timer.
    expires_in: int
    user: MeOut


class AccessTokenOut(BaseModel):
    """Returned by refresh. Carries a new refresh token too: they rotate on
    every use, so the old one stops working the moment this is issued."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class InviteOut(BaseModel):
    user: UserOut
    #: The raw token, shown exactly once. Only its digest is stored, so it
    #: cannot be recovered afterwards - reissue the invite instead.
    invite_token: str
    expires_at: datetime
