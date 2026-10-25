"""Authentication endpoints - Module 14."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import (
    CurrentUser,
    CurrentUserDep,
    SessionDep,
    client_ip,
    require_min_role,
)
from app.models.enums import FirmRole
from app.models.tenancy import User
from app.schemas.auth import (
    AcceptInviteIn,
    AccessTokenOut,
    ChangePasswordIn,
    InviteOut,
    InviteUserIn,
    LoginIn,
    MeOut,
    RefreshIn,
    RegisterFirmIn,
    TokenPairOut,
    UserOut,
)
from app.services import audit
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_pair(session, user: User, request: Request, action: str) -> TokenPairOut:
    access, refresh, expires_in = auth_service.issue_token_pair(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip(request),
    )
    # The audit log is the only record of who reached the data and from where,
    # so a sign-in belongs in it as much as a document download does. Recorded
    # here rather than in the service because only the request carries the IP
    # and user agent. ``issue_token_pair`` has already committed the session,
    # so this one needs its own commit.
    audit.record(
        session,
        CurrentUser(
            id=user.id,
            firm_id=user.firm_id,
            role=user.role,
            client_id=user.client_id,
            email=user.email,
        ),
        action,
        resource_type="user",
        resource_id=user.id,
        request=request,
    )
    session.commit()
    return TokenPairOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=expires_in,
        user=MeOut(**auth_service.me_payload(session, user)),
    )


@router.post(
    "/register",
    response_model=TokenPairOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a firm and its first user",
)
def register(payload: RegisterFirmIn, session: SessionDep, request: Request) -> TokenPairOut:
    """Registers the practice and signs the owner straight in.

    There is no separate "create firm" step: a firm with no users is
    unreachable and a user with no firm has no tenant, so both are created in
    one transaction.
    """
    user = auth_service.register_firm(session, payload)
    return _token_pair(session, user, request, "FIRM_REGISTER")


@router.post("/login", response_model=TokenPairOut, summary="Sign in")
def login(payload: LoginIn, session: SessionDep, request: Request) -> TokenPairOut:
    user = auth_service.authenticate(
        session, email=payload.email, password=payload.password
    )
    return _token_pair(session, user, request, "LOGIN")


@router.post("/refresh", response_model=AccessTokenOut, summary="Rotate tokens")
def refresh(payload: RefreshIn, session: SessionDep, request: Request) -> AccessTokenOut:
    """Exchange a refresh token for a new pair.

    Refresh tokens are **single-use**. Presenting one twice means the client
    has a bug or the token was replayed, and either way every session for that
    user is revoked - see `rotate_refresh_token`.
    """
    access, new_refresh, expires_in = auth_service.rotate_refresh_token(
        session,
        raw_token=payload.refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip(request),
    )
    return AccessTokenOut(
        access_token=access, refresh_token=new_refresh, expires_in=expires_in
    )


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out this device"
)
def logout(payload: RefreshIn, session: SessionDep) -> Response:
    """Idempotent: an unknown or already-revoked token still returns 204.
    Reporting an error to somebody who is already signed out is noise."""
    auth_service.revoke_refresh_token(session, raw_token=payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/logout-all", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out everywhere"
)
def logout_all(session: SessionDep, user: CurrentUserDep) -> Response:
    auth_service.revoke_all_sessions(session, user_id=user.id)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeOut, summary="The signed-in user")
def me(session: SessionDep, user: CurrentUserDep) -> MeOut:
    """Includes `ui_role`, which collapses the seven database roles onto the
    three `frontend/lib/nav.ts` switches on - so the existing sidebar works
    unchanged."""
    row = session.get(User, user.id)
    assert row is not None  # get_current_user already proved it exists
    return MeOut(**auth_service.me_payload(session, row))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordIn, session: SessionDep, user: CurrentUserDep
) -> Response:
    """Revokes every other session. A password change is usually a response to
    a suspected compromise, so leaving other devices signed in would defeat
    it."""
    auth_service.change_password(
        session,
        user_id=user.id,
        current_password=payload.current_password,
        new_password=payload.password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/invite",
    response_model=InviteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a colleague",
)
def invite(
    payload: InviteUserIn,
    session: SessionDep,
    user: CurrentUserDep = require_min_role(FirmRole.PARTNER),  # type: ignore[assignment]
) -> InviteOut:
    """Partners and above only.

    The invitee sets their own password - the response carries a one-time token
    to send them. Only its digest is stored, so it cannot be recovered later;
    reissue the invite instead.
    """
    row, token, expires_at = auth_service.invite_user(
        session,
        firm_id=user.firm_id,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        phone=payload.phone,
        client_id=payload.client_id,
    )
    return InviteOut(
        user=UserOut.model_validate(row), invite_token=token, expires_at=expires_at
    )


@router.post("/accept-invite", response_model=TokenPairOut, summary="Set your password")
def accept_invite(
    payload: AcceptInviteIn, session: SessionDep, request: Request
) -> TokenPairOut:
    user = auth_service.accept_invite(
        session, token=payload.token, password=payload.password
    )
    return _token_pair(session, user, request, "INVITE_ACCEPT")
