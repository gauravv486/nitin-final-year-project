"""Document upload, extraction and review - Module 3."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.api.deps import (
    CurrentUserDep,
    SessionDep,
    authorise_client,
    forbid_portal,
    visible_client_ids,
)
from app.core.config import settings
from app.core.roles import at_least
from app.models.enums import DocumentKind, DocumentStatus, FirmRole
from app.models.practice import Client, Document
from app.models.tenancy import User
from app.services import audit, storage
from app.services import documents as document_service
from app.services import ledger as ledger_service

router = APIRouter(tags=["documents"])


class ExtractionOut(BaseModel):
    engine: str
    confidence: float | None
    #: Effective values: the extractor's, overlaid with any human correction.
    fields: dict[str, Any]
    #: What the extractor originally produced, for comparison.
    extracted_fields: dict[str, Any]
    corrected_fields: dict[str, Any] | None
    field_confidence: dict[str, float]
    checks: list[dict]
    hints: list[str]
    corrected_at: datetime | None
    error_message: str | None
    text_preview: str | None


class DocumentOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    file_name: str
    mime_type: str
    size_bytes: int
    kind: DocumentKind
    status: DocumentStatus
    folder: str
    period: str | None
    uploaded_by: str | None
    created_at: datetime
    confidence: float | None
    #: A few headline fields so the list can show them without a second call.
    summary: dict[str, Any]


class DocumentDetailOut(DocumentOut):
    extraction: ExtractionOut | None


class DocumentListOut(BaseModel):
    data: list[DocumentOut]
    page: int
    page_size: int
    total: int
    total_pages: int
    status_counts: dict[str, int]


class VerifyIn(BaseModel):
    corrections: dict[str, Any] = Field(default_factory=dict)


_SUMMARY_KEYS = (
    "supplier_name",
    "supplier_gstin",
    "invoice_no",
    "invoice_date",
    "taxable_value",
    "total_tax",
    "invoice_total",
    "notice_number",
    "due_date",
    "demand_amount",
    "deductor_tan",
    "tds_amount",
)


def _document_out(document: Document, client_name: str, uploader: str | None) -> dict:
    effective = document_service.effective_fields(document.extraction)
    return {
        "id": document.id,
        "client_id": document.client_id,
        "client_name": client_name,
        "file_name": document.file_name,
        "mime_type": document.mime_type,
        "size_bytes": document.size_bytes,
        "kind": document.kind,
        "status": document.status,
        "folder": document.folder,
        "period": document.period,
        "uploaded_by": uploader,
        "created_at": document.created_at,
        "confidence": float(document.extraction.confidence)
        if document.extraction and document.extraction.confidence is not None
        else None,
        "summary": {k: effective.get(k) for k in _SUMMARY_KEYS if effective.get(k) is not None},
    }


def _extraction_out(document: Document) -> ExtractionOut | None:
    extraction = document.extraction
    if extraction is None:
        return None
    raw = extraction.fields or {}
    return ExtractionOut(
        engine=extraction.engine,
        confidence=float(extraction.confidence) if extraction.confidence is not None else None,
        fields=document_service.effective_fields(extraction),
        extracted_fields={k: v for k, v in raw.items() if not k.startswith("_")},
        corrected_fields=extraction.corrected_fields,
        field_confidence=raw.get("_confidence", {}),
        checks=raw.get("_checks", []),
        hints=raw.get("_hints", []),
        corrected_at=extraction.corrected_at,
        error_message=extraction.error_message,
        text_preview=(extraction.raw_text or "")[:3000] or None,
    )


def _load(session, user, document_id: uuid.UUID) -> tuple[Document, Client]:
    document = session.get(Document, document_id)
    if document is None or document.firm_id != user.firm_id or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="No such document")
    client = authorise_client(session, user, document.client_id)
    return document, client


def _uploader_name(session, user_id) -> str | None:
    if user_id is None:
        return None
    person = session.get(User, user_id)
    return person.full_name if person else None


@router.post(
    "/clients/{client_id}/documents",
    response_model=DocumentDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document and extract it",
)
async def upload_document(
    client_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    file: Annotated[UploadFile, File()],
    kind: Annotated[DocumentKind, Form()] = DocumentKind.OTHER,
    period: Annotated[str | None, Form(pattern=r"^\d{4}-\d{2}$")] = None,
    folder: Annotated[str | None, Form(max_length=255)] = None,
) -> DocumentDetailOut:
    """Portal users may upload for their own client - sending invoices is the
    most common thing a client does. Extraction runs before the response
    returns; a typical invoice takes well under a second."""
    client = authorise_client(session, user, client_id)
    data = await file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    document = document_service.upload(
        session,
        client=client,
        uploaded_by=user.id,
        data=data,
        filename=file.filename or "upload",
        kind=kind,
        period=period,
        folder=folder,
    )
    audit.record(
        session,
        user,
        "DOCUMENT_UPLOAD",
        resource_type="document",
        resource_id=document.id,
        meta={"file_name": document.file_name, "kind": document.kind, "client_id": client_id},
        request=request,
    )
    session.commit()
    session.refresh(document)
    return DocumentDetailOut(
        **_document_out(document, client.name, _uploader_name(session, user.id)),
        extraction=_extraction_out(document),
    )


@router.get("/documents", response_model=DocumentListOut, summary="Documents")
def list_documents(
    session: SessionDep,
    user: CurrentUserDep,
    client_id: uuid.UUID | None = None,
    document_status: Annotated[DocumentStatus | None, Query(alias="status")] = None,
    kind: DocumentKind | None = None,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> DocumentListOut:
    conditions = [
        Document.firm_id == user.firm_id,
        Document.deleted_at.is_(None),
        Document.client_id.in_(visible_client_ids(user)),
    ]
    if client_id:
        conditions.append(Document.client_id == client_id)
    if kind:
        conditions.append(Document.kind == kind)
    if period:
        conditions.append(Document.period == period)
    if q:
        conditions.append(or_(Document.file_name.ilike(f"%{q.strip()}%")))

    counts = dict(
        session.execute(
            select(Document.status, func.count()).where(*conditions).group_by(Document.status)
        ).all()
    )
    if document_status:
        conditions.append(Document.status == document_status)

    total = session.execute(select(func.count()).select_from(Document).where(*conditions)).scalar_one()
    rows = session.execute(
        select(Document, Client.name, User)
        .join(Client, Client.id == Document.client_id)
        .outerjoin(User, User.id == Document.uploaded_by_id)
        .where(*conditions)
        .order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return DocumentListOut(
        data=[
            DocumentOut(**_document_out(d, name, u.full_name if u else None)) for d, name, u in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=max(1, -(-total // page_size)),
        status_counts={s.value: int(counts.get(s, 0)) for s in DocumentStatus},
    )


@router.get("/documents/{document_id}", response_model=DocumentDetailOut, summary="One document")
def get_document(document_id: uuid.UUID, session: SessionDep, user: CurrentUserDep):
    document, client = _load(session, user, document_id)
    return DocumentDetailOut(
        **_document_out(document, client.name, _uploader_name(session, document.uploaded_by_id)),
        extraction=_extraction_out(document),
    )


@router.get("/documents/{document_id}/download", summary="Download the original file")
def download(document_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    document, _ = _load(session, user, document_id)
    try:
        path = storage.path_for(document.storage_key)
    except storage.StorageError as exc:
        raise HTTPException(status_code=410, detail="The stored file is missing") from exc
    audit.record(
        session,
        user,
        "DOCUMENT_DOWNLOAD",
        resource_type="document",
        resource_id=document.id,
        meta={"file_name": document.file_name},
        request=request,
    )
    session.commit()
    return FileResponse(path, media_type=document.mime_type, filename=document.file_name)


@router.post(
    "/documents/{document_id}/extract", response_model=DocumentDetailOut, summary="Re-run extraction"
)
def re_extract(document_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    """Discards any correction - re-extracting is a fresh start. The audit log
    keeps the record that a correction existed."""
    forbid_portal(user, "re-run extraction")
    document, client = _load(session, user, document_id)
    document_service.run_extraction(session, document=document, client=client)
    audit.record(
        session, user, "DOCUMENT_EXTRACT", resource_type="document", resource_id=document.id, request=request
    )
    session.commit()
    session.refresh(document)
    return DocumentDetailOut(
        **_document_out(document, client.name, _uploader_name(session, document.uploaded_by_id)),
        extraction=_extraction_out(document),
    )


@router.post(
    "/documents/{document_id}/verify", response_model=DocumentDetailOut, summary="Verify extraction"
)
def verify_document(
    document_id: uuid.UUID,
    payload: VerifyIn,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> DocumentDetailOut:
    """Accept the extracted fields, correcting any that are wrong. Only a
    verified purchase invoice reaches GST reconciliation."""
    forbid_portal(user, "verify documents")
    document, client = _load(session, user, document_id)
    extraction = document_service.verify(session, document=document, corrections=payload.corrections)
    audit.record(
        session,
        user,
        "DOCUMENT_VERIFY",
        resource_type="document",
        resource_id=document.id,
        meta={"corrected": sorted((extraction.corrected_fields or {}).keys())},
        request=request,
    )
    session.commit()
    session.refresh(document)
    return DocumentDetailOut(
        **_document_out(document, client.name, _uploader_name(session, document.uploaded_by_id)),
        extraction=_extraction_out(document),
    )


@router.post(
    "/documents/{document_id}/import-entries",
    summary="Import a bank-statement document into the ledger",
)
def import_entries(
    document_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep
) -> dict:
    forbid_portal(user, "import statements")
    document, client = _load(session, user, document_id)
    if document.kind is not DocumentKind.BANK_STATEMENT:
        raise HTTPException(status_code=422, detail="Only a bank statement can be imported")
    if not document.file_name.lower().endswith((".csv", ".xlsx", ".xlsm", ".txt")):
        raise HTTPException(
            status_code=422,
            detail=(
                "PDF statements are not parsed - layouts differ per bank and a misread row "
                "corrupts the books. Download the CSV or XLSX from net banking instead."
            ),
        )
    outcome = ledger_service.import_statement(
        session,
        firm_id=user.firm_id,
        client_id=client.id,
        data=storage.read(document.storage_key),
        filename=document.file_name,
        document_id=document.id,
    )
    document.status = DocumentStatus.VERIFIED
    audit.record(
        session,
        user,
        "STATEMENT_IMPORT",
        resource_type="document",
        resource_id=document.id,
        meta={"imported": outcome.imported, "skipped": len(outcome.skipped)},
        request=request,
    )
    session.commit()
    return {"imported": outcome.imported, "skipped": outcome.skipped[:100]}


@router.delete(
    "/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Archive a document"
)
def delete_document(document_id: uuid.UUID, request: Request, session: SessionDep, user: CurrentUserDep):
    """Soft delete, managers and above. The file is kept on disk: retention
    rules for tax records outlast any one engagement."""
    if not at_least(user.role, FirmRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers and above may archive documents")
    document, _ = _load(session, user, document_id)
    document.deleted_at = datetime.now(UTC)
    audit.record(
        session, user, "DOCUMENT_ARCHIVE", resource_type="document", resource_id=document.id, request=request
    )
    session.commit()
