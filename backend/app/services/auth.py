"""Authentication: registration, login, and refresh-token rotation."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.roles import ui_role
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models.enums import FirmRole, UserStatus
from app.models.tenancy import Firm, FirmSettings, RefreshToken, User
from app.schemas.auth import RegisterFirmIn

logger = logging.getLogger(__name__)

#: How long an invite link stays valid.
INVITE_TTL_DAYS = 14


def _now() -> datetime:
    return datetime.now(UTC)


def _credentials_rejected() -> HTTPException:
    """One message for every login failure.

    Deliberately identical whether the email is unknown or the password is
    wrong. Distinguishing them turns the login form into an account-enumeration
    oracle, which is how a leaked password list gets tested against a customer
    base.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email or password is incorrect",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ------------------------------------------------------------ registration ---


def register_firm(session: Session, payload: RegisterFirmIn) -> User:
    """Create a firm, its settings row, and its first user as OWNER.

    One transaction. A firm with no users is unreachable and a user with no
    firm has no tenant, so a partial commit here would leave unusable rows that
    also hold a unique email.
    """
    existing = session.execute(
        select(User.id).where(User.email == payload.email.lower())
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email already has an account",
        )

    firm = Firm(
        name=payload.firm_name.strip(),
        frn=payload.frn.strip().upper() if payload.frn else None,
        email=payload.email.lower(),
        phone=payload.phone,
    )
    session.add(firm)
    session.flush()  # assigns firm.id without committing

    session.add(FirmSettings(firm_id=firm.id))

    user = User(
        firm_id=firm.id,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        phone=payload.phone,
        # The person who creates the firm owns it. There is no higher role, so
        # nobody can lock themselves out of their own tenant.
        role=FirmRole.OWNER,
        status=UserStatus.ACTIVE,
    )
    session.add(user)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # Lost a race against a concurrent registration, or the FRN is taken.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A firm or user with these details already exists",
        ) from exc

    session.refresh(user)
    return user


def invite_user(
    session: Session,
    *,
    firm_id: uuid.UUID,
    email: str,
    first_name: str,
    last_name: str,
    role: FirmRole,
    phone: str | None = None,
    client_id: uuid.UUID | None = None,
) -> tuple[User, str, datetime]:
    """Create an INVITED user and return the raw invite token.

    The invitee sets their own password. The token's digest is stored in
    ``password_hash`` as a placeholder - the column is not null, and parking
    the invite digest there means an invited account cannot be logged into with
    any password, because no password hashes to a SHA-256 digest.
    """
    if role is FirmRole.CLIENT and client_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A CLIENT-role user must be tied to a client_id",
        )
    if role is FirmRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A firm has one OWNER, set at registration. Invite a PARTNER instead.",
        )

    if session.execute(
        select(User.id).where(User.email == email.lower())
    ).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email already has an account",
        )

    token = generate_opaque_token()
    expires_at = _now() + timedelta(days=INVITE_TTL_DAYS)

    user = User(
        firm_id=firm_id,
        client_id=client_id,
        email=email.lower(),
        password_hash=f"invite:{hash_opaque_token(token)}",
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        phone=phone,
        role=role,
        status=UserStatus.INVITED,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return user, token, expires_at


def accept_invite(session: Session, *, token: str, password: str) -> User:
    digest = f"invite:{hash_opaque_token(token)}"
    user = session.execute(
        select(User).where(
            User.password_hash == digest,
            User.status == UserStatus.INVITED,
            User.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That invite link is invalid or has already been used",
        )

    # Expiry is checked against the row's age rather than a stored timestamp,
    # which keeps the column count down for a two-week window.
    if _now() - user.created_at.replace(tzinfo=UTC) > timedelta(days=INVITE_TTL_DAYS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That invite has expired. Ask for a new one.",
        )

    user.password_hash = hash_password(password)
    user.status = UserStatus.ACTIVE
    session.commit()
    session.refresh(user)
    return user


# ------------------------------------------------------------------ login ----


def authenticate(session: Session, *, email: str, password: str) -> User:
    user = session.execute(
        select(User).where(User.email == email.lower(), User.deleted_at.is_(None))
    ).scalar_one_or_none()

    if user is None:
        # Hash anyway, so a missing account does not return measurably faster
        # than a wrong password and leak which emails are registered.
        hash_password(password)
        raise _credentials_rejected()

    if user.status is UserStatus.INVITED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finish setting up your account using the invite link first",
        )
    if user.status is UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account is suspended"
        )

    if not verify_password(password, user.password_hash):
        raise _credentials_rejected()

    # The plaintext is in hand exactly here, so this is the only place a hash
    # can be transparently upgraded after a cost-factor change.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    user.last_login_at = _now()
    session.commit()
    session.refresh(user)
    return user


