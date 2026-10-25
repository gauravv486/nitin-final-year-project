"""The copilot - Module 12.

Every answer carries ``citations``: the rows it came from. An answer nobody can
check is not an answer a CA can use.

Data questions run a vetted parameterised query for the classified intent,
scoped to what the caller may see. Legal questions go to case-law search; if a
language model is available it may summarise the retrieved passages, but it
must cite them by number, and any citation to a passage that was not retrieved
is stripped before the answer is shown.
"""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, visible_client_ids
from app.llm import complete_or_none
from app.ml import intent as intents
from app.models.books import JournalEntry
from app.models.compliance import ComplianceTask, GstReconciliation, PayrollRun, TaxNotice
from app.models.enums import (
    DocumentStatus,
    FilingStatus,
    JournalStatus,
    NoticeStatus,
    RiskSeverity,
    RiskStatus,
)
from app.models.intelligence import AiInteraction, RiskFinding
from app.models.practice import Client, Document
from app.models.tenancy import User
from app.services import caselaw
from app.utils.periods import month_period_label


@dataclass(slots=True)
class Answer:
    answer: str
    intent: str
    intent_label: str | None
    confidence: float
    columns: list[str] = field(default_factory=list)
    rows: list[list] = field(default_factory=list)
    citations: list[dict] = field(default_factory=list)
    slots: dict = field(default_factory=dict)
    provider: str = "rules"
    model: str | None = None
    fallback_reason: str | None = None
    interaction_id: uuid.UUID | None = None
    suggestions: list[str] = field(default_factory=list)


SUGGESTIONS = [
    "What is overdue?",
    "What is due this week?",
    "How much ITC is at risk?",
    "Open risk findings",
    "Transactions needing review",
    "Documents needing review",
    "Open notices",
    "What is the GSTIN of Arora Trading?",
    "Is ITC allowed if the supplier did not file GSTR-1?",
]


def _inr(value) -> str:
    return f"Rs {Decimal(value or 0):,.2f}"


