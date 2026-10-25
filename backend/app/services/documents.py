"""Documents: upload, extraction, verification - Module 3.

The lifecycle is QUEUED -> EXTRACTING -> NEEDS_REVIEW -> VERIFIED, with FAILED
for files nothing could be read from. There is no path from extraction
straight to VERIFIED: the extractor's confidence decides how closely a person
should look, never whether they look at all. Reconciliation reads only
VERIFIED invoices, so that rule is what keeps a misread digit out of a filed
return.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import PurePath

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ml.extraction.invoice import extract_invoice
from app.ml.extraction.notice import extract_form16a, extract_notice
from app.ml.extraction.text import ALLOWED_MIME, PDF, extract_text, sniff_mime
from app.models.enums import DocumentKind, DocumentStatus
from app.models.practice import Client, Document, DocumentExtraction
from app.services import storage
from app.utils.identifiers import gstin_checksum_ok, is_gstin
from app.utils.periods import to_month_period
from app.utils.tabular import parse_date

#: Fields a reviewer may correct, per kind. Anything else in a correction
#: payload is refused rather than silently stored.
CORRECTABLE = {
    "invoice": {
        "supplier_name",
        "supplier_gstin",
        "buyer_gstin",
        "invoice_no",
        "invoice_date",
        "taxable_value",
        "cgst",
        "sgst",
        "igst",
        "cess",
        "total_tax",
        "invoice_total",
    },
    "notice": {"notice_number", "authority", "section_code", "subject", "issued_on", "due_date", "demand_amount"},
    "tds": {"deductor_tan", "deductee_pan", "section", "amount_paid", "tds_amount", "quarter", "assessment_year"},
}
_MONEY_FIELDS = {
    "taxable_value", "cgst", "sgst", "igst", "cess", "total_tax", "invoice_total",
    "demand_amount", "amount_paid", "tds_amount",
}
_DATE_FIELDS = {"invoice_date", "issued_on", "due_date"}


def _family(kind: DocumentKind) -> str | None:
    if kind in (DocumentKind.PURCHASE_INVOICE, DocumentKind.SALES_INVOICE):
        return "invoice"
    if kind is DocumentKind.NOTICE:
        return "notice"
    if kind is DocumentKind.TDS_CERTIFICATE:
        return "tds"
    return None


def detect_kind(text: str, own_gstin: str | None) -> DocumentKind:
    """Best guess for a document uploaded as OTHER. Only ever a default - the
    uploader's own choice of kind is never overridden."""
    lower = text.lower()
    if re.search(r"form\s*(?:no\.?\s*)?16\s*a\b", lower):
        return DocumentKind.TDS_CERTIFICATE
    if re.search(r"\b(show\s+cause|notice)\b", lower) and re.search(r"\bdin\b", lower):
        return DocumentKind.NOTICE
    if "invoice" in lower and re.search(r"\bgstin\b", lower):
        if own_gstin:
            first = re.search(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", text.upper())
            if first and first.group(0) == own_gstin.upper():
                return DocumentKind.SALES_INVOICE
        return DocumentKind.PURCHASE_INVOICE
    if re.search(r"\b(statement\s+of\s+account|account\s+statement|opening\s+balance)\b", lower):
        return DocumentKind.BANK_STATEMENT
    return DocumentKind.OTHER


def upload(
    session: Session,
    *,
    client: Client,
    uploaded_by: uuid.UUID,
    data: bytes,
    filename: str,
    kind: DocumentKind,
    period: str | None,
    folder: str | None,
) -> Document:
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="The file is empty")
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Limit is {settings.MAX_UPLOAD_MB} MB")

    mime = sniff_mime(data, filename)
    if mime is None or mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Accepted: PDF, PNG, JPEG, CSV, XLSX, JSON. The file's content did not match any.",
        )

    checksum = storage.sha256(data)
    duplicate = session.execute(
        select(Document).where(
            Document.client_id == client.id,
            Document.checksum == checksum,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        # The cheapest duplicate-invoice control there is: the same bytes for
        # the same client are refused, naming the original.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"This file was already uploaded as {duplicate.file_name}",
                "document_id": str(duplicate.id),
            },
        )

    safe_name = PurePath(filename).name[:255] or "upload"
    key = storage.save(
        data,
        namespace=f"{client.firm_id}/{client.id}",
        suffix=PurePath(safe_name).suffix,
    )
    document = Document(
        firm_id=client.firm_id,
        client_id=client.id,
        uploaded_by_id=uploaded_by,
        file_name=safe_name,
        storage_key=key,
        mime_type=mime,
        size_bytes=len(data),
        checksum=checksum,
        kind=kind,
        status=DocumentStatus.QUEUED,
        folder=(folder or "/")[:255],
        period=period,
    )
    session.add(document)
    session.flush()
    run_extraction(session, document=document, client=client, data=data)
    return document


