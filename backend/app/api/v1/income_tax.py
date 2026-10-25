"""AIS against the books - Module 6.

The Annual Information Statement is what the department *thinks* the client
earned. Every line is compared against the client's own credit entries for the
financial year, matched on the counterparty name. The output is the list of
heads where the two disagree - which is the list of things the department will
ask about.

The portal's own AIS download is an encrypted, password-protected file; this
accepts the lines as JSON or as a CSV exported from the AIS utility.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from rapidfuzz import fuzz
from sqlalchemy import select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.models.books import JournalEntry
from app.models.compliance import AisLine, AisStatement
from app.models.enums import AisHead, FilingStatus, TransactionDirection
from app.models.practice import Client
from app.services import audit
from app.utils.identifiers import normalise_name
from app.utils.periods import financial_year_bounds
from app.utils.tabular import TableError, parse_amount, pick, read_table

router = APIRouter(tags=["income-tax"])

#: A counterparty name at or above this RapidFuzz token-set score is the same
#: payer. Token-set, because "Arora Trading Pvt Ltd" and "ARORA TRADING PRIVATE
#: LIMITED" share every meaningful token in a different order.
MATCH_SCORE = 85
_SUFFIXES = (" PRIVATE LIMITED", " PVT LTD", " PVT. LTD.", " LIMITED", " LTD", " LLP", " AND CO", " & CO")

_HEAD_ALIASES = {
    "salary": AisHead.SALARY, "interest": AisHead.INTEREST, "dividend": AisHead.DIVIDEND,
    "capital": AisHead.CAPITAL_GAINS, "rent": AisHead.RENT, "194j": AisHead.BUSINESS_RECEIPTS,
    "194c": AisHead.BUSINESS_RECEIPTS, "194h": AisHead.BUSINESS_RECEIPTS, "professional": AisHead.BUSINESS_RECEIPTS,
    "contract": AisHead.BUSINESS_RECEIPTS, "business": AisHead.BUSINESS_RECEIPTS, "receipt": AisHead.BUSINESS_RECEIPTS,
    "remittance": AisHead.FOREIGN_REMITTANCE, "tds": AisHead.TDS_TCS, "tcs": AisHead.TDS_TCS,
}


def _head(text: str) -> AisHead:
    lower = text.lower()
    try:
        return AisHead(text.upper())
    except ValueError:
        pass
    for key, head in _HEAD_ALIASES.items():
        if key in lower:
            return head
    return AisHead.OTHER


def _core_name(name: str) -> str:
    upper = normalise_name(name)
    for suffix in _SUFFIXES:
        if upper.endswith(suffix):
            upper = upper[: -len(suffix)]
    return upper.strip()


class AisLineIn(BaseModel):
    head: str = Field(min_length=2, max_length=60, description="AIS head, e.g. INTEREST or 'Professional receipts 194J'")
    counterparty: str | None = Field(default=None, max_length=255)
    tan: str | None = Field(default=None, pattern=r"^[A-Z]{4}\d{5}[A-Z]$")
    ais_amount: Decimal = Field(ge=0)
    tds_credit: Decimal = Field(default=Decimal("0"), ge=0)
    note: str | None = Field(default=None, max_length=255)


class AisIn(BaseModel):
    assessment_year: str = Field(pattern=r"^\d{4}-\d{2}$")
    lines: list[AisLineIn] = Field(min_length=1, max_length=2000)
    replace: bool = False


class LineOut(BaseModel):
    id: uuid.UUID
    head: AisHead
    counterparty: str | None
    tan: str | None
    ais_amount: Decimal
    books_amount: Decimal | None
    tds_credit: Decimal
    variance: Decimal
    flagged: bool
    note: str | None


class StatementOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    assessment_year: str
    financial_year: str
    status: FilingStatus
    ais_total: Decimal
    books_total: Decimal
    variance_total: Decimal
    flagged_lines: int
    tds_total: Decimal
    created_at: datetime


class StatementDetailOut(StatementOut):
    lines: list[LineOut]


def financial_year_for_ay(ay: str) -> str:
    start = int(ay[:4]) - 1
    return f"{start}-{(start + 1) % 100:02d}"


def _books_by_payer(session, client_id: uuid.UUID, financial_year: str) -> dict[str, Decimal]:
    start, end = financial_year_bounds(financial_year)
    totals: dict[str, Decimal] = {}
    for entry in session.execute(
        select(JournalEntry).where(
            JournalEntry.client_id == client_id,
            JournalEntry.direction == TransactionDirection.CREDIT,
            JournalEntry.transaction_date >= start,
            JournalEntry.transaction_date <= end,
        )
    ).scalars():
        name = entry.counterparty or entry.normalised_narration or entry.narration
        key = _core_name(name)
        totals[key] = totals.get(key, Decimal("0")) + entry.amount
    return totals


def _match(counterparty: str | None, books: dict[str, Decimal]) -> tuple[Decimal | None, str | None]:
    if not counterparty:
        return None, "No counterparty on the AIS line"
    target = _core_name(counterparty)
    best, best_score = None, 0.0
    for name in books:
        score = fuzz.token_set_ratio(target, name)
        if score > best_score:
            best, best_score = name, score
    if best is None or best_score < MATCH_SCORE:
        return None, "No receipt from this payer in the books"
    return books[best], f"Matched to '{best}' ({best_score:.0f}% similar)"


def _flag(ais: Decimal, books: Decimal | None) -> bool:
    if books is None:
        return ais > 0
    difference = abs(ais - books)
    return difference > max(Decimal("10"), ais * Decimal("0.01"))


def _statement_out(st: AisStatement, name: str) -> dict:
    lines = list(st.lines)
    return {
        "id": st.id,
        "client_id": st.client_id,
        "client_name": name,
        "assessment_year": st.assessment_year,
        "financial_year": financial_year_for_ay(st.assessment_year),
        "status": st.status,
        "ais_total": st.ais_total,
        "books_total": st.books_total,
        "variance_total": st.variance_total,
        "flagged_lines": sum(1 for x in lines if x.flagged),
        "tds_total": sum((x.tds_credit for x in lines), Decimal("0")),
        "created_at": st.created_at,
    }


def _detail(st: AisStatement, name: str) -> StatementDetailOut:
    lines = sorted(st.lines, key=lambda x: (not x.flagged, -abs(x.variance)))
    return StatementDetailOut(
        **_statement_out(st, name),
        lines=[LineOut.model_validate(x, from_attributes=True) for x in lines],
    )


def build_statement(session, *, firm_id, client: Client, ay: str, lines: list[AisLineIn], replace: bool) -> AisStatement:
    existing = session.execute(
        select(AisStatement).where(AisStatement.client_id == client.id, AisStatement.assessment_year == ay)
    ).scalar_one_or_none()
    if existing and not replace:
        raise HTTPException(status_code=409, detail=f"An AIS for AY {ay} exists. Pass replace=true.")
    if existing:
        session.delete(existing)
        session.flush()

    books = _books_by_payer(session, client.id, financial_year_for_ay(ay))
    statement = AisStatement(
        firm_id=firm_id, client_id=client.id, assessment_year=ay, status=FilingStatus.IN_PROGRESS,
        source_payload={"lines": [line.model_dump(mode="json") for line in lines]},
    )
    session.add(statement)
    session.flush()
    ais_total = books_total = variance_total = Decimal("0")
    for line in lines:
        books_amount, note = _match(line.counterparty, books)
        variance = line.ais_amount - (books_amount or Decimal("0"))
        ais_total += line.ais_amount
        books_total += books_amount or Decimal("0")
        variance_total += variance
        session.add(
            AisLine(
                statement_id=statement.id, head=_head(line.head), counterparty=line.counterparty, tan=line.tan,
                ais_amount=line.ais_amount, books_amount=books_amount, tds_credit=line.tds_credit,
                variance=variance, flagged=_flag(line.ais_amount, books_amount), note=line.note or note,
            )
        )
    statement.ais_total, statement.books_total, statement.variance_total = ais_total, books_total, variance_total
    return statement


@router.get("/ais/statements", response_model=list[StatementOut], summary="AIS statements")
def list_statements(session: SessionDep, user: CurrentUserDep, client_id: uuid.UUID | None = None):
    conditions = [AisStatement.firm_id == user.firm_id, AisStatement.client_id.in_(visible_client_ids(user))]
    if client_id:
        conditions.append(AisStatement.client_id == client_id)
    rows = session.execute(
        select(AisStatement, Client.name).join(Client, Client.id == AisStatement.client_id)
        .where(*conditions).order_by(AisStatement.assessment_year.desc(), Client.name)
    ).all()
    return [StatementOut(**_statement_out(s, n)) for s, n in rows]


@router.get("/ais/statements/{statement_id}", response_model=StatementDetailOut, summary="One AIS comparison")
def get_statement(statement_id: uuid.UUID, session: SessionDep, user: CurrentUserDep):
    statement = session.get(AisStatement, statement_id)
    if statement is None or statement.firm_id != user.firm_id:
        raise HTTPException(status_code=404, detail="No such statement")
    client = authorise_client(session, user, statement.client_id)
    return _detail(statement, client.name)


@router.post(
    "/clients/{client_id}/ais", response_model=StatementDetailOut, status_code=status.HTTP_201_CREATED,
    summary="Compare AIS lines against the books",
)
def create_statement(client_id: uuid.UUID, payload: AisIn, request: Request, session: SessionDep, user: CurrentUserDep):
    forbid_portal(user, "compare AIS")
    client = authorise_client(session, user, client_id)
    statement = build_statement(
        session, firm_id=user.firm_id, client=client, ay=payload.assessment_year, lines=payload.lines, replace=payload.replace
    )
    audit.record(session, user, "AIS_COMPARE", resource_type="ais_statement", resource_id=statement.id,
                 meta={"assessment_year": payload.assessment_year, "lines": len(payload.lines)}, request=request)
    session.commit()
    session.refresh(statement)
    return _detail(statement, client.name)


@router.post(
    "/clients/{client_id}/ais/upload", response_model=StatementDetailOut, status_code=status.HTTP_201_CREATED,
    summary="Compare an AIS CSV/XLSX export against the books",
)
async def upload_statement(
    client_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    assessment_year: Annotated[str, Form(pattern=r"^\d{4}-\d{2}$")],
    file: Annotated[UploadFile, File()],
    replace: Annotated[bool, Form()] = False,
):
    forbid_portal(user, "compare AIS")
    client = authorise_client(session, user, client_id)
    try:
        rows = read_table(await file.read(), file.filename or "ais.csv")
    except TableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    lines = []
    for row in rows:
        amount = parse_amount(pick(row, "amount", "amount paid", "amount paid credited", "value", "ais amount"))
        if amount is None:
            continue
        tan = pick(row, "tan", "tan of deductor").upper() or None
        lines.append(
            AisLineIn(
                head=pick(row, "information category", "head", "category", "information description", "section") or "OTHER",
                counterparty=pick(row, "information source", "source", "deductor", "payer", "name") or None,
                tan=tan if tan and len(tan) == 10 else None,
                ais_amount=abs(amount),
                tds_credit=abs(parse_amount(pick(row, "tds", "tds deducted", "tax deducted")) or Decimal("0")),
            )
        )
    if not lines:
        raise HTTPException(status_code=422, detail="No rows with an amount were found")
    statement = build_statement(session, firm_id=user.firm_id, client=client, ay=assessment_year, lines=lines, replace=replace)
    audit.record(session, user, "AIS_COMPARE", resource_type="ais_statement", resource_id=statement.id,
                 meta={"assessment_year": assessment_year, "file": file.filename}, request=request)
    session.commit()
    session.refresh(statement)
    return _detail(statement, client.name)
