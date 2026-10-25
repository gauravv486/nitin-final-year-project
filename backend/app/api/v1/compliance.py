"""Compliance calendar - Module 11."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import and_, select
from sqlalchemy.orm import aliased

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.roles import at_least
from app.models.compliance import ComplianceObligation, ComplianceTask
from app.models.enums import FilingStatus, FirmRole
from app.models.practice import Client
from app.models.tenancy import User
from app.services import audit
from app.services import compliance as engine

router = APIRouter(tags=["compliance"])


class TaskOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    form: str
    description: str
    period: str
    due_date: date
    days_left: int
    #: Stored status, except a past-due unfiled task reads as OVERDUE.
    status: FilingStatus
    stored_status: FilingStatus
    assignee_id: uuid.UUID | None
    assignee: str | None
    completed_at: datetime | None
    extended_from: date | None
    extension_note: str | None


class TaskUpdateIn(BaseModel):
    status: FilingStatus | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    extension_note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _extension_needs_reason(self) -> TaskUpdateIn:
        # Moving a statutory deadline without saying which notification moved
        # it leaves "was this filed late?" unanswerable later.
        if self.due_date is not None and not (self.extension_note and self.extension_note.strip()):
            raise ValueError("Changing a due date needs an extension note, e.g. the CBIC notification")
        return self


class GenerateIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    client_ids: list[uuid.UUID] | None = None


def _out(task: ComplianceTask, client_name: str, assignee: str | None) -> TaskOut:
    return TaskOut(
        id=task.id,
        client_id=task.client_id,
        client_name=client_name,
        form=task.form,
        description=task.description,
        period=task.period,
        due_date=task.due_date,
        days_left=(task.due_date - date.today()).days,
        status=engine.effective_status(task),
        stored_status=task.status,
        assignee_id=task.assignee_id,
        assignee=assignee,
        completed_at=task.completed_at,
        extended_from=task.extended_from,
        extension_note=task.extension_note,
    )


@router.get("/compliance/tasks", response_model=list[TaskOut], summary="Compliance tasks")
def list_tasks(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    task_status: Annotated[FilingStatus | None, Query(alias="status")] = None,
    due_from: date | None = None,
    due_to: date | None = None,
    assignee_id: uuid.UUID | None = None,
    mine: bool = False,
    form: Annotated[str | None, Query(max_length=30)] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
) -> list[TaskOut]:
    today = date.today()
    conditions = [ComplianceTask.firm_id == user.firm_id, ComplianceTask.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(ComplianceTask.client_id == client_id)
    if due_from:
        conditions.append(ComplianceTask.due_date >= due_from)
    if due_to:
        conditions.append(ComplianceTask.due_date <= due_to)
    if assignee_id or mine:
        conditions.append(ComplianceTask.assignee_id == (assignee_id or user.id))
    if form:
        conditions.append(ComplianceTask.form == form)
    if task_status is FilingStatus.OVERDUE:
        conditions.append(and_(ComplianceTask.status != FilingStatus.FILED, ComplianceTask.due_date < today))
    elif task_status is not None:
        conditions.append(ComplianceTask.status == task_status)
        if task_status is not FilingStatus.FILED:
            # "Pending" means pending and not yet late; late ones are overdue.
            conditions.append(ComplianceTask.due_date >= today)

    assignee = aliased(User)
    rows = session.execute(
        select(ComplianceTask, Client.name, assignee)
        .join(Client, Client.id == ComplianceTask.client_id)
        .outerjoin(assignee, assignee.id == ComplianceTask.assignee_id)
        .where(*conditions)
        .order_by(ComplianceTask.due_date, Client.name)
        .limit(limit)
    ).all()
    return [_out(t, name, a.full_name if a else None) for t, name, a in rows]


@router.patch("/compliance/tasks/{task_id}", response_model=TaskOut, summary="Update a task")
def update_task(
    task_id: uuid.UUID, payload: TaskUpdateIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> TaskOut:
    forbid_portal(user, "update tasks")
    task = session.get(ComplianceTask, task_id)
    if task is None or task.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such task")
    client = authorise_client(session, user, task.client_id)
    changes = payload.model_dump(exclude_unset=True)

    if changes.get("status") is FilingStatus.OVERDUE:
        raise HTTPException(status_code=422, detail="Overdue is computed from the due date, not set")
    if "status" in changes:
        task.status = changes["status"]
        task.completed_at = datetime.now(UTC) if task.status is FilingStatus.FILED else None
    if "assignee_id" in changes:
        if changes["assignee_id"] is not None:
            person = session.get(User, changes["assignee_id"])
            if person is None or person.firm_id != user.firm_id:
                raise HTTPException(status_code=422, detail="Assignee is not in your firm")
        task.assignee_id = changes["assignee_id"]
    if "due_date" in changes:
        task.extended_from = task.extended_from or task.due_date
        task.due_date = changes["due_date"]
        task.extension_note = changes["extension_note"]

    audit.record(
        session, user, "TASK_UPDATE", resource_type="compliance_task", resource_id=task.id,
        meta={"form": task.form, "fields": sorted(changes)}, request=request,
    )
    session.commit()
    assignee = session.get(User, task.assignee_id) if task.assignee_id else None
    return _out(task, client.name, assignee.full_name if assignee else None)


@router.post("/compliance/generate", summary="Generate tasks for a period")
def generate(payload: GenerateIn, request: Request, session: SessionDep, user: CurrentUserDep) -> dict:
    """Idempotent. Managers and above."""
    if not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above generate the calendar")
    created = engine.generate_tasks(
        session, firm_id=user.firm_id, period=payload.period, client_ids=payload.client_ids
    )
    audit.record(
        session, user, "TASKS_GENERATE", resource_type="firm", resource_id=user.firm_id,
        meta={"period": payload.period, "created": created}, request=request,
    )
    session.commit()
    return {"period": payload.period, "created": created}


@router.get("/compliance/obligations", summary="The statutory calendar template")
def obligations(session: SessionDep, user: CurrentUserDep) -> list[dict]:
    rows = session.execute(
        select(ComplianceObligation)
        .where(ComplianceObligation.firm_id == user.firm_id)
        .order_by(ComplianceObligation.category, ComplianceObligation.code)
    ).scalars()
    return [
        {
            "id": o.id,
            "code": o.code,
            "name": o.name,
            "description": o.description,
            "category": o.category,
            "frequency": o.frequency,
            "due_day_of_month": o.due_day_of_month,
            "due_month_offset": o.due_month_offset,
            "applies_to": o.applies_to,
            "is_active": o.is_active,
        }
        for o in rows
    ]


def task_counts(session, user, today: date | None = None) -> dict:
    """Shared with the dashboard."""
    today = today or date.today()
    base = [ComplianceTask.firm_id == user.firm_id, ComplianceTask.client_id.in_(visible_client_ids(user))]
    tasks = session.execute(select(ComplianceTask).where(*base)).scalars().all()
    week = today.toordinal() + 7
    return {
        "overdue": sum(1 for t in tasks if engine.is_overdue(t, today)),
        "due_this_week": sum(
            1 for t in tasks if t.status is not FilingStatus.FILED and today <= t.due_date and t.due_date.toordinal() <= week
        ),
        "open": sum(1 for t in tasks if t.status is not FilingStatus.FILED),
        "filed": sum(1 for t in tasks if t.status is FilingStatus.FILED),
    }


__all__ = ["router", "task_counts"]
