"""Client CRUD - Module 2.

Every query filters on ``firm_id`` from the signed-in user's token, and
``authorise_client`` gates anything that names a specific client. Those two
together are the tenant boundary; neither alone is sufficient.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    require_min_role,
)
from app.core.roles import is_firm_wide
from app.models.enums import ClientStatus, EntityType, FirmRole
from app.models.practice import Client, ClientContact
from app.schemas.client import (
    ClientCreateIn,
    ClientListOut,
    ClientOut,
    ClientUpdateIn,
    ContactCreateIn,
    ContactOut,
)

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=ClientListOut, summary="List clients")
def list_clients(
    session: SessionDep,
    user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    q: Annotated[str | None, Query(max_length=120)] = None,
    client_status: Annotated[ClientStatus | None, Query(alias="status")] = None,
    entity_type: EntityType | None = None,
    order: Literal["asc", "desc"] = "asc",
) -> ClientListOut:
    """Offset pagination, which suits this data: a practice has hundreds of
    clients, not millions, and users expect to jump to a page."""
    conditions = [Client.firm_id == user.firm_id, Client.deleted_at.is_(None)]

    # Row-level visibility. A portal user sees one client; staff and articles
    # see only what they manage; owners, partners and managers see everything.
    if user.is_portal_user:
        conditions.append(Client.id == user.client_id)
    elif not is_firm_wide(user.role):
        conditions.append(Client.manager_id == user.id)

    if client_status:
        conditions.append(Client.status == client_status)
    if entity_type:
        conditions.append(Client.entity_type == entity_type)
    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(
                Client.name.ilike(term),
                Client.legal_name.ilike(term),
                Client.pan.ilike(term),
                Client.gstin.ilike(term),
            )
        )

    total = session.execute(
        select(func.count()).select_from(Client).where(*conditions)
    ).scalar_one()

    sort = Client.name.asc() if order == "asc" else Client.name.desc()
    rows = (
        session.execute(
            select(Client)
            .where(*conditions)
            .order_by(sort)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )

    return ClientListOut(
        data=[ClientOut.model_validate(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=max(1, -(-total // page_size)),
    )


@router.post(
    "",
    response_model=ClientOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a client",
)
def create_client(
    payload: ClientCreateIn,
    session: SessionDep,
    user: CurrentUserDep = require_min_role(FirmRole.STAFF),  # type: ignore[assignment]
) -> ClientOut:
    """PAN and GSTIN are validated on the way in, including the GSTIN check
    digit - a transposed character there silently breaks reconciliation for
    every invoice from that supplier."""
    if payload.manager_id is not None:
        _assert_manager_in_firm(session, user.firm_id, payload.manager_id)

    client = Client(
        firm_id=user.firm_id,
        **payload.model_dump(exclude_unset=False),
    )
    session.add(client)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # PAN and GSTIN are unique per firm, not globally: two firms may act
        # for the same company, and a group shares one PAN across GSTINs.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A client with this PAN or GSTIN already exists in your firm",
        ) from exc

    session.refresh(client)
    return ClientOut.model_validate(client)


@router.get("/{client_id}", response_model=ClientOut, summary="One client")
def get_client(
    client_id: uuid.UUID, session: SessionDep, user: CurrentUserDep
) -> ClientOut:
    return ClientOut.model_validate(authorise_client(session, user, client_id))


@router.patch("/{client_id}", response_model=ClientOut, summary="Update a client")
def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdateIn,
    session: SessionDep,
    user: CurrentUserDep,
) -> ClientOut:
    """PATCH semantics: only the fields present in the body are touched.

    ``exclude_unset`` is what makes that true - without it, every omitted
    field would be written as its default and changing one phone number would
    clear the address.
    """
    client = authorise_client(session, user, client_id)
    if user.is_portal_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Portal users cannot edit client records",
        )

    changes = payload.model_dump(exclude_unset=True)
    if "manager_id" in changes and changes["manager_id"] is not None:
        _assert_manager_in_firm(session, user.firm_id, changes["manager_id"])

    for field, value in changes.items():
        setattr(client, field, value)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another client in your firm already uses this PAN or GSTIN",
        ) from exc

    session.refresh(client)
    return ClientOut.model_validate(client)


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a client",
)
def delete_client(
    client_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep = require_min_role(FirmRole.PARTNER),  # type: ignore[assignment]
) -> Response:
    """Soft delete, and partners only.

    A hard delete would cascade through documents, filings and the audit trail
    for a client whose records a firm is required to retain for years. Setting
    ``deleted_at`` hides it from every list while keeping the history intact.
    """
    client = authorise_client(session, user, client_id)
    client.deleted_at = datetime.now(UTC)
    client.status = ClientStatus.EXITED
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------- contacts -----


@router.get(
    "/{client_id}/contacts", response_model=list[ContactOut], summary="List contacts"
)
def list_contacts(
    client_id: uuid.UUID, session: SessionDep, user: CurrentUserDep
) -> list[ContactOut]:
    authorise_client(session, user, client_id)
    rows = (
        session.execute(
            select(ClientContact)
            .where(ClientContact.client_id == client_id)
            .order_by(ClientContact.name)
        )
        .scalars()
        .all()
    )
    return [ContactOut.model_validate(row) for row in rows]


@router.post(
    "/{client_id}/contacts",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a contact",
)
def add_contact(
    client_id: uuid.UUID,
    payload: ContactCreateIn,
    session: SessionDep,
    user: CurrentUserDep,
) -> ContactOut:
    """Directors, partners and authorised signatories - the people named on
    ROC filings and engagement letters."""
    authorise_client(session, user, client_id)
    if user.is_portal_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Portal users cannot add contacts"
        )

    contact = ClientContact(client_id=client_id, **payload.model_dump())
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return ContactOut.model_validate(contact)


@router.delete(
    "/{client_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a contact",
)
def delete_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
) -> Response:
    authorise_client(session, user, client_id)
    contact = session.get(ClientContact, contact_id)
    # Checking the parent as well as the id: without it, a contact id from
    # another client (or another firm) would delete successfully.
    if contact is None or contact.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such contact")

    session.delete(contact)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------- helpers ------


def _assert_manager_in_firm(session, firm_id: uuid.UUID, manager_id: uuid.UUID) -> None:
    """A client cannot be assigned to someone outside the firm.

    Without this check a valid-looking UUID would attach another practice's
    user to this client, and that user would then pass the ownership test in
    ``authorise_client``.
    """
    from app.models.tenancy import User

    exists = session.execute(
        select(User.id).where(
            User.id == manager_id, User.firm_id == firm_id, User.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The chosen manager is not a user in your firm",
        )
