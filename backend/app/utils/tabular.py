"""Reading the spreadsheets Indian practices actually receive.

Bank statements, purchase registers, GSTR-2B exports and payroll inputs all
arrive as CSV or XLSX, and no two banks agree on a header. Three things go
wrong constantly and are handled here once:

* **Headers.** "Withdrawal Amt.", "Debit", "Dr Amount" are the same column.
  ``pick`` matches against a list of aliases after normalising case and
  punctuation.
* **Amounts.** ``1,23,456.78`` (Indian lakh grouping), ``₹ 450``, ``(1,200)``
  for a negative, ``450.00 Cr``. ``parse_amount`` returns ``None`` for a blank
  cell - not zero, because "no value" and "zero" mean different things in a
  reconciliation.
* **Dates.** ``05/09/2026`` is 5 September in India, never 9 May. Day-first is
  assumed throughout; ISO dates are accepted too.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

_HEADER_JUNK = re.compile(r"[^a-z0-9]+")


class TableError(ValueError):
    """The file could not be read as a table. The message is user-facing."""


def _norm_header(value: object) -> str:
    return _HEADER_JUNK.sub("", str(value or "").strip().lower())


def read_table(data: bytes, filename: str) -> list[dict[str, str]]:
    """Rows as ``{normalised_header: cell_text}``.

    XLSX is read from its first sheet, starting at the first row that has at
    least two non-empty cells - bank exports put a title block above the real
    header, and treating "HDFC BANK LTD" as a column name helps nobody.
    """
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        rows = _xlsx_rows(data)
    elif name.endswith((".csv", ".txt")):
        rows = _csv_rows(data)
    else:
        raise TableError("Expected a .csv or .xlsx file")

    header_index = next(
        (i for i, row in enumerate(rows) if sum(1 for c in row if str(c).strip()) >= 2),
        None,
    )
    if header_index is None:
        raise TableError("The file has no header row")

    headers = [_norm_header(h) for h in rows[header_index]]
    out: list[dict[str, str]] = []
    for raw in rows[header_index + 1 :]:
        cells = [str(c).strip() if c is not None else "" for c in raw]
        if not any(cells):
            continue
        out.append({h: (cells[i] if i < len(cells) else "") for i, h in enumerate(headers) if h})
    return out


def _csv_rows(data: bytes) -> list[list[str]]:
    # utf-8-sig strips the BOM Excel writes; latin-1 is the fallback because
    # it can decode any byte sequence, so a stray ₹ in a cp1252 export does not
    # fail the whole import.
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    return list(csv.reader(io.StringIO(text), dialect))


def _xlsx_rows(data: bytes) -> list[list[str]]:
    from openpyxl import load_workbook

    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:
        raise TableError("The spreadsheet could not be opened") from exc
    sheet = workbook.worksheets[0]
    rows: list[list[str]] = []
    for row in sheet.iter_rows(values_only=True):
        rows.append(
            [
                value.strftime("%Y-%m-%d") if isinstance(value, (datetime, date)) else value
                for value in row
            ]
        )
    workbook.close()
    return rows


def pick(row: dict[str, str], *aliases: str) -> str:
    """The first non-empty cell whose header matches any alias."""
    for alias in aliases:
        value = row.get(_norm_header(alias))
        if value not in (None, ""):
            return value
    return ""


_AMOUNT_JUNK = re.compile(r"[₹,\s]|INR|Rs\.?", re.IGNORECASE)


def parse_amount(value: str | float | int | None) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value)).quantize(Decimal("0.01"))
    text = str(value).strip()
    if not text or text in {"-", "--", "NA", "N/A"}:
        return None

    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative, text = True, text[1:-1]
    upper = text.upper()
    if upper.endswith("DR"):
        negative, text = True, text[:-2]
    elif upper.endswith("CR"):
        text = text[:-2]
    text = _AMOUNT_JUNK.sub("", text)
    if text.startswith("-"):
        negative, text = True, text[1:]

    try:
        amount = Decimal(text).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None
    return -amount if negative else amount


_DATE_FORMATS = (
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%Y-%m-%d",
    "%d/%m/%y",
    "%d-%m-%y",
    "%d-%b-%Y",
    "%d %b %Y",
    "%d-%b-%y",
    "%d %B %Y",
    "%Y/%m/%d",
)


def parse_date(value: str | None) -> date | None:
    """Day-first. ``05/09/2026`` is 5 September."""
    if not value:
        return None
    text = str(value).strip()
    # openpyxl hands back "2026-09-05 00:00:00" for datetime cells.
    text = text.split(" 00:00:00")[0].split("T")[0]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None
