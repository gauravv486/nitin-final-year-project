"""Getting text out of an uploaded file.

Order of preference, cheapest and most accurate first:

1. **The PDF's own text layer** (pdfplumber). Most GST invoices are generated
   by billing software and carry exact text; reading it is lossless.
2. **PyMuPDF's text layer**, when pdfplumber returns little - it copes with
   some encodings pdfplumber does not.
3. **OCR** (Tesseract), only for pages with no usable text layer - scans and
   phone photos. OCR is where character errors come from (``0``/``O``,
   ``1``/``I``), which is why the field extractor validates what it finds.

If Tesseract is not installed, a scan is reported as ``needs_ocr`` rather than
returned as an empty string that downstream code would read as "no fields".
"""

from __future__ import annotations

import io
import logging
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

#: Below this many characters a page is treated as having no text layer.
MIN_TEXT_PER_PAGE = 25

#: Rendering resolution for OCR. 300 dpi is Tesseract's documented sweet spot;
#: lower loses small print on invoices, higher costs time for no accuracy.
OCR_DPI = 300

PDF = "application/pdf"
PNG = "image/png"
JPEG = "image/jpeg"
CSV = "text/csv"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
JSON = "application/json"

ALLOWED_MIME = {PDF, PNG, JPEG, CSV, XLSX, JSON}


@dataclass(slots=True)
class TextResult:
    text: str
    engine: str
    pages: int
    needs_ocr: bool = False
    note: str | None = None


def sniff_mime(data: bytes, filename: str) -> str | None:
    """Decide the type from the bytes, not the name or the browser's claim.

    A ``.pdf`` that is really an executable is refused here. Spreadsheets and
    CSV have no reliable magic, so for those the extension decides - they are
    parsed as data, never executed.
    """
    name = filename.lower()
    if data.startswith(b"%PDF-"):
        return PDF
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return PNG
    if data[:3] == b"\xff\xd8\xff":
        return JPEG
    if data.startswith(b"PK\x03\x04") and name.endswith((".xlsx", ".xlsm")):
        return XLSX
    if name.endswith(".json") and data.lstrip()[:1] in (b"{", b"["):
        return JSON
    if name.endswith((".csv", ".txt")):
        try:
            data[:4096].decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                data[:4096].decode("latin-1")
            except UnicodeDecodeError:
                return None
        return CSV
    return None


@lru_cache(maxsize=1)
def tesseract_path() -> str | None:
    found = shutil.which("tesseract")
    if found:
        return found
    default = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    return str(default) if default.exists() else None


def tesseract_available() -> bool:
    return tesseract_path() is not None


def _ocr_image(image) -> str:
    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = tesseract_path()
    # psm 6: a single uniform block of text - closest to an invoice's layout.
    return pytesseract.image_to_string(image, config="--psm 6")


def extract_text(data: bytes, mime: str) -> TextResult:
    if mime == PDF:
        return _from_pdf(data)
    if mime in (PNG, JPEG):
        return _from_image(data)
    if mime in (CSV, JSON):
        return TextResult(text=data.decode("utf-8-sig", errors="replace"), engine="raw", pages=1)
    if mime == XLSX:
        return TextResult(text="", engine="none", pages=1, note="Spreadsheet: read as data, not text")
    return TextResult(text="", engine="none", pages=0, note=f"Unsupported type {mime}")


def _from_pdf(data: bytes) -> TextResult:
    import pdfplumber

    texts: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                texts.append(page.extract_text() or "")
    except Exception as exc:  # malformed PDFs are common; fall through to PyMuPDF
        logger.info("pdfplumber failed (%s); trying PyMuPDF", exc)
        texts = []

    import pymupdf

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        return TextResult(text="", engine="none", pages=0, note=f"Unreadable PDF: {exc}")

    pages = document.page_count
    if len(texts) != pages:
        texts = [""] * pages

    engines = set()
    ocr_needed: list[int] = []
    for index in range(pages):
        if len(texts[index].strip()) >= MIN_TEXT_PER_PAGE:
            engines.add("pdfplumber")
            continue
        fallback = document[index].get_text() or ""
        if len(fallback.strip()) >= MIN_TEXT_PER_PAGE:
            texts[index] = fallback
            engines.add("pymupdf")
        else:
            ocr_needed.append(index)

    note = None
    if ocr_needed:
        if tesseract_available():
            from PIL import Image

            for index in ocr_needed:
                pixmap = document[index].get_pixmap(dpi=OCR_DPI)
                image = Image.open(io.BytesIO(pixmap.tobytes("png")))
                texts[index] = _ocr_image(image)
            engines.add("tesseract")
        else:
            note = (
                f"{len(ocr_needed)} of {pages} page(s) are scans with no text layer, "
                "and Tesseract is not installed. Install it to read scanned documents."
            )
    document.close()

    text = "\n".join(texts).strip()
    return TextResult(
        text=text,
        engine="+".join(sorted(engines)) or "none",
        pages=pages,
        needs_ocr=bool(ocr_needed) and not tesseract_available(),
        note=note,
    )


def _from_image(data: bytes) -> TextResult:
    if not tesseract_available():
        return TextResult(
            text="",
            engine="none",
            pages=1,
            needs_ocr=True,
            note="Image upload needs OCR, and Tesseract is not installed.",
        )
    from PIL import Image

    image = Image.open(io.BytesIO(data))
    return TextResult(text=_ocr_image(image).strip(), engine="tesseract", pages=1)
