"""Password hashing, JWT issue/verify, and opaque token digests.

Three distinct primitives with three different threat models, which is why
they use three different algorithms:

**Passwords** - bcrypt. Human-chosen, low entropy, so the hash must be
deliberately slow to make offline guessing expensive.

**Access tokens** - signed JWT, short lived. Stateless, so no database read on
every request; the cost is that revocation waits for expiry, which is why the
lifetime is 30 minutes rather than hours.

**Refresh tokens and share links** - 48 random bytes, stored as SHA-256. These
carry full entropy from a CSPRNG, so there is nothing to brute-force and a slow
hash would buy nothing. A fast digest is correct here, and storing only the
digest means a database dump cannot be replayed.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import settings
from app.models.enums import FirmRole

TokenKind = Literal["access", "refresh"]

#: bcrypt silently truncates at 72 bytes. Rejecting longer input is better than
#: accepting a password where only the first 72 bytes matter.
MAX_PASSWORD_BYTES = 72


class TokenError(Exception):
    """Token missing, malformed, expired, or of the wrong kind."""


# --------------------------------------------------------------- passwords ---


def hash_password(plain: str) -> str:
    encoded = plain.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {MAX_PASSWORD_BYTES} bytes "
            f"({len(encoded)} given); bcrypt ignores anything beyond that."
        )
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # A malformed stored hash must read as "wrong password", never as an
        # exception that a caller might mistake for success.
        return False


def needs_rehash(hashed: str) -> bool:
    """True when a stored hash used fewer rounds than current policy.

    Checked at login, where the plaintext is briefly available and the hash can
    be upgraded transparently.
    """
    try:
        rounds = int(hashed.split("$")[2])
    except (IndexError, ValueError):
        return True
    return rounds < settings.BCRYPT_ROUNDS


# ------------------------------------------------------------------- jwt -----


def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(
    *,
    user_id: uuid.UUID,
    firm_id: uuid.UUID,
    role: FirmRole,
    email: str,
    client_id: uuid.UUID | None = None,
) -> tuple[str, datetime]:
    """Issue an access token.

    ``firm_id`` travels in the token specifically so tenant scoping costs no
    database read: a handler puts it straight into a ``WHERE`` clause. It is
    signed, so it cannot be tampered with, and a user moved between firms loses
    the stale scope within one token lifetime.
    """
    expires = _now() + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "firm_id": str(firm_id),
        "role": role.value,
        "client_id": str(client_id) if client_id else None,
        "email": email,
        "kind": "access",
        "iat": int(_now().timestamp()),
        "exp": int(expires.timestamp()),
        "jti": secrets.token_urlsafe(8),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def create_refresh_token(*, user_id: uuid.UUID, token_id: uuid.UUID) -> tuple[str, datetime]:
    """Issue a refresh token bound to a ``refresh_tokens`` row.

    ``jti`` is the row id, so rotation revokes exactly one credential and reuse
    of an already-rotated token is detectable.
    """
    expires = _now() + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS)
    payload = {
        "sub": str(user_id),
        "jti": str(token_id),
        "kind": "refresh",
        "iat": int(_now().timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_token(token: str, *, expect: TokenKind) -> dict[str, Any]:
    """Decode and verify, enforcing the token kind.

    The ``kind`` check is not ceremony. Both token types are signed with the
    same secret, so without it a 7-day refresh token would verify as an access
    token and authorise requests for a week.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "kind"]},
        )
    except InvalidTokenError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("kind") != expect:
        raise TokenError(f"expected a {expect} token, got {payload.get('kind')!r}")
    return payload


# ---------------------------------------------------------- opaque tokens ----


def generate_opaque_token(n_bytes: int = 48) -> str:
    return secrets.token_urlsafe(n_bytes)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def opaque_tokens_match(token: str, stored_digest: str) -> bool:
    """Constant-time comparison, so a timing difference cannot leak the digest."""
    return hmac.compare_digest(hash_opaque_token(token), stored_digest)
