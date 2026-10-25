"""Financial-period arithmetic.

Worth testing properly: the Indian financial year starts in April, so every one
of these functions has an off-by-one-year failure mode that would file a return
against the wrong year and show up as a penalty, not an exception.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.utils.periods import (
    assessment_year_for,
    due_date_for,
    financial_year_bounds,
    financial_year_of,
    month_bounds,
    month_period_label,
    next_month_period,
    parse_month_period,
    previous_month_period,
    quarter_months,
    quarter_of_month,
    recent_month_periods,
    to_quarter_period,
)


class TestFinancialYear:
    @pytest.mark.parametrize(
        ("day", "expected"),
        [
            (date(2026, 4, 1), "2026-27"),   # first day of the FY
            (date(2026, 12, 31), "2026-27"),
            (date(2027, 3, 31), "2026-27"),  # last day of the same FY
            (date(2027, 4, 1), "2027-28"),   # rolls over
            (date(2026, 1, 15), "2025-26"),  # January belongs to the previous FY
            (date(2026, 3, 31), "2025-26"),
        ],
    )
    def test_boundaries(self, day: date, expected: str) -> None:
        assert financial_year_of(day) == expected

    def test_century_rollover(self) -> None:
        # 2099-00, not 2099-100.
        assert financial_year_of(date(2099, 6, 1)) == "2099-00"

    def test_bounds(self) -> None:
        start, end = financial_year_bounds("2026-27")
        assert start == date(2026, 4, 1)
        assert end == date(2027, 3, 31)

    def test_assessment_year_is_one_ahead(self) -> None:
        assert assessment_year_for("2025-26") == "2026-27"

    def test_rejects_bad_format(self) -> None:
        with pytest.raises(ValueError, match="financial year"):
            assessment_year_for("2025-2026")


class TestQuarters:
    @pytest.mark.parametrize(
        ("month", "quarter"),
        [
            (4, 1), (5, 1), (6, 1),      # Q1 is April-June
            (7, 2), (8, 2), (9, 2),
            (10, 3), (11, 3), (12, 3),
            (1, 4), (2, 4), (3, 4),      # Jan-Mar is Q4, not Q1
        ],
    )
    def test_quarter_of_month(self, month: int, quarter: int) -> None:
        assert quarter_of_month(month) == quarter

    def test_rejects_out_of_range(self) -> None:
        with pytest.raises(ValueError, match="out of range"):
            quarter_of_month(13)

    def test_january_quarter_belongs_to_previous_fy(self) -> None:
        # January 2027 is Q4 of FY 2026-27.
        assert to_quarter_period("2027-01") == "2026-Q4"
        assert to_quarter_period("2026-10") == "2026-Q3"

    def test_quarter_months_roundtrip(self) -> None:
        assert quarter_months("2026-Q1") == ["2026-04", "2026-05", "2026-06"]
        # Q4 crosses the calendar year.
        assert quarter_months("2026-Q4") == ["2027-01", "2027-02", "2027-03"]

    def test_every_month_maps_back_to_its_own_quarter(self) -> None:
        for month in range(1, 13):
            period = f"2026-{month:02d}"
            assert period in quarter_months(to_quarter_period(period))


class TestDueDates:
    def test_gstr3b_next_month(self) -> None:
        # GSTR-3B for October 2026 is due 20 November 2026.
        assert due_date_for("2026-10", 20) == date(2026, 11, 20)

    def test_december_rolls_into_next_year(self) -> None:
        assert due_date_for("2026-12", 20) == date(2027, 1, 20)

    def test_clamps_to_short_month(self) -> None:
        # "the 30th" of February must not raise.
        assert due_date_for("2027-01", 30) == date(2027, 2, 28)
        assert due_date_for("2024-01", 30) == date(2024, 2, 29)  # leap year

    def test_zero_offset_is_same_month(self) -> None:
        assert due_date_for("2026-10", 15, month_offset=0) == date(2026, 10, 15)

    def test_annual_offset(self) -> None:
        assert due_date_for("2026-03", 31, month_offset=9) == date(2026, 12, 31)


class TestMonthPeriods:
    def test_parse(self) -> None:
        assert parse_month_period("2026-10") == (2026, 10)

    @pytest.mark.parametrize("bad", ["2026-13", "2026-00", "26-10", "2026-1", "", "x"])
    def test_rejects_invalid(self, bad: str) -> None:
        with pytest.raises(ValueError, match="YYYY-MM"):
            parse_month_period(bad)

    def test_bounds_handles_month_lengths(self) -> None:
        assert month_bounds("2026-02") == (date(2026, 2, 1), date(2026, 2, 28))
        assert month_bounds("2024-02") == (date(2024, 2, 1), date(2024, 2, 29))
        assert month_bounds("2026-12") == (date(2026, 12, 1), date(2026, 12, 31))

    def test_neighbours_cross_year(self) -> None:
        assert previous_month_period("2026-01") == "2025-12"
        assert next_month_period("2026-12") == "2027-01"

    def test_recent_is_oldest_first(self) -> None:
        assert recent_month_periods("2026-03", 4) == [
            "2025-12", "2026-01", "2026-02", "2026-03",
        ]

    def test_recent_rejects_zero(self) -> None:
        with pytest.raises(ValueError, match="at least 1"):
            recent_month_periods("2026-03", 0)

    def test_label(self) -> None:
        assert month_period_label("2026-10") == "Oct 2026"