def change_password(
    session: Session, *, user_id: uuid.UUID, current_password: str, new_password: str
) -> None:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such user")

    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    user.password_hash = hash_password(new_password)
    # Every existing session dies. A password change is usually a response to
    # a suspected compromise, so leaving other devices signed in would defeat
    # the point of changing it.
    revoke_all_sessions(session, user_id=user_id)
    session.commit()


# ----------------------------------------------------------------- tokens ----


def issue_token_pair(
    session: Session,
    user: User,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str, int]:
    """Mint an access token and a fresh refresh-token row."""
    token_row = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash="",  # replaced below, once the jti is known
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )

    refresh_token, expires_at = create_refresh_token(user_id=user.id, token_id=token_row.id)
    token_row.token_hash = hash_opaque_token(refresh_token)
    token_row.expires_at = expires_at
    session.add(token_row)

    access_token, access_expiry = create_access_token(
        user_id=user.id,
        firm_id=user.firm_id,
        role=user.role,
        email=user.email,
        client_id=user.client_id,
    )
    session.commit()

    expires_in = int((access_expiry - _now()).total_seconds())
    return access_token, refresh_token, expires_in


def rotate_refresh_token(
    session: Session,
    *,
    raw_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str, int]:
    """Exchange a refresh token for a new pair, invalidating the old one.

    Rotation with **reuse detection**: a refresh token is single-use, so if an
    already-rotated one is presented again, either the client has a bug or the
    token was stolen and replayed. Either way the safe response is to revoke
    the whole family and force a fresh login - keeping the chain alive would
    let an attacker who captured one token refresh indefinitely.
    """
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token is invalid or expired. Sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(raw_token, expect="refresh")
    except TokenError:
        raise invalid from None

    try:
        token_id = uuid.UUID(payload["jti"])
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise invalid from None

    row = session.get(RefreshToken, token_id)
    if row is None or row.user_id != user_id:
        raise invalid

    if row.token_hash != hash_opaque_token(raw_token):
        raise invalid

    if row.revoked_at is not None:
        logger.warning(
            "refresh token reuse detected for user %s (token %s); revoking all sessions",
            user_id,
            token_id,
        )
        revoke_all_sessions(session, user_id=user_id)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "This refresh token was already used. For safety every session "
                "has been signed out - please sign in again."
            ),
        )

    if row.expires_at.replace(tzinfo=UTC) <= _now():
        raise invalid

    user = session.get(User, user_id)
    if user is None or user.deleted_at is not None or user.status is not UserStatus.ACTIVE:
        raise invalid

    access_token, refresh_token, expires_in = issue_token_pair(
        session, user, user_agent=user_agent, ip_address=ip_address
    )

    # Mark the old row spent and point it at its replacement, so the chain is
    # walkable when investigating a reuse.
    row.revoked_at = _now()
    new_row = session.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_opaque_token(refresh_token))
        .limit(1)
    ).scalar_one()
    row.replaced_by_id = new_row.id
    session.commit()

    return access_token, refresh_token, expires_in


def revoke_refresh_token(session: Session, *, raw_token: str) -> None:
    """Sign out one device. Silent on an unknown token - logout is idempotent
    and should never report an error to someone who is already signed out."""
    digest = hash_opaque_token(raw_token)
    row = session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    ).scalar_one_or_none()
    if row and row.revoked_at is None:
        row.revoked_at = _now()
        session.commit()


def revoke_all_sessions(session: Session, *, user_id: uuid.UUID) -> int:
    """Revoke every live refresh token for a user. Does not commit."""
    rows = session.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
    ).scalars()
    count = 0
    for row in rows:
        row.revoked_at = _now()
        count += 1
    return count


def me_payload(session: Session, user: User) -> dict:
    """The ``/me`` body, including the three-way ``ui_role`` the existing
    frontend sidebar switches on."""
    firm = session.get(Firm, user.firm_id)
    return {
        "id": user.id,
        "firm_id": user.firm_id,
        "client_id": user.client_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "ui_role": ui_role(user.role),
        "status": user.status,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "firm_name": firm.name if firm else "",
    }
