"""Role mapping and authority ordering."""

from __future__ import annotations

from typing import Literal

from app.models.enums import FirmRole

#: What the existing frontend expects. ``frontend/lib/nav.ts`` drives the
#: sidebar from exactly these three values, so the API reports both: ``role``
#: for authorisation, ``ui_role`` for navigation. Mapping here rather than
#: changing the frontend keeps the finer grades available server-side without
#: giving the UI four more cases to render.
UiRole = Literal["partner", "staff", "client"]


def ui_role(role: FirmRole) -> UiRole:
    if role in (FirmRole.OWNER, FirmRole.PARTNER):
        return "partner"
    if role is FirmRole.CLIENT:
        return "client"
    # MANAGER, STAFF, ARTICLE and BILLING share the staff sidebar; what
    # separates them is enforced per endpoint, not in navigation.
    return "staff"


#: Descending authority, so an endpoint can say "MANAGER and up" without
#: enumerating everything above it.
_RANK: dict[FirmRole, int] = {
    FirmRole.OWNER: 60,
    FirmRole.PARTNER: 50,
    FirmRole.MANAGER: 40,
    FirmRole.STAFF: 30,
    FirmRole.ARTICLE: 20,
    FirmRole.BILLING: 15,
    # A client is not junior staff - it is a different axis entirely, and is
    # never satisfied by `at_least`. Portal access is always granted explicitly.
    FirmRole.CLIENT: 0,
}


def at_least(role: FirmRole, minimum: FirmRole) -> bool:
    if FirmRole.CLIENT in (role, minimum):
        return role == minimum
    return _RANK[role] >= _RANK[minimum]


#: Roles that see every client in the firm. Everyone else sees only the clients
#: they manage.
FIRM_WIDE_ROLES: frozenset[FirmRole] = frozenset(
    {FirmRole.OWNER, FirmRole.PARTNER, FirmRole.MANAGER}
)


def is_firm_wide(role: FirmRole) -> bool:
    return role in FIRM_WIDE_ROLES
