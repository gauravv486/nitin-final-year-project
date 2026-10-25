"""Report generation and download - Module 16."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUserDep, SessionDep, forbid_portal, visible_client_ids
from app.core.roles import at_least
from app.models.enums import FirmRole, ReportFormat, ReportStatus
from app.models.tenancy import User
from app.models.workflow import Report
from app.services import audit, storage
from app.services import reports as builders

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportIn(BaseModel):
    kind: str
    format: ReportFormat = ReportFormat.XLSX
    parameters: dict = Field(default_factory=dict)


class ReportOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: str
    format: ReportFormat
    status: ReportStatus
    parameters: dict
    row_count: int | None
    size_bytes: int | None
    checksum: str | None
    generated_by: str | None
    created_at: datetime


def _out(report: Report, by: str | None) -> ReportOut:
    return ReportOut(
        id=report.id, name=report.name, kind=report.kind, format=report.format, status=report.status,
        parameters=report.parameters or {}, row_count=report.row_count, size_bytes=report.size_bytes,
        checksum=report.checksum, generated_by=by, created_at=report.created_at,
    )


@router.get("/definitions", summary="Reports that can be generated")
def definitions() -> list[dict]:
    return [
        {"kind": k.key, "name": k.name, "scope": k.scope, "params": list(k.params), "formats": [f.value for f in k.formats]}
        for k in builders.KINDS.values()
    ]


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED, summary="Generate a report")
def generate(payload: ReportIn, request: Request, session: SessionDep, user: CurrentUserDep) -> ReportOut:
    forbid_portal(user, "generate firm reports")
    kind = builders.KINDS.get(payload.kind)
    if kind is None:
        raise HTTPException(status_code=404, detail="No such report")
    if payload.kind == "audit-log" and not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above export the audit log")
    if payload.format not in kind.formats:
        raise HTTPException(status_code=422, detail=f"{kind.name} is available as {', '.join(f.value for f in kind.formats)}")

    visible = set(session.execute(visible_client_ids(user)).scalars())
    headers, rows = builders.build(session, firm_id=user.firm_id, kind=payload.kind, params=payload.parameters, visible=visible)
    data = builders.write(headers, rows, payload.format, kind.name)
    extension = ".csv" if payload.format is ReportFormat.CSV else ".xlsx"
    key = storage.save(data, namespace=f"{user.firm_id}/reports", suffix=extension)

    report = Report(
        firm_id=user.firm_id, generated_by_id=user.id, name=kind.name, kind=kind.key, format=payload.format,
        status=ReportStatus.READY, parameters=payload.parameters, storage_key=key, size_bytes=len(data),
        row_count=len(rows), checksum=storage.sha256(data),
    )
    session.add(report)
    session.flush()
    audit.record(session, user, "REPORT_GENERATE", resource_type="report", resource_id=report.id,
                 meta={"kind": kind.key, "rows": len(rows)}, request=request)
    session.commit()
    session.refresh(report)
    me = session.get(User, user.id)
    return _out(report, me.full_name if me else None)


@router.get("", response_model=list[ReportOut], summary="Generated reports")
def list_reports(session: SessionDep, user: CurrentUserDep) -> list[ReportOut]:
    forbid_portal(user, "list firm reports")
    rows = session.execute(
        select(Report, User).outerjoin(User, User.id == Report.generated_by_id)
        .where(Report.firm_id == user.firm_id).order_by(Report.created_at.desc()).limit(100)
    ).all()
    return [_out(r, u.full_name if u else None) for r, u in rows]


@router.get("/{report_id}/download", summary="Download a report")
def download(report_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    forbid_portal(user, "download firm reports")
    report = session.get(Report, report_id)
    if report is None or report.firm_id != user.firm_id or not report.storage_key:
        raise HTTPException(status_code=404, detail="No such report")
    try:
        path = storage.path_for(report.storage_key)
    except storage.StorageError as exc:
        raise HTTPException(status_code=410, detail="The report file is missing") from exc
    audit.record(session, user, "REPORT_DOWNLOAD", resource_type="report", resource_id=report.id, request=request)
    session.commit()
    extension = "csv" if report.format is ReportFormat.CSV else "xlsx"
    media = "text/csv" if report.format is ReportFormat.CSV else (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    filename = f"{report.kind}-{report.created_at:%Y%m%d-%H%M}.{extension}"
    return FileResponse(path, media_type=media, filename=filename, headers={"X-Content-SHA256": report.checksum or ""})