def run_extraction(
    session: Session, *, document: Document, client: Client, data: bytes | None = None
) -> DocumentExtraction:
    document.status = DocumentStatus.EXTRACTING
    if data is None:
        data = storage.read(document.storage_key)

    extraction = document.extraction
    if extraction is None:
        # Assigned through the relationship, not session.add(): adding the row
        # with only a document_id leaves document.extraction as None until the
        # next reload, and the very next read in the same request sees nothing.
        extraction = DocumentExtraction(engine="none")
        document.extraction = extraction

    result = extract_text(data, document.mime_type)
    extraction.engine = result.engine
    extraction.raw_text = result.text or None
    extraction.error_message = result.note
    extraction.corrected_at = None
    extraction.corrected_fields = None

    if document.kind is DocumentKind.OTHER and result.text:
        document.kind = detect_kind(result.text, client.gstin)

    family = _family(document.kind)
    fields: dict = {}
    overall: float | None = None
    if family == "invoice" and result.text:
        invoice = extract_invoice(
            result.text,
            own_gstin=client.gstin,
            purchase=document.kind is DocumentKind.PURCHASE_INVOICE,
        )
        fields, overall = invoice.to_json(), invoice.overall
        invoice_date = invoice.fields.get("invoice_date")
        if document.period is None and invoice_date:
            document.period = to_month_period(invoice_date)  # type: ignore[arg-type]
    elif family == "notice" and result.text:
        notice = extract_notice(result.text)
        fields = notice.to_json()
        overall = _mean(notice.confidence)
    elif family == "tds" and result.text:
        cert = extract_form16a(result.text)
        fields = cert.to_json()
        overall = _mean(cert.confidence)

    extraction.fields = fields
    extraction.confidence = Decimal(f"{overall:.4f}") if overall is not None else None

    if not result.text and document.mime_type == PDF and not result.needs_ocr:
        document.status = DocumentStatus.FAILED
        extraction.error_message = result.note or "No text could be read from this PDF"
    else:
        # Even a scan Tesseract could not read goes to review rather than
        # FAILED: a person can still read it and type the fields in.
        document.status = DocumentStatus.NEEDS_REVIEW
    return extraction


def _mean(confidence: dict[str, float]) -> float | None:
    return sum(confidence.values()) / len(confidence) if confidence else None


def _clean_correction(key: str, value):
    if value in (None, ""):
        return None
    if key in _MONEY_FIELDS:
        try:
            return str(Decimal(str(value).replace(",", "")).quantize(Decimal("0.01")))
        except InvalidOperation as exc:
            raise HTTPException(status_code=422, detail=f"{key}: not an amount") from exc
    if key in _DATE_FIELDS:
        parsed = parse_date(str(value))
        if parsed is None:
            raise HTTPException(status_code=422, detail=f"{key}: not a date (use dd/mm/yyyy)")
        return parsed.isoformat()
    if key in ("supplier_gstin", "buyer_gstin"):
        gstin = str(value).strip().upper()
        if not is_gstin(gstin) or not gstin_checksum_ok(gstin):
            raise HTTPException(
                status_code=422,
                detail=f"{key}: {gstin} fails the GSTIN check digit - check for a transposed character",
            )
        return gstin
    return str(value).strip()[:255]


def verify(
    session: Session, *, document: Document, corrections: dict, verified_at: datetime | None = None
) -> DocumentExtraction:
    """A person accepts the extraction, optionally correcting fields.

    Only fields that actually changed are stored in ``corrected_fields``; the
    original guess stays in ``fields``. That pair is the training signal for
    any future extractor.
    """
    extraction = document.extraction
    if extraction is None:
        raise HTTPException(status_code=409, detail="Nothing has been extracted from this document")

    family = _family(document.kind)
    allowed = CORRECTABLE.get(family or "", set())
    unknown = set(corrections) - allowed
    if unknown:
        raise HTTPException(
            status_code=422, detail=f"Not correctable for this document: {', '.join(sorted(unknown))}"
        )

    original = extraction.fields or {}
    changed = {}
    for key, value in corrections.items():
        cleaned = _clean_correction(key, value)
        if cleaned != original.get(key):
            changed[key] = cleaned

    if changed:
        extraction.corrected_fields = changed
        extraction.corrected_at = verified_at or datetime.now(UTC)
    document.status = DocumentStatus.VERIFIED

    effective = {**original, **changed}
    if document.period is None and effective.get("invoice_date"):
        parsed = parse_date(effective["invoice_date"])
        if parsed:
            document.period = to_month_period(parsed)
    return extraction


def effective_fields(extraction: DocumentExtraction | None) -> dict:
    if extraction is None:
        return {}
    return {
        k: v
        for k, v in {**(extraction.fields or {}), **(extraction.corrected_fields or {})}.items()
        if not k.startswith("_")
    }
