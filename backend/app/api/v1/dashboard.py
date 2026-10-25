"""Dashboard and client overview - the two screens that summarise everything else."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUserDep, SessionDep, visible_client_ids
from app.api.v1.compliance import task_counts
from app.models.books import JournalEntry
from app.models.compliance import ComplianceTask, GstReconciliation, TaxNotice
from app.models.enums import (
    DocumentStatus,
    FilingStatus,
    JournalStatus,
    NoticeStatus,
    RiskSeverity,
    RiskStatus,
)
from app.models.intelligence import RiskFinding
from app.models.practice import Client, Document
from app.models.tenancy import AuditLog, User
from app.services import compliance as compliance_engine

router = APIRouter(tags=["dashboard"])

#: Plain-language labels for the activity feed. Anything unlisted falls back
#: to the action code, title-cased.
ACTION_LABELS = {
    "DOCUMENT_UPLOAD": "Uploaded document",
    "DOCUMENT_VERIFY": "Verified document",
    "DOCUMENT_DOWNLOAD": "Downloaded document",
    "ENTRY_REVIEW": "Posted a ledger entry",
    "ENTRIES_CLASSIFY": "Ran the ledger classifier",
    "GST_RECON_RUN": "Ran a GSTR-2B reconciliation",
    "GST_LINE_RESOLVE": "Resolved a reconciliation line",
    "RISK_RUN": "Ran risk checks",
    "RISK_TRIAGE": "Triaged a risk finding",
    "NOTICE_DRAFT": "Drafted a notice reply",
    "NOTICE_APPROVE": "Approved a notice reply",
    "REPORT_GENERATE": "Generated a report",
    "TASK_UPDATE": "Updated a compliance task",
    "PAYROLL_CALCULATE": "Calculated payroll",
    "CLIENT_CREATE": "Added a client",
    "LOGIN": "Signed in",
}


@router.get("/dashboard", summary="Practice dashboard")
def dashboard(session: SessionDep, user: CurrentUserDep) -> dict:
    today = date.today()
    visible = visible_client_ids(user)

    clients = session.execute(select(func.count()).select_from(Client).where(Client.id.in_(visible))).scalar_one()
    tasks = task_counts(session, user, today)

    latest = (
        select(GstReconciliation.client_id, func.max(GstReconciliation.period).label("period"))
        .where(GstReconciliation.firm_id == user.firm_id, GstReconciliation.client_id.in_(visible))
        .group_by(GstReconciliation.client_id).subquery()
    )
    runs = session.execute(
        select(GstReconciliation).join(
            latest, (latest.c.client_id == GstReconciliation.client_id) & (latest.c.period == GstReconciliation.period)
        )
    ).scalars().all()

    risk = dict(
        session.execute(
            select(RiskFinding.severity, func.count())
            .where(RiskFinding.firm_id == user.firm_id, RiskFinding.status == RiskStatus.OPEN, RiskFinding.client_id.in_(visible))
            .group_by(RiskFinding.severity)
        ).all()
    )
    entries = dict(
        session.execute(
            select(JournalEntry.status, func.count())
            .where(JournalEntry.firm_id == user.firm_id, JournalEntry.client_id.in_(visible))
            .group_by(JournalEntry.status)
        ).all()
    )
    auto_applied = session.execute(
        select(func.count()).select_from(JournalEntry).where(
            JournalEntry.firm_id == user.firm_id, JournalEntry.client_id.in_(visible),
            JournalEntry.status == JournalStatus.APPROVED, JournalEntry.reviewed_by_id.is_(None),
        )
    ).scalar_one()
    documents_to_review = session.execute(
        select(func.count()).select_from(Document).where(
            Document.firm_id == user.firm_id, Document.client_id.in_(visible), Document.deleted_at.is_(None),
            Document.status == DocumentStatus.NEEDS_REVIEW,
        )
    ).scalar_one()
    notices = session.execute(
        select(TaxNotice, Client.name).join(Client, Client.id == TaxNotice.client_id)
        .where(TaxNotice.firm_id == user.firm_id, TaxNotice.client_id.in_(visible), TaxNotice.status != NoticeStatus.CLOSED)
        .order_by(TaxNotice.due_date)
    ).all()

    upcoming = session.execute(
        select(ComplianceTask, Client.name).join(Client, Client.id == ComplianceTask.client_id)
        .where(ComplianceTask.firm_id == user.firm_id, ComplianceTask.client_id.in_(visible),
               ComplianceTask.status != FilingStatus.FILED)
        .order_by(ComplianceTask.due_date).limit(8)
    ).all()

    activity = []
    if not user.is_portal_user:
        activity = session.execute(
            select(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)
            .where(AuditLog.firm_id == user.firm_id, AuditLog.action.in_(list(ACTION_LABELS)))
            .order_by(AuditLog.created_at.desc()).limit(8)
        ).all()

    classified = sum(v for k, v in entries.items() if k is not JournalStatus.SUGGESTED)
    return {
        "clients": clients,
        "tasks": tasks,
        "gst": {
            "runs": len(runs),
            "itc_at_risk": sum((r.itc_at_risk for r in runs), Decimal("0")),
            "invoices": sum(r.total_lines for r in runs),
            "matched": sum(r.matched_lines for r in runs),
            "mismatched": sum(r.mismatched_lines for r in runs),
        },
        "risk": {s.value: int(risk.get(s, 0)) for s in RiskSeverity},
        "bookkeeping": {
            "total": sum(entries.values()),
            "awaiting_review": int(entries.get(JournalStatus.UNDER_REVIEW, 0)),
            "unclassified": int(entries.get(JournalStatus.SUGGESTED, 0)),
            "auto_applied": auto_applied,
            "auto_apply_rate": round(auto_applied / classified, 4) if classified else None,
        },
        "documents_to_review": documents_to_review,
        "notices": {
            "open": len(notices),
            "due_14_days": sum(1 for n, _ in notices if n.due_date <= today + timedelta(days=14)),
            "next": [
                {"id": n.id, "client": name, "notice_number": n.notice_number, "section": n.section_code,
                 "due_date": n.due_date, "days_left": (n.due_date - today).days}
                for n, name in notices[:3]
            ],
        },
        "upcoming": [
            {"id": t.id, "client": name, "form": t.form, "period": t.period, "due_date": t.due_date,
             "days_left": (t.due_date - today).days, "status": compliance_engine.effective_status(t, today)}
            for t, name in upcoming
        ],
        "activity": [
            {"at": a.created_at, "actor": u.full_name if u else "System",
             "action": ACTION_LABELS.get(a.action, a.action.replace("_", " ").title()),
             "detail": (a.meta or {}).get("file_name") or (a.meta or {}).get("period") or a.resource_type}
            for a, u in activity
        ],
    }


@router.get("/clients-overview", summary="Clients with their filing position")
def clients_overview(session: SessionDep, user: CurrentUserDep) -> list[dict]:
    """What the client list shows beside each name: the GST and ITR status of
    the latest period, open items, and who owns the relationship."""
    today = date.today()
    rows = session.execute(
        select(Client, User).outerjoin(User, User.id == Client.manager_id)
        .where(Client.id.in_(visible_client_ids(user))).order_by(Client.name)
    ).all()
    ids = [c.id for c, _ in rows]
    tasks = session.execute(select(ComplianceTask).where(ComplianceTask.client_id.in_(ids))).scalars().all() if ids else []
    open_findings = dict(
        session.execute(
            select(RiskFinding.client_id, func.count())
            .where(RiskFinding.client_id.in_(ids), RiskFinding.status == RiskStatus.OPEN).group_by(RiskFinding.client_id)
        ).all()
    ) if ids else {}
    docs = dict(
        session.execute(
            select(Document.client_id, func.count())
            .where(Document.client_id.in_(ids), Document.status == DocumentStatus.NEEDS_REVIEW, Document.deleted_at.is_(None))
            .group_by(Document.client_id)
        ).all()
    ) if ids else {}

    def position(client_id, prefixes: tuple[str, ...]) -> str | None:
        relevant = sorted(
            (t for t in tasks if t.client_id == client_id and t.form.startswith(prefixes)),
            key=lambda t: t.due_date, reverse=True,
        )
        if not relevant:
            return None
        if any(compliance_engine.is_overdue(t, today) for t in relevant):
            return FilingStatus.OVERDUE.value
        return compliance_engine.effective_status(relevant[0], today).value

    out = []
    for client, manager in rows:
        open_tasks = sum(1 for t in tasks if t.client_id == client.id and t.status is not FilingStatus.FILED)
        out.append(
            {
                "id": client.id,
                "name": client.name,
                "legal_name": client.legal_name,
                "gstin": client.gstin,
                "pan": client.pan,
                "entity_type": client.entity_type,
                "status": client.status,
                "gst_status": position(client.id, ("GSTR", "PMT")),
                "itr_status": position(client.id, ("ITR",)),
                "open_items": open_tasks + int(open_findings.get(client.id, 0)) + int(docs.get(client.id, 0)),
                "assigned_to": manager.full_name if manager else None,
            }
        )
    return out
