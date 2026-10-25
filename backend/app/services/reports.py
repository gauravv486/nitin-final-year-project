"""Report builders - Module 16.

Each builder returns a header row and data rows; the writer turns them into
CSV or XLSX. Every export is hashed (SHA-256) and the hash stored with it, so
a recipient can confirm the file is the one that left the firm.
"""

from __future__ import annotations

import csv
import io
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.compliance import (
    ComplianceTask,
    GstReconciliation,
    GstReconciliationLine,
    PayrollLine,
    PayrollRun,
)
from app.models.enums import FilingStatus, ReportFormat, RiskStatus
from app.models.intelligence import RiskFinding
from app.models.practice import Client
from app.models.tenancy import AuditLog, User
from app.services import compliance as compliance_engine
from app.services import ledger as ledger_service


@dataclass(frozen=True, slots=True)
class ReportKind:
    key: str
    name: str
    scope: str
    #: Parameters the builder needs, for the UI's form.
    params: tuple[str, ...]
    formats: tuple[ReportFormat, ...] = (ReportFormat.XLSX, ReportFormat.CSV)


KINDS: dict[str, ReportKind] = {
    k.key: k
    for k in (
        ReportKind("trial-balance", "Trial balance", "Per client, per period", ("client_id", "period")),
        ReportKind("gst-recon", "GST reconciliation", "Per client, per period", ("client_id", "period")),
        ReportKind("itc-at-risk", "ITC at risk", "All clients, latest run each", ()),
        ReportKind("compliance-status", "Compliance status", "All clients", ()),
        ReportKind("payroll-register", "Payroll register", "Per client, per month", ("client_id", "period")),
        ReportKind("risk-register", "Risk register", "All clients, open findings", ()),
        ReportKind("audit-log", "Audit log extract", "Firm, date range", ("since", "until")),
        ReportKind("client-portfolio", "Client portfolio", "All clients", ()),
    )
}

Rows = tuple[list[str], list[list[object]]]


def _client(session, firm_id, params) -> Client:
    try:
        client_id = uuid.UUID(str(params.get("client_id")))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="client_id is required") from exc
    client = session.get(Client, client_id)
    if client is None or client.firm_id != firm_id:
        raise HTTPException(status_code=404, detail="No such client")
    return client


def _period(params) -> str:
    period = str(params.get("period") or "")
    if len(period) != 7 or period[4] != "-":
        raise HTTPException(status_code=422, detail="period (YYYY-MM) is required")
    return period


def trial_balance(session, firm_id, params, visible) -> Rows:
    client = _client(session, firm_id, params)
    if client.id not in visible:
        raise HTTPException(status_code=404, detail="No such client")
    tb = ledger_service.trial_balance(session, firm_id=firm_id, client_id=client.id, period=_period(params))
    rows = [[r.code, r.name, r.group.value, r.debit, r.credit, r.balance] for r in tb.rows]
    rows.append(["", "TOTAL", "", tb.total_debit, tb.total_credit, tb.total_debit - tb.total_credit])
    if tb.unposted_count:
        rows.append(["", f"Excluded: {tb.unposted_count} entries awaiting review", "", "", "", tb.unposted_amount])
    return ["Code", "Ledger", "Group", "Debit", "Credit", "Balance"], rows


def gst_recon(session, firm_id, params, visible) -> Rows:
    client = _client(session, firm_id, params)
    if client.id not in visible:
        raise HTTPException(status_code=404, detail="No such client")
    run = session.execute(
        select(GstReconciliation).where(GstReconciliation.client_id == client.id, GstReconciliation.period == _period(params))
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="No reconciliation for that period")
    lines = session.execute(select(GstReconciliationLine).where(GstReconciliationLine.reconciliation_id == run.id)).scalars()
    return (
        ["Supplier", "GSTIN", "Invoice no", "Date", "Books taxable", "Books tax", "2B taxable", "2B tax",
         "Status", "Match", "Note", "Resolution"],
        [
            [x.supplier_name, x.supplier_gstin, x.invoice_no, x.invoice_date, x.books_taxable, x.books_tax,
             x.portal_taxable, x.portal_tax, x.status.value, x.match_pass, x.match_note, x.resolution_note]
            for x in lines
        ],
    )


def itc_at_risk(session, firm_id, params, visible) -> Rows:
    latest = (
        select(GstReconciliation.client_id, func.max(GstReconciliation.period).label("period"))
        .where(GstReconciliation.firm_id == firm_id).group_by(GstReconciliation.client_id).subquery()
    )
    runs = session.execute(
        select(GstReconciliation, Client.name)
        .join(latest, (latest.c.client_id == GstReconciliation.client_id) & (latest.c.period == GstReconciliation.period))
        .join(Client, Client.id == GstReconciliation.client_id)
        .order_by(GstReconciliation.itc_at_risk.desc())
    ).all()
    return (
        ["Client", "Period", "Invoices", "Matched", "To resolve", "Books tax", "2B tax", "ITC at risk"],
        [[n, r.period, r.total_lines, r.matched_lines, r.mismatched_lines, r.books_tax_total, r.portal_tax_total, r.itc_at_risk]
         for r, n in runs if r.client_id in visible],
    )


