"""Indian financial-period arithmetic.

The financial year runs 1 April to 31 March, so almost every date question in
this product has a different answer from the calendar one. Getting it wrong
files a return against the wrong year, which is why this lives in one module
with its own tests rather than being re-derived in each feature.

Vocabulary used throughout:

``period``
    A month, ``YYYY-MM``. The unit GST returns and payroll runs use.
``quarter``
    ``YYYY-Qn`` where Q1 is April-June, **not** January-March.
``financial year`` / FY
    ``YYYY-YY``, e.g. ``2026-27`` for 1 Apr 2026 - 31 Mar 2027.
``assessment year`` / AY
    The year income is assessed in: FY 2025-26 is assessed in AY 2026-27.
"""

from __future__ import annotations

import calendar
import re
from datetime import date

MONTH_PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
QUARTER_PERIOD_RE = re.compile(r"^\d{4}-Q[1-4]$")
FY_RE = re.compile(r"^\d{4}-\d{2}$")

MONTH_ABBR = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)

#: Month the financial year starts in.
FY_START_MONTH = 4


def is_month_period(value: str) -> bool:
    return MONTH_PERIOD_RE.match(value) is not None


def parse_month_period(period: str) -> tuple[int, int]:
    """``"2026-10"`` -> ``(2026, 10)``."""
    if not is_month_period(period):
        raise ValueError(f"Not a YYYY-MM period: {period!r}")
    year, month = period.split("-")
    return int(year), int(month)


def to_month_period(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def month_bounds(period: str) -> tuple[date, date]:
    """Inclusive first and last day of a ``YYYY-MM`` period."""
    year, month = parse_month_period(period)
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def month_period_label(period: str) -> str:
    """``"2026-10"`` -> ``"Oct 2026"`` - the form the UI shows."""
    year, month = parse_month_period(period)
    return f"{MONTH_ABBR[month - 1]} {year}"


def financial_year_of(value: date) -> str:
    """FY label for a date. April 2026 - March 2027 is ``"2026-27"``."""
    start_year = value.year if value.month >= FY_START_MONTH else value.year - 1
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def financial_year_bounds(financial_year: str) -> tuple[date, date]:
    if not FY_RE.match(financial_year):
        raise ValueError(f"Not a YYYY-YY financial year: {financial_year!r}")
    start_year = int(financial_year[:4])
    return date(start_year, FY_START_MONTH, 1), date(start_year + 1, FY_START_MONTH - 1, 31)


def assessment_year_for(financial_year: str) -> str:
    """Income earned in FY 2025-26 is assessed in AY 2026-27."""
    if not FY_RE.match(financial_year):
        raise ValueError(f"Not a YYYY-YY financial year: {financial_year!r}")
    start_year = int(financial_year[:4]) + 1
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def quarter_of_month(month: int) -> int:
    """Financial quarter for a calendar month. Q1 is April-June."""
    if not 1 <= month <= 12:
        raise ValueError(f"Month out of range: {month}")
    return ((month - FY_START_MONTH) % 12) // 3 + 1


def to_quarter_period(period: str) -> str:
    """``"2026-10"`` -> ``"2026-Q3"``: October is in the third financial quarter."""
    year, month = parse_month_period(period)
    # Jan-Mar belong to the FY that began in the previous calendar year.
    fy_start = year if month >= FY_START_MONTH else year - 1
    return f"{fy_start}-Q{quarter_of_month(month)}"


def quarter_months(quarter_period: str) -> list[str]:
    """The three ``YYYY-MM`` periods inside a ``YYYY-Qn``."""
    if not QUARTER_PERIOD_RE.match(quarter_period):
        raise ValueError(f"Not a YYYY-Qn quarter: {quarter_period!r}")
    fy_start = int(quarter_period[:4])
    quarter = int(quarter_period[-1])
    out: list[str] = []
    for offset in range(3):
        month_index = FY_START_MONTH + (quarter - 1) * 3 + offset
        year = fy_start + (month_index - 1) // 12
        month = (month_index - 1) % 12 + 1
        out.append(f"{year:04d}-{month:02d}")
    return out


def due_date_for(period: str, day_of_month: int, month_offset: int = 1) -> date:
    """Statutory due date: ``day_of_month`` of the month ``month_offset`` later.

    GSTR-3B for October 2026 is ``due_date_for("2026-10", 20)`` = 20 Nov 2026.

    A ``day_of_month`` past the end of the target month is clamped to the last
    day, so "the 30th" does not throw in February.
    """
    year, month = parse_month_period(period)
    absolute = (year * 12 + month - 1) + month_offset
    target_year, target_month = divmod(absolute, 12)
    target_month += 1
    last_day = calendar.monthrange(target_year, target_month)[1]
    return date(target_year, target_month, min(day_of_month, last_day))


def previous_month_period(period: str) -> str:
    year, month = parse_month_period(period)
    return f"{year - 1}-12" if month == 1 else f"{year:04d}-{month - 1:02d}"


def next_month_period(period: str) -> str:
    year, month = parse_month_period(period)
    return f"{year + 1}-01" if month == 12 else f"{year:04d}-{month + 1:02d}"


def recent_month_periods(period: str, count: int) -> list[str]:
    """The last ``count`` periods ending at ``period``, oldest first."""
    if count < 1:
        raise ValueError("count must be at least 1")
    out: list[str] = []
    cursor = period
    for _ in range(count):
        out.append(cursor)
        cursor = previous_month_period(cursor)
    return list(reversed(out))


def days_until(target: date, today: date | None = None) -> int:
    """Whole days from today to ``target``; negative once it has passed."""
    return (target - (today or date.today())).days
