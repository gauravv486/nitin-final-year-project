"""Shared FastAPI dependencies: the current user, role gates, tenant scoping."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.roles import at_least, is_firm_wide, ui_role
from app.core.security import TokenError, decode_token
from app.models.enums import FirmRole, UserStatus
from app.models.practice import Client
from app.models.tenancy import User

# auto_error=False so a missing header produces our own 401 with a useful
# message rather than FastAPI's bare "Not authenticated".
_bearer = HTTPBearer(auto_error=False, scheme_name="Bearer")

SessionDep = Annotated[Session, Depends(get_session)]


@dataclass(slots=True, frozen=True)
class CurrentUser:
    """Everything a handler may rely on without touching the database."""

    id: uuid.UUID
    firm_id: uuid.UUID
    role: FirmRole
    client_id: uuid.UUID | None
    email: str

    @property
    def ui_role(self) -> str:
        return ui_role(self.role)

    @property
    def is_portal_user(self) -> bool:
        return self.role is FirmRole.CLIENT


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> CurrentUser:
    """Resolve the bearer token to a user.

    The token carries everything needed, but the user row is still read on
    every request. That is a deliberate cost: without it a suspended or deleted
    account keeps working until its access token expires, and "revoke access
    now" has to mean now.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorised("Missing bearer token")

    try:
        payload = decode_token(credentials.credentials, expect="access")
    except TokenError as exc:
        raise _unauthorised(f"Invalid token: {exc}") from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise _unauthorised("Token subject is not a valid id") from exc

    user = session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    ).scalar_one_or_none()

    if user is None:
        raise _unauthorised("Account no longer exists")
    if user.status is not UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value.lower()}",
        )

    return CurrentUser(
        id=user.id,
        firm_id=user.firm_id,
        role=user.role,
        client_id=user.client_id,
        email=user.email,
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def require_role(*allowed: FirmRole) -> Callable[[CurrentUser], CurrentUser]:
    """Dependency factory: exactly these roles."""

    def dependency(user: CurrentUserDep) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Your role ({user.role.value}) cannot do this; "
                    f"needs one of {', '.join(r.value for r in allowed)}"
                ),
            )
        return user

    return dependency


def require_min_role(minimum: FirmRole) -> Callable[[CurrentUser], CurrentUser]:
    """Dependency factory: this role or above. Never satisfied by CLIENT."""

    def dependency(user: CurrentUserDep) -> CurrentUser:
        if not at_least(user.role, minimum):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Your role ({user.role.value}) cannot do this; "
                    f"needs {minimum.value} or above"
                ),
            )
        return user

    return dependency


def authorise_client(session: Session, user: CurrentUser, client_id: uuid.UUID) -> Client:
    """The tenant boundary, checked once instead of in every handler.

    Two separate questions, both of which have to be answered:

    1. Does this client belong to the caller's firm? Without this check any
       authenticated user could read another practice's data by guessing a UUID.
    2. May this caller see *that* client? A portal user is pinned to their own
       ``client_id``; staff and articles see only clients they manage; owners,
       partners and managers see the whole firm.

    The 404 is identical whether the client belongs to another firm or does not
    exist. Distinguishing them would confirm which UUIDs are real.
    """
    not_found = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="No such client"
    )

    # A portal user is pinned to one client and never reaches the firm-wide
    # lookup below.
    if user.is_portal_user and user.client_id != client_id:
        raise not_found

    client = session.execute(
        select(Client).where(
            Client.id == client_id,
            Client.firm_id == user.firm_id,
            Client.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if client is None:
        raise not_found

    # Staff and articles see only the clients they manage; owners, partners and
    # managers see the whole firm.
    restricted = not user.is_portal_user and not is_firm_wide(user.role)
    if restricted and client.manager_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this client",
        )

    return client


def visible_client_ids(user: CurrentUser):
    """Subquery of the client ids this caller may see, for list endpoints.

    The list-shaped twin of ``authorise_client``: the same three rules, as a
    SQL condition instead of a single-row check. Every list endpoint over a
    client-owned table filters ``Model.client_id.in_(visible_client_ids(user))``
    so a staff member's document list cannot include a client they were never
    assigned - the omission the per-row check alone would not catch.
    """
    query = select(Client.id).where(
        Client.firm_id == user.firm_id, Client.deleted_at.is_(None)
    )
    if user.is_portal_user:
        query = query.where(Client.id == user.client_id)
    elif not is_firm_wide(user.role):
        query = query.where(Client.manager_id == user.id)
    return query


def forbid_portal(user: CurrentUser, action: str = "do this") -> None:
    """Portal users read their own records; they do not operate the practice."""
    if user.is_portal_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Portal users cannot {action}",
        )


def client_ip(request: Request) -> str | None:
    """Caller's address, for the audit log.

    Honours ``X-Forwarded-For`` only because this sits behind a reverse proxy
    in any real deployment; ``--proxy-headers`` on uvicorn is what validates it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