def compliance_status(session, firm_id, params, visible) -> Rows:
    rows = session.execute(
        select(ComplianceTask, Client.name, User)
        .join(Client, Client.id == ComplianceTask.client_id)
        .outerjoin(User, User.id == ComplianceTask.assignee_id)
        .where(ComplianceTask.firm_id == firm_id)
        .order_by(ComplianceTask.due_date)
    ).all()
    return (
        ["Client", "Form", "Period", "Due", "Status", "Assignee"],
        [[n, t.form, t.period, t.due_date, compliance_engine.effective_status(t).value, u.full_name if u else ""]
         for t, n, u in rows if t.client_id in visible],
    )


def payroll_register(session, firm_id, params, visible) -> Rows:
    client = _client(session, firm_id, params)
    if client.id not in visible:
        raise HTTPException(status_code=404, detail="No such client")
    run = session.execute(
        select(PayrollRun).where(PayrollRun.client_id == client.id, PayrollRun.period == _period(params))
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="No payroll for that period")
    lines = session.execute(select(PayrollLine).where(PayrollLine.run_id == run.id).order_by(PayrollLine.employee_code)).scalars()
    return (
        ["Code", "Employee", "UAN", "Days", "Gross", "PF (ee)", "PF (er)", "ESI (ee)", "ESI (er)", "PT", "TDS", "Net"],
        [[x.employee_code, x.employee_name, x.uan, x.paid_days, x.gross, x.pf_employee, x.pf_employer,
          x.esi_employee, x.esi_employer, x.professional_tax, x.tds, x.net] for x in lines],
    )


def risk_register(session, firm_id, params, visible) -> Rows:
    rows = session.execute(
        select(RiskFinding, Client.name).join(Client, Client.id == RiskFinding.client_id)
        .where(RiskFinding.firm_id == firm_id, RiskFinding.status == RiskStatus.OPEN)
        .order_by(RiskFinding.score.desc())
    ).all()
    return (
        ["Client", "Period", "Check", "Severity", "Score", "Amount", "Title", "Detail"],
        [[n, f.period, f.check.value, f.severity.value, f.score, f.amount, f.title, f.detail]
         for f, n in rows if f.client_id in visible],
    )


def audit_extract(session, firm_id, params, visible) -> Rows:
    query = select(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id).where(AuditLog.firm_id == firm_id)
    for key, op in (("since", ">="), ("until", "<=")):
        if params.get(key):
            try:
                bound = date.fromisoformat(str(params[key]))
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"{key} must be YYYY-MM-DD") from exc
            column = func.date(AuditLog.created_at)
            query = query.where(column >= bound if op == ">=" else column <= bound)
    rows = session.execute(query.order_by(AuditLog.created_at)).all()
    return (
        ["At", "Actor", "Action", "Resource", "Resource id", "Outcome", "IP"],
        [[a.created_at, u.full_name if u else "System", a.action, a.resource_type, a.resource_id, a.outcome.value, a.ip_address]
         for a, u in rows],
    )


def client_portfolio(session, firm_id, params, visible) -> Rows:
    rows = session.execute(
        select(Client, User).outerjoin(User, User.id == Client.manager_id)
        .where(Client.firm_id == firm_id, Client.deleted_at.is_(None)).order_by(Client.name)
    ).all()
    open_tasks = dict(
        session.execute(
            select(ComplianceTask.client_id, func.count())
            .where(ComplianceTask.firm_id == firm_id, ComplianceTask.status != FilingStatus.FILED)
            .group_by(ComplianceTask.client_id)
        ).all()
    )
    return (
        ["Client", "Legal name", "Entity", "PAN", "GSTIN", "Status", "Manager", "Open tasks"],
        [[c.name, c.legal_name, c.entity_type.value, c.pan, c.gstin, c.status.value, u.full_name if u else "",
          open_tasks.get(c.id, 0)] for c, u in rows if c.id in visible],
    )


BUILDERS: dict[str, Callable[..., Rows]] = {
    "trial-balance": trial_balance,
    "gst-recon": gst_recon,
    "itc-at-risk": itc_at_risk,
    "compliance-status": compliance_status,
    "payroll-register": payroll_register,
    "risk-register": risk_register,
    "audit-log": audit_extract,
    "client-portfolio": client_portfolio,
}


def _cell(value: object) -> object:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if value is None:
        return ""
    return value


def write(headers: list[str], rows: list[list[object]], fmt: ReportFormat, title: str) -> bytes:
    if fmt is ReportFormat.CSV:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(["" if v is None else v for v in row])
        # BOM so Excel opens the UTF-8 (rupee signs, Devanagari names) correctly.
        return ("﻿" + buffer.getvalue()).encode("utf-8")

    from openpyxl import Workbook
    from openpyxl.styles import Font

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = title[:31]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in rows:
        sheet.append([_cell(v) for v in row])
    for column in sheet.columns:
        width = max(len(str(c.value or "")) for c in column)
        sheet.column_dimensions[column[0].column_letter].width = min(60, max(10, width + 2))
    sheet.freeze_panes = "A2"
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def build(session: Session, *, firm_id, kind: str, params: dict, visible: set) -> Rows:
    builder = BUILDERS.get(kind)
    if builder is None:
        raise HTTPException(status_code=404, detail="No such report")
    return builder(session, firm_id, params, visible)
