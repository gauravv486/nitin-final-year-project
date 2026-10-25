"""Persisted GSTR-2B reconciliations - Module 5.

``recon.py`` beside this file is the stateless matcher. These endpoints feed it
from uploaded files or verified invoices and store the result.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.config import settings
from app.ml.recon.types import Tolerance
from app.models.compliance import GstReconciliation, GstReconciliationLine
from app.models.enums import MatchStatus, ReconRunStatus
from app.models.practice import Client
from app.services import audit
from app.services import gst as gst_service

router = APIRouter(tags=["gst"])


class RunOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    period: str
    status: ReconRunStatus
    total_lines: int
    matched_lines: int
    mismatched_lines: int
    match_rate: float
    books_tax_total: Decimal
    portal_tax_total: Decimal
    #: The liability: credit claimed that the portal does not support.
    itc_at_risk: Decimal
    #: The opportunity: credit the portal supports that the books did not take.
    itc_unclaimed: Decimal
    fuzzy_matches: int
    open_lines: int
    parameters: dict
    completed_at: datetime | None
    created_at: datetime


class LineOut(BaseModel):
    id: uuid.UUID
    supplier_name: str
    supplier_gstin: str | None
    invoice_no: str
    invoice_date: date | None
    books_taxable: Decimal | None
    books_tax: Decimal | None
    portal_taxable: Decimal | None
    portal_tax: Decimal | None
    tax_difference: Decimal
    status: MatchStatus
    confidence: float
    match_pass: str | None
    match_note: str | None
    resolved: bool
    resolved_at: datetime | None
    resolution_note: str | None


class RunDetailOut(RunOut):
    lines: list[LineOut]


class ResolveIn(BaseModel):
    resolution_note: str = Field(min_length=3, max_length=2000)


def _run_out(run: GstReconciliation, client_name: str, lines: list[GstReconciliationLine]) -> dict:
    totals = gst_service.totals_from_lines(lines)
    return {
        "id": run.id,
        "client_id": run.client_id,
        "client_name": client_name,
        "period": run.period,
        "status": run.status,
        "total_lines": run.total_lines,
        "matched_lines": run.matched_lines,
        "mismatched_lines": run.mismatched_lines,
        "match_rate": round(totals.match_rate, 4),
        "books_tax_total": run.books_tax_total,
        "portal_tax_total": run.portal_tax_total,
        "itc_at_risk": run.itc_at_risk,
        "itc_unclaimed": totals.itc_unclaimed,
        "fuzzy_matches": totals.fuzzy_matches,
        "open_lines": sum(
            1 for line in lines if line.status is not MatchStatus.MATCHED and line.resolved_at is None
        ),
        "parameters": run.parameters or {},
        "completed_at": run.completed_at,
        "created_at": run.created_at,
    }


def _line_out(line: GstReconciliationLine) -> LineOut:
    return LineOut(
        id=line.id,
        supplier_name=line.supplier_name,
        supplier_gstin=line.supplier_gstin,
        invoice_no=line.invoice_no,
        invoice_date=line.invoice_date,
        books_taxable=line.books_taxable,
        books_tax=line.books_tax,
        portal_taxable=line.portal_taxable,
        portal_tax=line.portal_tax,
        tax_difference=line.tax_difference,
        status=line.status,
        confidence=float(line.confidence),
        match_pass=line.match_pass,
        match_note=line.match_note,
        resolved=line.resolved_at is not None,
        resolved_at=line.resolved_at,
        resolution_note=line.resolution_note,
    )


async def _read_upload(upload: UploadFile) -> bytes:
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"Limit is {settings.MAX_UPLOAD_MB} MB")
    return data


@router.post(
    "/clients/{client_id}/gst/reconciliations",
    response_model=RunDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Reconcile a period against GSTR-2B and store the result",
)
async def create_run(
    client_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    period: Annotated[str, Form(pattern=r"^\d{4}-\d{2}$")],
    portal_file: Annotated[UploadFile, File(description="GSTR-2B JSON, or CSV/XLSX")],
    books_file: Annotated[
        UploadFile | None,
        File(description="Purchase register. Omit to use this period's verified invoices."),
    ] = None,
    replace: Annotated[bool, Form()] = False,
) -> RunDetailOut:
    forbid_portal(user, "run reconciliations")
    client = authorise_client(session, user, client_id)

    try:
        portal, portal_meta = gst_service.read_source(
            await _read_upload(portal_file), portal_file.filename or "2b.json", side="portal"
        )
        if books_file is not None and books_file.filename:
            books, books_meta = gst_service.read_source(
                await _read_upload(books_file), books_file.filename, side="books"
            )
        else:
            books, books_meta = gst_service.books_from_documents(
                session, client_id=client_id, period=period
            )
    except gst_service.SourceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not portal and not books:
        raise HTTPException(
            status_code=422,
            detail=(
                "Nothing to reconcile: the GSTR-2B file has no invoices and there is no "
                "books side. Upload a purchase register, or verify this period's invoices first."
            ),
        )

    run = gst_service.run_reconciliation(
        session,
        firm_id=user.firm_id,
        client_id=client_id,
        period=period,
        books=books,
        portal=portal,
        tolerance=Tolerance(),
        sources={"portal": portal_meta, "books": books_meta},
        replace=replace,
    )
    audit.record(
        session,
        user,
        "GST_RECON_RUN",
        resource_type="gst_reconciliation",
        resource_id=run.id,
        meta={"client_id": client_id, "period": period, "itc_at_risk": run.itc_at_risk},
        request=request,
    )
    session.commit()
    session.refresh(run)
    lines = list(run.lines)
    return RunDetailOut(**_run_out(run, client.name, lines), lines=[_line_out(x) for x in lines])


@router.get("/gst/reconciliations", response_model=list[RunOut], summary="Reconciliation runs")
def list_runs(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> list[RunOut]:
    conditions = [
        GstReconciliation.firm_id == user.firm_id,
        GstReconciliation.client_id.in_(visible_client_ids(user)),
    ]
    if client_id:
        conditions.append(GstReconciliation.client_id == client_id)
    if period:
        conditions.append(GstReconciliation.period == period)

    runs = session.execute(
        select(GstReconciliation, Client.name)
        .join(Client, Client.id == GstReconciliation.client_id)
        .where(*conditions)
        .order_by(GstReconciliation.period.desc(), Client.name)
    ).all()
    if not runs:
        return []

    lines_by_run: dict[uuid.UUID, list[GstReconciliationLine]] = {}
    for line in session.execute(
        select(GstReconciliationLine).where(
            GstReconciliationLine.reconciliation_id.in_([r.id for r, _ in runs])
        )
    ).scalars():
        lines_by_run.setdefault(line.reconciliation_id, []).append(line)

    return [RunOut(**_run_out(run, name, lines_by_run.get(run.id, []))) for run, name in runs]


@router.get(
    "/gst/reconciliations/{run_id}", response_model=RunDetailOut, summary="One run with its lines"
)
def get_run(
    run_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
    line_status: Annotated[MatchStatus | None, Query(alias="status")] = None,
) -> RunDetailOut:
    run = session.get(GstReconciliation, run_id)
    if run is None or run.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such reconciliation")
    client = authorise_client(session, user, run.client_id)

    lines = list(run.lines)
    # Worst first: missing-in-2B carries the liability, so it leads.
    order = {
        MatchStatus.MISSING_IN_2B: 0,
        MatchStatus.AMOUNT_MISMATCH: 1,
        MatchStatus.MISSING_IN_BOOKS: 2,
        MatchStatus.MATCHED: 3,
    }
    shown = sorted(
        (x for x in lines if line_status is None or x.status is line_status),
        key=lambda x: (order[x.status], -(abs(x.tax_difference))),
    )
    return RunDetailOut(**_run_out(run, client.name, lines), lines=[_line_out(x) for x in shown])


@router.patch(
    "/gst/reconciliation-lines/{line_id}", response_model=LineOut, summary="Resolve a line"
)
def resolve_line(
    line_id: uuid.UUID,
    payload: ResolveIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> LineOut:
    """A resolution needs a note. "Resolved" with no reason is not evidence of
    anything a reviewer could check later."""
    forbid_portal(user, "resolve reconciliation lines")
    line = session.get(GstReconciliationLine, line_id)
    run = session.get(GstReconciliation, line.reconciliation_id) if line else None
    if line is None or run is None or run.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such line")
    authorise_client(session, user, run.client_id)

    line.resolved_by_id = user.id
    line.resolved_at = datetime.now(UTC)
    line.resolution_note = payload.resolution_note
    audit.record(
        session,
        user,
        "GST_LINE_RESOLVE",
        resource_type="gst_reconciliation_line",
        resource_id=line.id,
        meta={"invoice_no": line.invoice_no, "status": line.status},
        request=request,
    )
    session.commit()
    return _line_out(line)


@router.get("/gst/summary", summary="Firm-wide ITC position from the latest run per client")
def itc_summary(session: SessionDep, user: CurrentUserDep) -> dict:
    latest = (
        select(
            GstReconciliation.client_id,
            func.max(GstReconciliation.period).label("period"),
        )
        .where(
            GstReconciliation.firm_id == user.firm_id,
            GstReconciliation.client_id.in_(visible_client_ids(user)),
        )
        .group_by(GstReconciliation.client_id)
        .subquery()
    )
    runs = session.execute(
        select(GstReconciliation, Client.name)
        .join(
            latest,
            (latest.c.client_id == GstReconciliation.client_id)
            & (latest.c.period == GstReconciliation.period),
        )
        .join(Client, Client.id == GstReconciliation.client_id)
    ).all()
    return {
        "clients": [
            {
                "client_id": run.client_id,
                "client_name": name,
                "period": run.period,
                "itc_at_risk": run.itc_at_risk,
                "mismatched_lines": run.mismatched_lines,
                "total_lines": run.total_lines,
            }
            for run, name in runs
        ],
        "itc_at_risk_total": sum((run.itc_at_risk for run, _ in runs), Decimal("0")),
    }
