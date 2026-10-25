"""Persisted risk findings - Module 8.

``risk.py`` beside this file runs the checks over posted-in data. These run
them over the stored ledger and keep the findings for triage.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.models.books import JournalEntry
from app.models.enums import RiskCheck, RiskSeverity, RiskStatus
from app.models.intelligence import RiskFinding
from app.models.practice import Client
from app.services import audit
from app.services import risk as risk_service

router = APIRouter(tags=["risk"])


class RunIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class FindingOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    check: RiskCheck
    severity: RiskSeverity
    status: RiskStatus
    title: str
    detail: str
    evidence: dict
    entry_count: int
    amount: Decimal | None
    score: float
    period: str | None
    triage_note: str | None
    triaged_at: datetime | None
    created_at: datetime


class EntryBrief(BaseModel):
    id: uuid.UUID
    transaction_date: date
    narration: str
    counterparty: str | None
    amount: Decimal
    direction: str


class FindingDetailOut(FindingOut):
    entries: list[EntryBrief]


class RunOut(BaseModel):
    period: str
    headline: str
    transactions_examined: int
    severity_counts: dict[str, int]
    skipped: dict[str, str]
    findings: list[FindingOut]


class TriageIn(BaseModel):
    status: RiskStatus
    triage_note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _note_required(self) -> TriageIn:
        # A dismissed alert with no reason teaches nothing; a false positive
        # with "bounded approval limit, by design" is how thresholds get tuned.
        if self.status in (RiskStatus.FALSE_POSITIVE, RiskStatus.RESOLVED) and not (
            self.triage_note and self.triage_note.strip()
        ):
            raise ValueError("A note is required to resolve or dismiss a finding")
        return self


class BenfordOut(BaseModel):
    n: int
    sufficient: bool
    minimum: int
    digits: list[dict]
    chi_square: float | None
    p_value: float | None


def _finding_out(f: RiskFinding, client_name: str) -> dict:
    return {
        "id": f.id,
        "client_id": f.client_id,
        "client_name": client_name,
        "check": f.check,
        "severity": f.severity,
        "status": f.status,
        "title": f.title,
        "detail": f.detail,
        "evidence": f.evidence or {},
        "entry_count": len(f.entry_ids or []),
        "amount": f.amount,
        "score": float(f.score),
        "period": f.period,
        "triage_note": f.triage_note,
        "triaged_at": f.triaged_at,
        "created_at": f.created_at,
    }


@router.post("/clients/{client_id}/risk/runs", response_model=RunOut, summary="Run risk checks")
def run(
    client_id: uuid.UUID,
    payload: RunIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> RunOut:
    forbid_portal(user, "run risk checks")
    client = authorise_client(session, user, client_id)
    report, rows = risk_service.run_checks(
        session, firm_id=user.firm_id, client_id=client_id, period=payload.period
    )
    audit.record(
        session,
        user,
        "RISK_RUN",
        resource_type="client",
        resource_id=client_id,
        meta={"period": payload.period, "findings": len(rows)},
        request=request,
    )
    session.commit()
    for row in rows:
        session.refresh(row)

    return RunOut(
        period=report.period,
        headline=report.headline(),
        transactions_examined=report.transactions_examined,
        severity_counts={k.value: v for k, v in report.by_severity.items()},
        skipped={str(k): v for k, v in report.skipped.items()},
        findings=[FindingOut(**_finding_out(r, client.name)) for r in rows],
    )


@router.get("/risk/findings", response_model=list[FindingOut], summary="Risk findings")
def list_findings(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    finding_status: Annotated[RiskStatus | None, Query(alias="status")] = None,
    severity: RiskSeverity | None = None,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[FindingOut]:
    conditions = [
        RiskFinding.firm_id == user.firm_id,
        RiskFinding.client_id.in_(visible_client_ids(user)),
    ]
    if client_id:
        conditions.append(RiskFinding.client_id == client_id)
    if finding_status:
        conditions.append(RiskFinding.status == finding_status)
    if severity:
        conditions.append(RiskFinding.severity == severity)
    if period:
        conditions.append(RiskFinding.period == period)

    rows = session.execute(
        select(RiskFinding, Client.name)
        .join(Client, Client.id == RiskFinding.client_id)
        .where(*conditions)
        .order_by(RiskFinding.score.desc(), RiskFinding.created_at.desc())
        .limit(limit)
    ).all()
    return [FindingOut(**_finding_out(f, name)) for f, name in rows]


@router.get(
    "/risk/findings/{finding_id}", response_model=FindingDetailOut, summary="Finding with entries"
)
def get_finding(finding_id: uuid.UUID, session: SessionDep, user: CurrentUserDep):
    finding = session.get(RiskFinding, finding_id)
    if finding is None or finding.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such finding")
    client = authorise_client(session, user, finding.client_id)
    entries = (
        session.execute(
            select(JournalEntry)
            .where(JournalEntry.id.in_(finding.entry_ids or []))
            .order_by(JournalEntry.transaction_date)
        )
        .scalars()
        .all()
        if finding.entry_ids
        else []
    )
    return FindingDetailOut(
        **_finding_out(finding, client.name),
        entries=[
            EntryBrief(
                id=e.id,
                transaction_date=e.transaction_date,
                narration=e.narration,
                counterparty=e.counterparty,
                amount=e.amount,
                direction=e.direction.value,
            )
            for e in entries
        ],
    )


@router.patch("/risk/findings/{finding_id}", response_model=FindingOut, summary="Triage a finding")
def triage(
    finding_id: uuid.UUID,
    payload: TriageIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> FindingOut:
    forbid_portal(user, "triage findings")
    finding = session.get(RiskFinding, finding_id)
    if finding is None or finding.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such finding")
    client = authorise_client(session, user, finding.client_id)

    finding.status = payload.status
    finding.triage_note = payload.triage_note
    finding.triaged_by_id = user.id
    finding.triaged_at = datetime.now(UTC)
    audit.record(
        session,
        user,
        "RISK_TRIAGE",
        resource_type="risk_finding",
        resource_id=finding.id,
        meta={"status": payload.status, "check": finding.check},
        request=request,
    )
    session.commit()
    return FindingOut(**_finding_out(finding, client.name))


@router.get("/risk/benford", response_model=BenfordOut, summary="First-digit distribution")
def benford(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> BenfordOut:
    """Across every visible client unless one is named. The p-value is withheld
    below the minimum sample - see ``benford_view``."""
    conditions = [
        JournalEntry.firm_id == user.firm_id,
        JournalEntry.client_id.in_(visible_client_ids(user)),
    ]
    if client_id:
        authorise_client(session, user, client_id)
        conditions.append(JournalEntry.client_id == client_id)
    if period:
        conditions.append(JournalEntry.period == period)

    amounts = list(session.execute(select(JournalEntry.amount).where(*conditions)).scalars())
    view = risk_service.benford_view(amounts)
    return BenfordOut(
        n=view.n,
        sufficient=view.sufficient,
        minimum=view.minimum,
        digits=[
            {"digit": d, "expected": view.expected[d - 1], "observed": view.observed[d - 1]}
            for d in range(1, 10)
        ],
        chi_square=view.chi_square,
        p_value=view.p_value,
    )
