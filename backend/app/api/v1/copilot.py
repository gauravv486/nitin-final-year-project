"""Copilot, case-law corpus, and AI status - Module 12 and Phase 6."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import CurrentUserDep, SessionDep, forbid_portal
from app.core.config import settings
from app.core.roles import at_least
from app.llm import provider_status
from app.ml.extraction.text import PDF, extract_text, sniff_mime, tesseract_available
from app.ml.ledger.predict import get_classifier
from app.ml.retrieval import dense
from app.models.enums import CourtTier, FirmRole
from app.models.intelligence import AiInteraction, CaseLawChunk, CaseLawDocument
from app.services import audit, caselaw, copilot

router = APIRouter(tags=["copilot"])


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    conversation_id: uuid.UUID | None = None


class AskOut(BaseModel):
    answer: str
    intent: str
    intent_label: str | None
    confidence: float
    columns: list[str]
    rows: list[list]
    citations: list[dict]
    slots: dict
    provider: str
    model: str | None
    interaction_id: uuid.UUID | None
    suggestions: list[str]


class FeedbackIn(BaseModel):
    score: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=1000)


class CaseIn(BaseModel):
    citation: str = Field(min_length=3, max_length=255)
    title: str = Field(min_length=3, max_length=500)
    court: CourtTier
    decided_on: date | None = None
    bench: str | None = Field(default=None, max_length=255)
    sections: list[str] = Field(default_factory=list, max_length=20)
    outcome: str | None = Field(default=None, max_length=60)
    headnote: str | None = Field(default=None, max_length=5000)
    full_text: str = Field(min_length=200, max_length=2_000_000)
    source_url: str | None = Field(default=None, max_length=512)


class CaseOut(BaseModel):
    id: uuid.UUID
    citation: str
    title: str
    court: CourtTier
    decided_on: date | None
    sections: list[str]
    outcome: str | None
    headnote: str | None
    source_url: str | None
    passages: int
    created_at: datetime


class HitOut(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    citation: str
    title: str
    court: CourtTier
    decided_on: date | None
    passage: str
    score: float
    lexical_rank: int | None
    dense_rank: int | None


@router.post("/copilot/ask", response_model=AskOut, summary="Ask the copilot")
def ask(payload: AskIn, session: SessionDep, user: CurrentUserDep) -> AskOut:
    answer = copilot.ask(session, user, payload.question.strip(), payload.conversation_id)
    session.commit()
    return AskOut(
        answer=answer.answer, intent=answer.intent, intent_label=answer.intent_label, confidence=answer.confidence,
        columns=answer.columns, rows=answer.rows, citations=answer.citations, slots=answer.slots,
        provider=answer.provider, model=answer.model, interaction_id=answer.interaction_id,
        suggestions=answer.suggestions or copilot.SUGGESTIONS[:5],
    )


@router.post("/copilot/feedback/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Rate an answer")
def feedback(interaction_id: uuid.UUID, payload: FeedbackIn, session: SessionDep, user: CurrentUserDep):
    row = session.get(AiInteraction, interaction_id)
    if row is None or row.firm_id != user.firm_id or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="No such answer")
    row.feedback_score = payload.score
    row.feedback_note = payload.note
    session.commit()


@router.get("/copilot/history", summary="Your recent questions")
def history(session: SessionDep, user: CurrentUserDep, limit: Annotated[int, Query(ge=1, le=100)] = 20) -> list[dict]:
    rows = session.execute(
        select(AiInteraction)
        .where(AiInteraction.user_id == user.id, AiInteraction.intent.not_like("draft:%"))
        .order_by(AiInteraction.created_at.desc()).limit(limit)
    ).scalars()
    return [
        {"id": r.id, "question": r.prompt, "answer": r.response, "intent": r.intent,
         "provider": r.provider, "feedback_score": r.feedback_score, "created_at": r.created_at}
        for r in rows
    ]


@router.get("/caselaw/search", response_model=list[HitOut], summary="Search the case-law corpus")
def search(
    session: SessionDep,
    user: CurrentUserDep,
    q: Annotated[str, Query(min_length=2, max_length=500)],
    court: CourtTier | None = None,
    section: Annotated[str | None, Query(max_length=30)] = None,
    k: Annotated[int, Query(ge=1, le=30)] = 10,
) -> list[HitOut]:
    hits, _ = caselaw.search(session, q, k=k, court=court, section=section)
    return [
        HitOut(
            chunk_id=h.chunk_id, document_id=h.document.id, citation=h.document.citation, title=h.document.title,
            court=h.document.court, decided_on=h.document.decided_on, passage=h.content, score=h.score,
            lexical_rank=h.lexical_rank, dense_rank=h.dense_rank,
        )
        for h in hits
    ]


def _case_out(session, document: CaseLawDocument) -> CaseOut:
    passages = session.execute(
        select(func.count()).select_from(CaseLawChunk).where(CaseLawChunk.document_id == document.id)
    ).scalar_one()
    return CaseOut(
        id=document.id, citation=document.citation, title=document.title, court=document.court,
        decided_on=document.decided_on, sections=document.sections or [], outcome=document.outcome,
        headnote=document.headnote, source_url=document.source_url, passages=passages, created_at=document.created_at,
    )


@router.get("/caselaw/documents", response_model=list[CaseOut], summary="The corpus")
def list_cases(session: SessionDep, user: CurrentUserDep) -> list[CaseOut]:
    rows = session.execute(select(CaseLawDocument).order_by(CaseLawDocument.decided_on.desc().nulls_last())).scalars()
    return [_case_out(session, d) for d in rows]


@router.post("/caselaw/documents", response_model=CaseOut, status_code=status.HTTP_201_CREATED, summary="Add a judgment")
def add_case(payload: CaseIn, request: Request, session: SessionDep, user: CurrentUserDep) -> CaseOut:
    """Partners only. The corpus is shared public law - never upload anything
    client-confidential here."""
    if not at_least(user.role, FirmRole.PARTNER):
        raise HTTPException(status_code=403, detail="Partners add to the case-law corpus")
    document = caselaw.ingest(session, **payload.model_dump())
    audit.record(session, user, "CASELAW_ADD", resource_type="case_law_document", resource_id=document.id,
                 meta={"citation": payload.citation}, request=request)
    session.commit()
    session.refresh(document)
    return _case_out(session, document)


@router.post("/caselaw/documents/upload", response_model=CaseOut, status_code=status.HTTP_201_CREATED,
             summary="Add a judgment from a PDF")
async def add_case_pdf(
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    file: Annotated[UploadFile, File()],
    citation: Annotated[str, Form(min_length=3, max_length=255)],
    title: Annotated[str, Form(min_length=3, max_length=500)],
    court: Annotated[CourtTier, Form()],
    decided_on: Annotated[date | None, Form()] = None,
    sections: Annotated[str, Form(description="Comma-separated, e.g. GST-16,GST-16(4)")] = "",
    outcome: Annotated[str | None, Form()] = None,
):
    if not at_least(user.role, FirmRole.PARTNER):
        raise HTTPException(status_code=403, detail="Partners add to the case-law corpus")
    data = await file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if sniff_mime(data, file.filename or "") != PDF:
        raise HTTPException(status_code=415, detail="Upload the judgment as a PDF")
    text = extract_text(data, PDF)
    if not text.text:
        raise HTTPException(status_code=422, detail=text.note or "No text could be read from the PDF")
    document = caselaw.ingest(
        session, citation=citation, title=title, court=court, decided_on=decided_on,
        sections=[s for s in sections.split(",") if s.strip()], outcome=outcome, full_text=text.text,
    )
    audit.record(session, user, "CASELAW_ADD", resource_type="case_law_document", resource_id=document.id,
                 meta={"citation": citation, "file": file.filename}, request=request)
    session.commit()
    session.refresh(document)
    return _case_out(session, document)


@router.get("/ai/status", summary="Which AI components are live")
def ai_status(session: SessionDep, user: CurrentUserDep) -> dict:
    """Reported honestly, so the UI can say "template draft" or "lexical search
    only" instead of implying more than is running."""
    forbid_portal(user, "see AI status")
    classifier = get_classifier()
    passages, embedded = session.execute(
        select(func.count(CaseLawChunk.id), func.count(CaseLawChunk.id).filter(CaseLawChunk.embedding_model != "none"))
    ).one()
    return {
        "ledger_classifier": {"available": classifier is not None, "version": classifier.version if classifier else None},
        "language_model": provider_status(),
        "embeddings": {
            "installed": dense.installed(),
            "model": settings.EMBEDDING_MODEL,
            "passages": int(passages or 0),
            "embedded_passages": int(embedded or 0),
            "pgvector": settings.PGVECTOR_ENABLED,
        },
        "ocr": {"tesseract": tesseract_available()},
    }
