"""The only writer of ``audit_logs``.

Every mutation that a reviewer, a client or a regulator might later ask about
goes through ``record``. There is deliberately no update or delete function
here - append-only in practice, not just in intention.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.models.enums import AuditOutcome
from app.models.tenancy import AuditLog

if TYPE_CHECKING:
    from fastapi import Request

    from app.api.deps import CurrentUser

#: Never written to the log, at any depth. The log is read by more people than
#: the data it describes, so a credential or a document body in ``meta`` would
#: widen its audience.
_REDACTED_KEYS = frozenset(
    {
        "password",
        "current_password",
        "password_hash",
        "token",
        "refresh_token",
        "access_token",
        "mfa_secret",
        "raw_text",
        "full_text",
        "draft_response",
        "body",
    }
)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[redacted]" if key in _REDACTED_KEYS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    # Decimals, enums and anything else become their string form rather than
    # failing the JSON encoder - an audit write must never break the request.
    return str(value)


def record(
    session: Session,
    user: CurrentUser | None,
    action: str,
    *,
    resource_type: str | None = None,
    resource_id: uuid.UUID | str | None = None,
    meta: dict[str, Any] | None = None,
    outcome: AuditOutcome = AuditOutcome.SUCCESS,
    request: Request | None = None,
    firm_id: uuid.UUID | None = None,
) -> None:
    """Stage an audit row on ``session``.

    Added, not committed: the row commits with the change it describes, so a
    rolled-back mutation leaves no claim that it happened.
    """
    ip_address = user_agent = None
    if request is not None:
        forwarded = request.headers.get("x-forwarded-for")
        ip_address = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else None)
        )
        user_agent = (request.headers.get("user-agent") or "")[:512] or None

    session.add(
        AuditLog(
            firm_id=firm_id or (user.firm_id if user else None),
            user_id=user.id if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            outcome=outcome,
            meta=_redact(meta or {}),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