def _client_filter(column, user: CurrentUser, client_id):
    conditions = [column.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(column == client_id)
    return conditions


# ---------------------------------------------------------------- handlers --


def _tasks(session, user, slots, *, overdue: bool) -> tuple:
    today = date.today()
    query = (
        select(ComplianceTask, Client.name)
        .join(Client, Client.id == ComplianceTask.client_id)
        .where(ComplianceTask.firm_id == user.firm_id, ComplianceTask.status != FilingStatus.FILED,
               *_client_filter(ComplianceTask.client_id, user, slots.get("client_id")))
    )
    if overdue:
        query = query.where(ComplianceTask.due_date < today)
    else:
        horizon = today + timedelta(days=31 if slots.get("client_id") else 7)
        query = query.where(ComplianceTask.due_date >= today, ComplianceTask.due_date <= horizon)
    if slots.get("form"):
        query = query.where(ComplianceTask.form == slots["form"])
    rows = session.execute(query.order_by(ComplianceTask.due_date).limit(50)).all()
    who = f" for {slots['client_name']}" if slots.get("client_name") else ""
    if not rows:
        text = f"Nothing is overdue{who}." if overdue else f"Nothing falls due{who} in the next {'month' if slots.get('client_id') else '7 days'}."
    else:
        first = rows[0][0]
        text = (
            f"{len(rows)} filing(s) overdue{who}. The oldest is {first.form} for {rows[0][1]}, "
            f"due {first.due_date:%d %b %Y} ({(today - first.due_date).days} days ago)."
            if overdue
            else f"{len(rows)} filing(s) due{who}. Next: {first.form} for {rows[0][1]} on {first.due_date:%d %b %Y}."
        )
    return (
        text,
        ["Client", "Form", "Period", "Due", "Days"],
        [[n, t.form, t.period, t.due_date.isoformat(), (t.due_date - today).days] for t, n in rows],
        [{"table": "compliance_tasks", "id": str(t.id), "label": f"{n} {t.form} {t.period}"} for t, n in rows],
    )


def _itc(session, user, slots) -> tuple:
    query = (
        select(GstReconciliation, Client.name)
        .join(Client, Client.id == GstReconciliation.client_id)
        .where(GstReconciliation.firm_id == user.firm_id, *_client_filter(GstReconciliation.client_id, user, slots.get("client_id")))
    )
    if slots.get("period"):
        query = query.where(GstReconciliation.period == slots["period"])
    runs = session.execute(query.order_by(GstReconciliation.period.desc())).all()
    latest: dict = {}
    for run, name in runs:
        latest.setdefault(run.client_id, (run, name))
    chosen = sorted(latest.values(), key=lambda rn: -rn[0].itc_at_risk)
    total = sum((r.itc_at_risk for r, _ in chosen), Decimal("0"))
    if not chosen:
        return ("No GSTR-2B reconciliation has been run yet, so there is no ITC position to report.", [], [], [])
    worst = chosen[0]
    text = (
        f"{_inr(total)} of input tax credit is at risk across {len(chosen)} client(s), from each client's "
        f"latest reconciliation. Largest: {worst[1]} ({_inr(worst[0].itc_at_risk)}, {worst[0].period})."
    )
    return (
        text,
        ["Client", "Period", "Invoices", "To resolve", "ITC at risk"],
        [[n, r.period, r.total_lines, r.mismatched_lines, float(r.itc_at_risk)] for r, n in chosen],
        [{"table": "gst_reconciliations", "id": str(r.id), "label": f"{n} {r.period}"} for r, n in chosen],
    )


def _recon(session, user, slots) -> tuple:
    query = (
        select(GstReconciliation, Client.name)
        .join(Client, Client.id == GstReconciliation.client_id)
        .where(GstReconciliation.firm_id == user.firm_id, *_client_filter(GstReconciliation.client_id, user, slots.get("client_id")))
    )
    if slots.get("period"):
        query = query.where(GstReconciliation.period == slots["period"])
    runs = session.execute(query.order_by(GstReconciliation.period.desc(), Client.name).limit(24)).all()
    if not runs:
        return ("No reconciliation matches that. Run one from the GST screen with the client's GSTR-2B.", [], [], [])
    run, name = runs[0]
    rate = run.matched_lines / run.total_lines if run.total_lines else 0
    return (
        f"{name}, {month_period_label(run.period)}: {run.matched_lines} of {run.total_lines} invoices matched "
        f"({rate:.0%}), {run.mismatched_lines} to resolve, ITC at risk {_inr(run.itc_at_risk)}.",
        ["Client", "Period", "Invoices", "Matched", "To resolve", "ITC at risk"],
        [[n, r.period, r.total_lines, r.matched_lines, r.mismatched_lines, float(r.itc_at_risk)] for r, n in runs],
        [{"table": "gst_reconciliations", "id": str(r.id), "label": f"{n} {r.period}"} for r, n in runs],
    )


def _risk(session, user, slots) -> tuple:
    query = (
        select(RiskFinding, Client.name)
        .join(Client, Client.id == RiskFinding.client_id)
        .where(RiskFinding.firm_id == user.firm_id, RiskFinding.status == RiskStatus.OPEN,
               *_client_filter(RiskFinding.client_id, user, slots.get("client_id")))
    )
    if re.search(r"\b(high|critical|serious|severe)\b", slots.get("question", ""), re.I):
        query = query.where(RiskFinding.severity.in_([RiskSeverity.HIGH, RiskSeverity.CRITICAL]))
    rows = session.execute(query.order_by(RiskFinding.score.desc()).limit(30)).all()
    if not rows:
        return ("No open risk findings. Either the checks have not been run for this period, or nothing was flagged.", [], [], [])
    return (
        f"{len(rows)} open finding(s). Highest scoring: {rows[0][0].title} ({rows[0][1]}, score {float(rows[0][0].score):.0f}).",
        ["Client", "Check", "Severity", "Score", "Finding"],
        [[n, f.check.value, f.severity.value, float(f.score), f.title] for f, n in rows],
        [{"table": "risk_findings", "id": str(f.id), "label": f.title} for f, n in rows],
    )


def _review(session, user, slots) -> tuple:
    conditions = [JournalEntry.firm_id == user.firm_id, JournalEntry.status == JournalStatus.UNDER_REVIEW,
                  *_client_filter(JournalEntry.client_id, user, slots.get("client_id"))]
    total = session.execute(select(func.count()).select_from(JournalEntry).where(*conditions)).scalar_one()
    rows = session.execute(
        select(JournalEntry, Client.name).join(Client, Client.id == JournalEntry.client_id)
        .where(*conditions).order_by(JournalEntry.confidence.asc().nulls_first()).limit(25)
    ).all()
    unclassified = session.execute(
        select(func.count()).select_from(JournalEntry).where(
            JournalEntry.firm_id == user.firm_id, JournalEntry.suggested_ledger_id.is_(None),
            *_client_filter(JournalEntry.client_id, user, slots.get("client_id")),
        )
    ).scalar_one()
    text = f"{total} entr{'y' if total == 1 else 'ies'} await review"
    text += f", and {unclassified} have not been classified yet." if unclassified else "."
    if rows:
        text += " Lowest confidence first below."
    return (
        text,
        ["Client", "Date", "Narration", "Amount", "Confidence"],
        [[n, e.transaction_date.isoformat(), e.narration[:60], float(e.amount),
          float(e.confidence) if e.confidence is not None else None] for e, n in rows],
        [{"table": "journal_entries", "id": str(e.id), "label": e.narration[:40]} for e, _ in rows],
    )


def _documents(session, user, slots) -> tuple:
    rows = session.execute(
        select(Document, Client.name).join(Client, Client.id == Document.client_id)
        .where(Document.firm_id == user.firm_id, Document.deleted_at.is_(None),
               Document.status.in_([DocumentStatus.NEEDS_REVIEW, DocumentStatus.FAILED]),
               *_client_filter(Document.client_id, user, slots.get("client_id")))
        .order_by(Document.created_at.desc()).limit(30)
    ).all()
    if not rows:
        return ("No documents are waiting for review.", [], [], [])
    return (
        f"{len(rows)} document(s) need a person to verify the extracted fields before they reach reconciliation.",
        ["Client", "File", "Kind", "Status", "Confidence"],
        [[n, d.file_name, d.kind.value, d.status.value,
          float(d.extraction.confidence) if d.extraction and d.extraction.confidence is not None else None] for d, n in rows],
        [{"table": "documents", "id": str(d.id), "label": d.file_name} for d, _ in rows],
    )


def _notices(session, user, slots) -> tuple:
    today = date.today()
    rows = session.execute(
        select(TaxNotice, Client.name).join(Client, Client.id == TaxNotice.client_id)
        .where(TaxNotice.firm_id == user.firm_id, TaxNotice.status != NoticeStatus.CLOSED,
               *_client_filter(TaxNotice.client_id, user, slots.get("client_id")))
        .order_by(TaxNotice.due_date)
    ).all()
    if not rows:
        return ("No open notices.", [], [], [])
    first = rows[0][0]
    return (
        f"{len(rows)} open notice(s). The next reply is due {first.due_date:%d %b %Y} "
        f"({(first.due_date - today).days} days) for {rows[0][1]} - {first.section_code or first.authority.value}.",
        ["Client", "Notice", "Section", "Due", "Days", "Demand", "Status"],
        [[n, x.notice_number, x.section_code, x.due_date.isoformat(), (x.due_date - today).days,
          float(x.demand_amount) if x.demand_amount is not None else None, x.status.value] for x, n in rows],
        [{"table": "tax_notices", "id": str(x.id), "label": x.notice_number} for x, _ in rows],
    )


def _client_lookup(session, user, slots) -> tuple:
    if not slots.get("client_id"):
        return ("Which client? I could not match a client name in the question.", [], [], [])
    client = session.get(Client, slots["client_id"])
    manager = session.get(User, client.manager_id) if client.manager_id else None
    fields = [
        ("Legal name", client.legal_name), ("PAN", client.pan), ("GSTIN", client.gstin), ("CIN", client.cin),
        ("Entity", client.entity_type.value.replace("_", " ").title()), ("GST filing", client.gst_frequency.title()),
        ("Manager", manager.full_name if manager else None), ("City", client.city),
    ]
    question = slots.get("question", "").lower()
    asked = next((label for label, _ in fields if label.lower() in question), None)
    if asked:
        value = dict(fields)[asked]
        text = f"{client.name}'s {asked} is {value}." if value else f"No {asked} is on record for {client.name}."
    else:
        text = f"{client.legal_name}: PAN {client.pan or '-'}, GSTIN {client.gstin or '-'}."
    return (
        text, ["Field", "Value"], [[label, value] for label, value in fields],
        [{"table": "clients", "id": str(client.id), "label": client.name}],
    )


def _client_list(session, user, slots) -> tuple:
    rows = session.execute(
        select(Client, User).outerjoin(User, User.id == Client.manager_id)
        .where(Client.id.in_(visible_client_ids(user))).order_by(Client.name)
    ).all()
    return (
        f"You can see {len(rows)} client(s).",
        ["Client", "Entity", "GSTIN", "Manager"],
        [[c.name, c.entity_type.value.replace("_", " ").title(), c.gstin, u.full_name if u else None] for c, u in rows],
        [{"table": "clients", "id": str(c.id), "label": c.name} for c, _ in rows],
    )


def _payroll(session, user, slots) -> tuple:
    query = (
        select(PayrollRun, Client.name).join(Client, Client.id == PayrollRun.client_id)
        .where(PayrollRun.firm_id == user.firm_id, *_client_filter(PayrollRun.client_id, user, slots.get("client_id")))
    )
    if slots.get("period"):
        query = query.where(PayrollRun.period == slots["period"])
    rows = session.execute(query.order_by(PayrollRun.period.desc()).limit(12)).all()
    if not rows:
        return ("No payroll runs on record.", [], [], [])
    run, name = rows[0]
    return (
        f"Latest: {name}, {month_period_label(run.period)} - {run.headcount} employees, gross {_inr(run.gross_total)}, "
        f"PF {_inr(run.pf_total)}, ESI {_inr(run.esi_total)}, PT {_inr(run.pt_total)}, TDS {_inr(run.tds_total)}.",
        ["Client", "Period", "Headcount", "Gross", "PF", "ESI", "PT", "TDS", "Status"],
        [[n, r.period, r.headcount, float(r.gross_total), float(r.pf_total), float(r.esi_total), float(r.pt_total),
          float(r.tds_total), r.status.value] for r, n in rows],
        [{"table": "payroll_runs", "id": str(r.id), "label": f"{n} {r.period}"} for r, n in rows],
    )


_CITATION_RE = re.compile(r"\[(\d{1,2})\]")


def _legal(session, user, slots) -> tuple:
    question = slots["question"]
    hits, meta = caselaw.search(session, question, k=6)
    if meta["passages"] == 0:
        return (
            "The case-law corpus is empty, so there is nothing to search. Add judgments with "
            "scripts/ingest_caselaw.py or the Case law > Add judgment screen. I will not answer a legal "
            "question from a language model's memory - that is how fabricated citations happen.",
            [], [], [], None,
        )
    if not hits:
        return ("No passage in the corpus matches this question.", [], [], [], None)

    columns = ["#", "Citation", "Court", "Passage"]
    rows = [[i, h.document.citation, h.document.court.value, h.content[:400]] for i, h in enumerate(hits, start=1)]
    citations = [
        {"table": "case_law_chunks", "id": str(h.chunk_id), "label": h.document.citation, "n": i}
        for i, h in enumerate(hits, start=1)
    ]
    passages = "\n\n".join(f"[{i}] {h.document.citation} ({h.document.court.value}): {h.content}" for i, h in enumerate(hits, 1))
    completion, reason = complete_or_none(
        "You are a research assistant for Indian chartered accountants.",
        "Answer the question using ONLY the numbered passages below. Cite every claim with the passage "
        "number in square brackets, e.g. [2]. If the passages do not answer the question, say so plainly. "
        "Do not mention any case, section or circular that is not in the passages.\n\n"
        f"QUESTION: {question}\n\nPASSAGES:\n{passages}",
        max_tokens=700,
    )
    search_note = "hybrid (BM25 + embeddings)" if meta["dense"] else "lexical (BM25) only"
    if completion is None:
        text = (
            f"Most relevant passages from {meta['passages']} indexed ({search_note}). No language model is "
            f"available to summarise them ({reason}) - read the passages below."
        )
        return text, columns, rows, citations, None

    valid = set(range(1, len(hits) + 1))
    cited = {int(n) for n in _CITATION_RE.findall(completion.text)}
    answer = _CITATION_RE.sub(lambda m: m.group(0) if int(m.group(1)) in valid else "", completion.text)
    if not cited & valid:
        answer += "\n\n(The model cited no passage. Treat this summary as unsupported and read the passages.)"
    return answer, columns, rows, citations, completion


HANDLERS = {
    "tasks_overdue": lambda s, u, sl: _tasks(s, u, sl, overdue=True),
    "tasks_due_soon": lambda s, u, sl: _tasks(s, u, sl, overdue=False),
    "itc_at_risk": _itc,
    "recon_status": _recon,
    "risk_open": _risk,
    "review_queue": _review,
    "documents_review": _documents,
    "notices_open": _notices,
    "client_lookup": _client_lookup,
    "client_list": _client_list,
    "payroll_summary": _payroll,
}


def ask(session: Session, user: CurrentUser, question: str, conversation_id: uuid.UUID | None) -> Answer:
    started = time.perf_counter()
    intent = intents.classify(question)

    visible = session.execute(
        select(Client.id, Client.name, Client.legal_name).where(Client.id.in_(visible_client_ids(user)))
    ).all()
    client = intents.match_client(question, [(r.id, r.name, r.legal_name) for r in visible])
    slots: dict = {"question": question}
    if client:
        slots.update(client_id=client[0], client_name=client[1])
    if period := intents.extract_period(question):
        slots["period"] = period
    if form := intents.extract_form(question):
        slots["form"] = form

    completion = None
    if not intent.accepted:
        answer = Answer(
            answer="I can answer questions about this practice's own records, and search the case-law corpus. "
            "I could not map that question to either - try one of the suggestions.",
            intent=intent.name, intent_label=None, confidence=intent.confidence, suggestions=SUGGESTIONS,
        )
    elif intent.name == "legal_question":
        text, columns, rows, citations, completion = _legal(session, user, slots)
        answer = Answer(answer=text, intent=intent.name, intent_label=intents.INTENT_LABELS[intent.name],
                        confidence=intent.confidence, columns=columns, rows=rows, citations=citations)
        if completion is None:
            answer.provider = "retrieval"
        else:
            answer.provider, answer.model = completion.provider, completion.model
    else:
        text, columns, rows, citations = HANDLERS[intent.name](session, user, slots)
        answer = Answer(answer=text, intent=intent.name, intent_label=intents.INTENT_LABELS[intent.name],
                        confidence=intent.confidence, columns=columns, rows=rows, citations=citations)

    answer.slots = {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in slots.items() if k != "question"}
    row = AiInteraction(
        firm_id=user.firm_id,
        user_id=user.id,
        conversation_id=conversation_id or uuid.uuid4(),
        provider=answer.provider,
        model=answer.model,
        prompt=question,
        response=answer.answer,
        intent=intent.name,
        intent_confidence=Decimal(f"{intent.confidence:.4f}"),
        citations=answer.citations,
        prompt_tokens=completion.prompt_tokens if completion else 0,
        output_tokens=completion.output_tokens if completion else 0,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    session.add(row)
    session.flush()
    answer.interaction_id = row.id
    return answer
