"""Payroll runs - Module 9."""

from __future__ import annotations

import calendar
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.roles import at_least
from app.models.compliance import PayrollLine, PayrollRun
from app.models.enums import FirmRole, PayrollStatus
from app.models.practice import Client
from app.services import audit
from app.services import payroll as engine

router = APIRouter(tags=["payroll"])


class EmployeeIn(BaseModel):
    employee_code: str = Field(min_length=1, max_length=30)
    employee_name: str = Field(min_length=1, max_length=255)
    pan: str | None = Field(default=None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    uan: str | None = Field(default=None, pattern=r"^\d{12}$")
    state: str | None = Field(default=None, max_length=100)
    gender: Literal["male", "female"] = "male"
    basic: Decimal = Field(ge=0)
    hra: Decimal = Field(default=Decimal("0"), ge=0)
    allowances: Decimal = Field(default=Decimal("0"), ge=0)
    paid_days: Decimal | None = Field(default=None, ge=0, le=31)
    other_deductions: Decimal = Field(default=Decimal("0"), ge=0)


class RunIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    employees: list[EmployeeIn] = Field(min_length=1, max_length=2000)
    replace: bool = False


class CopyIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class LineOut(BaseModel):
    id: uuid.UUID
    employee_code: str
    employee_name: str
    pan: str | None
    uan: str | None
    state: str | None
    paid_days: Decimal
    basic: Decimal
    hra: Decimal
    allowances: Decimal
    gross: Decimal
    pf_employee: Decimal
    pf_employer: Decimal
    esi_employee: Decimal
    esi_employer: Decimal
    professional_tax: Decimal
    tds: Decimal
    other_deductions: Decimal
    net: Decimal


class RunOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    period: str
    status: PayrollStatus
    headcount: int
    gross_total: Decimal
    net_total: Decimal
    pf_total: Decimal
    esi_total: Decimal
    pt_total: Decimal
    tds_total: Decimal
    approved_at: datetime | None
    paid_on: date | None
    created_at: datetime


class RunDetailOut(RunOut):
    lines: list[LineOut]
    rate_snapshot: dict
    notes: dict[str, list[str]]


def _run_out(run: PayrollRun, client_name: str) -> dict:
    return {
        "id": run.id,
        "client_id": run.client_id,
        "client_name": client_name,
        "period": run.period,
        "status": run.status,
        "headcount": run.headcount,
        "gross_total": run.gross_total,
        "net_total": run.net_total,
        "pf_total": run.pf_total,
        "esi_total": run.esi_total,
        "pt_total": run.pt_total,
        "tds_total": run.tds_total,
        "approved_at": run.approved_at,
        "paid_on": run.paid_on,
        "created_at": run.created_at,
    }


def _line_out(line: PayrollLine) -> LineOut:
    return LineOut.model_validate(line, from_attributes=True)


def _detail(run: PayrollRun, client_name: str) -> RunDetailOut:
    lines = sorted(run.lines, key=lambda x: x.employee_code)
    return RunDetailOut(
        **_run_out(run, client_name),
        lines=[_line_out(x) for x in lines],
        rate_snapshot={k: v for k, v in (run.rate_snapshot or {}).items() if k != "notes"},
        notes=(run.rate_snapshot or {}).get("notes", {}),
    )


def _calculate(session, *, firm_id, client: Client, period: str, employees: list[EmployeeIn], replace: bool) -> PayrollRun:
    existing = session.execute(
        select(PayrollRun).where(PayrollRun.client_id == client.id, PayrollRun.period == period)
    ).scalar_one_or_none()
    if existing is not None:
        if existing.status in (PayrollStatus.APPROVED, PayrollStatus.PAID):
            raise HTTPException(
                status_code=409, detail=f"The {period} payroll is {existing.status.value.lower()} and cannot be recalculated"
            )
        if not replace:
            raise HTTPException(status_code=409, detail=f"A {period} payroll exists. Pass replace=true to recalculate.")
        session.delete(existing)
        session.flush()

    codes = [e.employee_code for e in employees]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=422, detail="Employee codes must be unique within a run")

    slips = []
    for employee in employees:
        try:
            slips.append(
                engine.compute_payslip(
                    engine.EmployeeInput(
                        employee_code=employee.employee_code,
                        employee_name=employee.employee_name,
                        basic=employee.basic,
                        hra=employee.hra,
                        allowances=employee.allowances,
                        paid_days=employee.paid_days,
                        state=employee.state or client.state,
                        gender=employee.gender,
                        pan=employee.pan,
                        uan=employee.uan,
                        other_deductions=employee.other_deductions,
                    ),
                    period=period,
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    snapshot = engine.rate_snapshot()
    snapshot["notes"] = {s.employee_code: s.notes for s in slips if s.notes}
    snapshot["gender_basis"] = {e.employee_code: e.gender for e in employees}
    run = PayrollRun(
        firm_id=firm_id,
        client_id=client.id,
        period=period,
        status=PayrollStatus.CALCULATED,
        headcount=len(slips),
        gross_total=sum((s.gross for s in slips), Decimal("0")),
        net_total=sum((s.net for s in slips), Decimal("0")),
        pf_total=sum((s.pf_employee + s.pf_employer for s in slips), Decimal("0")),
        esi_total=sum((s.esi_employee + s.esi_employer for s in slips), Decimal("0")),
        pt_total=sum((s.professional_tax for s in slips), Decimal("0")),
        tds_total=sum((s.tds for s in slips), Decimal("0")),
        rate_snapshot=snapshot,
    )
    session.add(run)
    session.flush()
    for slip in slips:
        session.add(
            PayrollLine(
                run_id=run.id,
                employee_code=slip.employee_code,
                employee_name=slip.employee_name,
                pan=slip.pan,
                uan=slip.uan,
                state=slip.state,
                paid_days=slip.paid_days,
                basic=slip.basic,
                hra=slip.hra,
                allowances=slip.allowances,
                gross=slip.gross,
                pf_employee=slip.pf_employee,
                pf_employer=slip.pf_employer,
                esi_employee=slip.esi_employee,
                esi_employer=slip.esi_employer,
                professional_tax=slip.professional_tax,
                tds=slip.tds,
                other_deductions=slip.other_deductions,
                net=slip.net,
            )
        )
    return run


def _load(session, user, run_id) -> tuple[PayrollRun, Client]:
    run = session.get(PayrollRun, run_id)
    if run is None or run.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such payroll run")
    return run, authorise_client(session, user, run.client_id)


@router.get("/payroll/runs", response_model=list[RunOut], summary="Payroll runs")
def list_runs(session: SessionDep, user: CurrentUserDep, client_id: uuid.UUID | None = None) -> list[RunOut]:
    conditions = [PayrollRun.firm_id == user.firm_id, PayrollRun.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(PayrollRun.client_id == client_id)
    rows = session.execute(
        select(PayrollRun, Client.name)
        .join(Client, Client.id == PayrollRun.client_id)
        .where(*conditions)
        .order_by(PayrollRun.period.desc(), Client.name)
    ).all()
    return [RunOut(**_run_out(r, name)) for r, name in rows]


@router.post(
    "/clients/{client_id}/payroll/runs",
    response_model=RunDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Calculate a month's payroll",
)
def create_run(
    client_id: uuid.UUID, payload: RunIn, request: Request, session: SessionDep, user: CurrentUserDep
) -> RunDetailOut:
    forbid_portal(user, "run payroll")
    client = authorise_client(session, user, client_id)
    run = _calculate(
        session, firm_id=user.firm_id, client=client, period=payload.period,
        employees=payload.employees, replace=payload.replace,
    )
    audit.record(
        session, user, "PAYROLL_CALCULATE", resource_type="payroll_run", resource_id=run.id,
        meta={"period": payload.period, "headcount": run.headcount}, request=request,
    )
    session.commit()
    session.refresh(run)
    return _detail(run, client.name)


@router.get("/payroll/runs/{run_id}", response_model=RunDetailOut, summary="One payroll run")
def get_run(run_id: uuid.UUID, session: SessionDep, user: CurrentUserDep) -> RunDetailOut:
    run, client = _load(session, user, run_id)
    return _detail(run, client.name)


@router.post(
    "/payroll/runs/{run_id}/copy",
    response_model=RunDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Recalculate the same employees for another month",
)
def copy_run(run_id: uuid.UUID, payload: CopyIn, request: Request, session: SessionDep, user: CurrentUserDep):
    """Monthly rates are reconstructed from the earned figures, so a
    pro-rated joiner is restored to a full month. February's PT is applied
    automatically where the state collects it."""
    forbid_portal(user, "run payroll")
    source, client = _load(session, user, run_id)
    genders = (source.rate_snapshot or {}).get("gender_basis", {})
    year, month = (int(x) for x in source.period.split("-"))
    days = Decimal(calendar.monthrange(year, month)[1])
    employees = []
    for line in source.lines:
        factor = (line.paid_days / days) if line.paid_days else Decimal("1")

        def rebuild(value: Decimal, factor: Decimal = factor) -> Decimal:
            return (value / factor).quantize(Decimal("1")) if factor else value

        employees.append(
            EmployeeIn(
                employee_code=line.employee_code,
                employee_name=line.employee_name,
                pan=line.pan,
                uan=line.uan,
                state=line.state,
                gender=genders.get(line.employee_code, "male"),
                basic=rebuild(line.basic),
                hra=rebuild(line.hra),
                allowances=rebuild(line.allowances),
                other_deductions=line.other_deductions,
            )
        )
    run = _calculate(session, firm_id=user.firm_id, client=client, period=payload.period, employees=employees, replace=False)
    audit.record(
        session, user, "PAYROLL_CALCULATE", resource_type="payroll_run", resource_id=run.id,
        meta={"period": payload.period, "copied_from": source.period}, request=request,
    )
    session.commit()
    session.refresh(run)
    return _detail(run, client.name)


@router.post("/payroll/runs/{run_id}/approve", response_model=RunDetailOut, summary="Approve")
def approve(run_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep) -> RunDetailOut:
    if not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above approve payroll")
    run, client = _load(session, user, run_id)
    if run.status is not PayrollStatus.CALCULATED:
        raise HTTPException(status_code=409, detail=f"Run is {run.status.value.lower()}, not calculated")
    run.status = PayrollStatus.APPROVED
    run.approved_by_id = user.id
    run.approved_at = datetime.now(UTC)
    audit.record(session, user, "PAYROLL_APPROVE", resource_type="payroll_run", resource_id=run.id, request=request)
    session.commit()
    session.refresh(run)
    return _detail(run, client.name)


@router.post("/payroll/runs/{run_id}/mark-paid", response_model=RunDetailOut, summary="Mark paid")
def mark_paid(run_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep) -> RunDetailOut:
    forbid_portal(user, "mark payroll paid")
    run, client = _load(session, user, run_id)
    if run.status is not PayrollStatus.APPROVED:
        raise HTTPException(status_code=409, detail="Only an approved run can be marked paid")
    run.status = PayrollStatus.PAID
    run.paid_on = date.today()
    audit.record(session, user, "PAYROLL_PAID", resource_type="payroll_run", resource_id=run.id, request=request)
    session.commit()
    session.refresh(run)
    return _detail(run, client.name)
