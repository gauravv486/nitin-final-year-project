"""Case-law corpus: ingestion and hybrid search - Phase 6.

The corpus is shared across firms and therefore public material only. Nothing
client-confidential is ever written here.

The index lives in memory and is rebuilt only when the corpus changes - the
cache key is (chunk count, latest chunk timestamp). For the few thousand
passages a practice's research library holds, a full rebuild is a fraction of
a second for BM25 and a single matrix load for the embeddings.
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import date

import numpy as np
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ml.retrieval import dense
from app.ml.retrieval.chunking import chunk_text
from app.ml.retrieval.lexical import Bm25Index
from app.models.enums import CourtTier
from app.models.intelligence import CaseLawChunk, CaseLawDocument

logger = logging.getLogger(__name__)

#: Precedential weight, used only as a gentle tie-break between passages the
#: retrieval already ranks similarly. A Supreme Court passage that does not
#: answer the question must not outrank a tribunal passage that does.
COURT_WEIGHT = {
    CourtTier.SUPREME_COURT: 1.0,
    CourtTier.HIGH_COURT: 0.9,
    CourtTier.ITAT: 0.8,
    CourtTier.CESTAT: 0.8,
    CourtTier.AAR: 0.7,
    CourtTier.OTHER: 0.6,
}
RRF_K = 60


@dataclass(slots=True)
class _Index:
    version: tuple
    chunk_ids: list[uuid.UUID]
    document_ids: list[uuid.UUID]
    texts: list[str]
    courts: list[CourtTier]
    bm25: Bm25Index
    vectors: np.ndarray | None
    vector_rows: np.ndarray | None


_cache: _Index | None = None
_lock = threading.Lock()


def _version(session: Session) -> tuple:
    count, latest = session.execute(select(func.count(CaseLawChunk.id), func.max(CaseLawChunk.created_at))).one()
    return (int(count or 0), latest)


def _index(session: Session) -> _Index:
    global _cache
    version = _version(session)
    if _cache is not None and _cache.version == version:
        return _cache
    with _lock:
        if _cache is not None and _cache.version == version:
            return _cache
        rows = session.execute(
            select(CaseLawChunk, CaseLawDocument.court)
            .join(CaseLawDocument, CaseLawDocument.id == CaseLawChunk.document_id)
            .order_by(CaseLawChunk.document_id, CaseLawChunk.ordinal)
        ).all()
        texts = [c.content for c, _ in rows]
        model = dense.model_name()
        embedded = [
            (i, c.embedding) for i, (c, _) in enumerate(rows)
            if model and c.embedding_model == model and c.embedding and len(c.embedding) == settings.EMBEDDING_DIM
        ]
        vectors = np.asarray([v for _, v in embedded], dtype=np.float32) if embedded else None
        _cache = _Index(
            version=version,
            chunk_ids=[c.id for c, _ in rows],
            document_ids=[c.document_id for c, _ in rows],
            texts=texts,
            courts=[court for _, court in rows],
            bm25=Bm25Index().fit(texts),
            vectors=vectors,
            vector_rows=np.asarray([i for i, _ in embedded]) if embedded else None,
        )
        logger.info("case-law index rebuilt: %d passages, %d embedded", len(texts), len(embedded))
        return _cache


@dataclass(slots=True)
class Hit:
    chunk_id: uuid.UUID
    document: CaseLawDocument
    content: str
    score: float
    lexical_rank: int | None
    dense_rank: int | None


def search(
    session: Session,
    query: str,
    *,
    k: int = 8,
    court: CourtTier | None = None,
    section: str | None = None,
) -> tuple[list[Hit], dict]:
    index = _index(session)
    meta = {"passages": len(index.texts), "dense": index.vectors is not None, "model": dense.model_name()}
    if not index.texts:
        return [], meta

    pool = max(50, k * 6)
    lexical = index.bm25.scores(query)
    lexical_order = [int(i) for i in np.argsort(-lexical)[:pool] if lexical[i] > 0]

    dense_order: list[int] = []
    if index.vectors is not None:
        query_vector = dense.embed_query(query)
        if query_vector is not None:
            similarity = index.vectors @ query_vector.astype(np.float32)
            dense_order = [int(index.vector_rows[i]) for i in np.argsort(-similarity)[:pool]]

    fused: dict[int, float] = {}
    lexical_rank = {row: rank for rank, row in enumerate(lexical_order)}
    dense_rank = {row: rank for rank, row in enumerate(dense_order)}
    for ranking in (lexical_order, dense_order):
        for rank, row in enumerate(ranking):
            fused[row] = fused.get(row, 0.0) + 1.0 / (RRF_K + rank + 1)
    for row in fused:
        fused[row] *= 0.85 + 0.15 * COURT_WEIGHT[index.courts[row]]

    documents = {
        d.id: d
        for d in session.execute(
            select(CaseLawDocument).where(CaseLawDocument.id.in_({index.document_ids[r] for r in fused}))
        ).scalars()
    } if fused else {}

    hits: list[Hit] = []
    per_document: dict[uuid.UUID, int] = {}
    for row, score in sorted(fused.items(), key=lambda kv: -kv[1]):
        document = documents.get(index.document_ids[row])
        if document is None:
            continue
        if court and document.court is not court:
            continue
        if section and section.lower() not in [s.lower() for s in document.sections or []]:
            continue
        # At most two passages per judgment, so one long judgment cannot crowd
        # every other authority off the page.
        if per_document.get(document.id, 0) >= 2:
            continue
        per_document[document.id] = per_document.get(document.id, 0) + 1
        hits.append(
            Hit(
                chunk_id=index.chunk_ids[row],
                document=document,
                content=index.texts[row],
                score=round(score, 5),
                lexical_rank=lexical_rank.get(row),
                dense_rank=dense_rank.get(row),
            )
        )
        if len(hits) >= k:
            break
    return hits, meta


def ingest(
    session: Session,
    *,
    citation: str,
    title: str,
    court: CourtTier,
    full_text: str,
    decided_on: date | None = None,
    bench: str | None = None,
    sections: list[str] | None = None,
    outcome: str | None = None,
    headnote: str | None = None,
    source_url: str | None = None,
) -> CaseLawDocument:
    text = full_text.strip()
    if len(text) < 200:
        raise HTTPException(status_code=422, detail="The judgment text is too short to index (under 200 characters)")
    document = CaseLawDocument(
        citation=citation.strip()[:255], title=title.strip()[:500], court=court, bench=bench, decided_on=decided_on,
        sections=[s.strip() for s in (sections or []) if s.strip()], outcome=outcome, headnote=headnote,
        full_text=text, source_url=source_url,
    )
    session.add(document)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=f"{citation} is already in the corpus") from exc

    passages = chunk_text(((headnote or "") + "\n\n" + text).strip())
    vectors = dense.embed_passages(passages)
    model = dense.model_name() if vectors is not None else None
    for ordinal, passage in enumerate(passages):
        session.add(
            CaseLawChunk(
                document_id=document.id,
                ordinal=ordinal,
                content=passage,
                token_count=len(passage.split()),
                embedding=[float(x) for x in vectors[ordinal]] if vectors is not None else [],
                # "none" marks a passage indexed lexically only; scripts/
                # embed_caselaw.py backfills these once embeddings are installed.
                embedding_model=model or "none",
            )
        )
    return document


def reembed_missing(session: Session) -> int:
    """Embed passages that were indexed before the embedding model was available."""
    model = dense.model_name()
    if model is None:
        return 0
    chunks = session.execute(select(CaseLawChunk).where(CaseLawChunk.embedding_model != model)).scalars().all()
    if not chunks:
        return 0
    vectors = dense.embed_passages([c.content for c in chunks])
    for chunk, vector in zip(chunks, vectors, strict=True):
        chunk.embedding = [float(x) for x in vector]
        chunk.embedding_model = model
    return len(chunks)
