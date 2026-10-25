"""Payroll statutory arithmetic.

Each expected figure here is worked by hand from the statute, not copied from
the code's output - a test that asserts whatever the code returns proves
nothing.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.payroll import (
    EmployeeInput,
    annual_tax_new_regime,
    compute_payslip,
    professional_tax,
)

D = Decimal


def slip(basic, hra=0, allowances=0, *, state="Maharashtra", gender="male", period="2026-09", paid_days=None):
    return compute_payslip(
        EmployeeInput(
            employee_code="E1", employee_name="Test", basic=D(basic), hra=D(hra), allowances=D(allowances),
            state=state, gender=gender, paid_days=None if paid_days is None else D(paid_days),
        ),
        period=period,
    )


class TestProvidentFund:
    def test_capped_at_the_wage_ceiling(self) -> None:
        # 12% of min(42,000, 15,000) = 1,800, whatever the basic.
        assert slip(42000).pf_employee == D("1800")
        assert slip(42000).pf_employer == D("1800")

    def test_below_the_ceiling_is_twelve_percent(self) -> None:
        assert slip(9000).pf_employee == D("1080")


class TestEsi:
    def test_covered_at_exactly_the_ceiling(self) -> None:
        # 21,000 is inside the limit. 0.75% = 157.50, rounded *up* to 158.
        result = slip(21000)
        assert result.esi_employee == D("158")
        assert result.esi_employer == D("683")  # 3.25% = 682.50 -> 683

    def test_not_covered_one_rupee_over(self) -> None:
        assert slip(21001).esi_employee == D("0")

    def test_coverage_follows_the_monthly_rate_not_earned_pay(self) -> None:
        """A 24,000/month employee paid for 20 days earns 16,000 but is still
        outside ESI: coverage is decided by the wage rate."""
        assert slip(24000, paid_days=20).esi_employee == D("0")


class TestProfessionalTax:
    @pytest.mark.parametrize(
        ("gross", "expected"),
        [(7500, 0), (7501, 175), (10000, 175), (10001, 200), (78000, 200)],
    )
    def test_maharashtra_men(self, gross: int, expected: int) -> None:
        assert professional_tax(D(gross), "Maharashtra", gender="male", month=9)[0] == D(expected)

    def test_maharashtra_february_collects_three_hundred(self) -> None:
        assert professional_tax(D(50000), "MH", gender="male", month=2)[0] == D("300")

    def test_maharashtra_women_exempt_to_twenty_five_thousand(self) -> None:
        assert professional_tax(D(25000), "Maharashtra", gender="female", month=9)[0] == D("0")
        assert professional_tax(D(25001), "Maharashtra", gender="female", month=9)[0] == D("200")

    def test_karnataka_threshold(self) -> None:
        assert professional_tax(D(24999), "Karnataka", gender="male", month=9)[0] == D("0")
        assert professional_tax(D(25000), "Karnataka", gender="male", month=9)[0] == D("200")

    def test_states_without_pt(self) -> None:
        amount, note = professional_tax(D(90000), "Uttar Pradesh", gender="male", month=9)
        assert amount == D("0") and note is None

    def test_unconfigured_state_says_so(self) -> None:
        amount, note = professional_tax(D(90000), "Tamil Nadu", gender="male", month=9)
        assert amount == D("0") and "not configured" in note


class TestTdsNewRegime:
    def test_rebate_wipes_tax_up_to_twelve_lakh(self) -> None:
        # 12,75,000 gross - 75,000 standard deduction = 12,00,000 taxable.
        assert annual_tax_new_regime(D("1275000")) == D("0")

    def test_marginal_relief_just_above_the_limit(self) -> None:
        # Taxable 12,10,000: slab tax 61,500, capped at the 10,000 over the
        # limit; plus 4% cess = 10,400.
        assert annual_tax_new_regime(D("1285000")) == D("10400")

    def test_slab_arithmetic(self) -> None:
        # Taxable 17,25,000: 20,000 + 40,000 + 60,000 + 25,000 = 1,45,000;
        # with cess 1,50,800.
        assert annual_tax_new_regime(D("1800000")) == D("150800")

    def test_monthly_tds_is_one_twelfth(self) -> None:
        assert slip(150000).tds == (annual_tax_new_regime(D("1800000")) / 12).quantize(D("1"))


class TestProRating:
    def test_components_scale_by_paid_days(self) -> None:
        result = slip(30000, 6000, period="2026-09", paid_days=15)
        assert result.basic == D("15000")
        assert result.gross == D("18000")
        assert any("Pro-rated" in n for n in result.notes)

    def test_net_is_gross_less_every_deduction(self) -> None:
        r = slip(42000, 18000, 18000)
        assert r.net == r.gross - r.pf_employee - r.esi_employee - r.professional_tax - r.tds

    def test_paid_days_beyond_the_month_rejected(self) -> None:
        with pytest.raises(ValueError):
            slip(10000, period="2026-09", paid_days=31)
