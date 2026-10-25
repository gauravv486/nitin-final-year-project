"""Payroll statutory deductions - Module 9.

Rules, not a model: these are fixed by statute and notification, and the
correct implementation of a statute is a lookup table plus arithmetic.

Every figure a run used is written to ``PayrollRun.rate_snapshot``. Rates
change by notification; last year's payslip must keep showing last year's
arithmetic, and a snapshot is the only way to guarantee that.

Coverage, stated plainly:

* **PF** - 12% employee and 12% employer on basic, capped at the Rs 15,000
  statutory wage ceiling. Employer share split 8.33% EPS (capped at Rs 1,250)
  and the balance to EPF. Voluntary contribution above the ceiling is not
  modelled.
* **ESI** - 0.75% employee, 3.25% employer, only where monthly gross is at or
  below Rs 21,000. Rounded *up* to the next rupee, as ESIC computes it.
* **Professional tax** - slab tables for Maharashtra, Karnataka, Gujarat, West
  Bengal, Telangana and Andhra Pradesh. States that levy none return zero;
  any other state returns zero *with a note*, never a guess.
* **TDS on salary** - new regime, projected from the monthly rate: standard
  deduction Rs 75,000, the FY 2025-26 slabs, the s.87A rebate up to Rs 12 lakh
  with marginal relief, surcharge bands and 4% cess, spread evenly over twelve
  months. Old-regime declarations, perquisites and mid-year re-projection
  are out of scope. Update ``TDS_SLABS`` if the current year's slabs differ.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

from app.utils.periods import parse_month_period

D = Decimal
ZERO = D("0")


def _r(value: Decimal) -> Decimal:
    return value.quantize(D("1"), rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ rates ---

PF_WAGE_CEILING = D("15000")
PF_EMPLOYEE_RATE = D("0.12")
PF_EMPLOYER_RATE = D("0.12")
EPS_RATE = D("0.0833")
EPS_CAP = D("1250")

ESI_GROSS_CEILING = D("21000")
ESI_EMPLOYEE_RATE = D("0.0075")
ESI_EMPLOYER_RATE = D("0.0325")

STANDARD_DEDUCTION = D("75000")
#: (upper bound of the band, rate). FY 2025-26 new regime.
TDS_SLABS: list[tuple[Decimal | None, Decimal]] = [
    (D("400000"), D("0")),
    (D("800000"), D("0.05")),
    (D("1200000"), D("0.10")),
    (D("1600000"), D("0.15")),
    (D("2000000"), D("0.20")),
    (D("2400000"), D("0.25")),
    (None, D("0.30")),
]
REBATE_LIMIT = D("1200000")
CESS_RATE = D("0.04")
#: New regime surcharge, capped at 25%.
SURCHARGE: list[tuple[Decimal, Decimal]] = [
    (D("20000000"), D("0.25")),
    (D("10000000"), D("0.15")),
    (D("5000000"), D("0.10")),
]

#: Monthly PT slabs: list of (gross up to, amount); ``None`` = no upper bound.
#: ``feb`` overrides the top slab in February where the state collects the
#: annual balance then.
PT_TABLES: dict[str, dict] = {
    "MAHARASHTRA": {
        "male": [(D("7500"), D("0")), (D("10000"), D("175")), (None, D("200"))],
        "female": [(D("25000"), D("0")), (None, D("200"))],
        "feb_top": D("300"),
    },
    "KARNATAKA": {"male": [(D("24999"), D("0")), (None, D("200"))]},
    "GUJARAT": {"male": [(D("11999"), D("0")), (None, D("200"))]},
    "WEST BENGAL": {
        "male": [
            (D("10000"), D("0")),
            (D("15000"), D("110")),
            (D("25000"), D("130")),
            (D("40000"), D("150")),
            (None, D("200")),
        ]
    },
    "TELANGANA": {"male": [(D("15000"), D("0")), (D("20000"), D("150")), (None, D("200"))]},
    "ANDHRA PRADESH": {"male": [(D("15000"), D("0")), (D("20000"), D("150")), (None, D("200"))]},
}
#: States and UTs that levy no professional tax on salaries.
NO_PT = {
    "DELHI", "UTTAR PRADESH", "HARYANA", "RAJASTHAN", "UTTARAKHAND", "HIMACHAL PRADESH",
    "JAMMU AND KASHMIR", "GOA", "CHANDIGARH", "ARUNACHAL PRADESH",
}

_STATE_ALIASES = {"MH": "MAHARASHTRA", "KA": "KARNATAKA", "GJ": "GUJARAT", "WB": "WEST BENGAL",
                  "TS": "TELANGANA", "TG": "TELANGANA", "AP": "ANDHRA PRADESH", "DL": "DELHI",
                  "UP": "UTTAR PRADESH", "HR": "HARYANA", "RJ": "RAJASTHAN"}


def rate_snapshot() -> dict:
    def s(x):
        return str(x) if x is not None else None

    return {
        "pf": {
            "wage_ceiling": s(PF_WAGE_CEILING),
            "employee_rate": s(PF_EMPLOYEE_RATE),
            "employer_rate": s(PF_EMPLOYER_RATE),
            "eps_rate": s(EPS_RATE),
            "eps_cap": s(EPS_CAP),
        },
        "esi": {
            "gross_ceiling": s(ESI_GROSS_CEILING),
            "employee_rate": s(ESI_EMPLOYEE_RATE),
            "employer_rate": s(ESI_EMPLOYER_RATE),
            "rounding": "up to the next rupee",
        },
        "tds": {
            "regime": "new",
            "slabs_basis": "FY 2025-26 new-regime slabs - confirm for the current year",
            "standard_deduction": s(STANDARD_DEDUCTION),
            "slabs": [[s(upper), s(rate)] for upper, rate in TDS_SLABS],
            "rebate_limit": s(REBATE_LIMIT),
            "cess": s(CESS_RATE),
            "method": "annual projection of the monthly rate, spread over 12 months",
        },
        "pt": {state: {k: [[s(a), s(b)] for a, b in v] if isinstance(v, list) else s(v)
                       for k, v in table.items()} for state, table in PT_TABLES.items()},
    }


# ------------------------------------------------------------ calculation ---


@dataclass(slots=True)
class EmployeeInput:
    employee_code: str
    employee_name: str
    basic: Decimal
    hra: Decimal = ZERO
    allowances: Decimal = ZERO
    paid_days: Decimal | None = None
    state: str | None = None
    gender: str = "male"
    pan: str | None = None
    uan: str | None = None
    other_deductions: Decimal = ZERO


@dataclass(slots=True)
class Payslip:
    employee_code: str
    employee_name: str
    pan: str | None
    uan: str | None
    state: str | None
    paid_days: Decimal
    basic: Decimal
    hra: Decimal
    allowances: Decimal
    gross: Decimal
    pf_employee: Decimal
    pf_employer: Decimal
    esi_employee: Decimal
    esi_employer: Decimal
    professional_tax: Decimal
    tds: Decimal
    other_deductions: Decimal
    net: Decimal
    notes: list[str] = field(default_factory=list)


def normalise_state(state: str | None) -> str | None:
    if not state:
        return None
    upper = state.strip().upper()
    return _STATE_ALIASES.get(upper, upper)


def professional_tax(gross: Decimal, state: str | None, *, gender: str, month: int) -> tuple[Decimal, str | None]:
    name = normalise_state(state)
    if name is None:
        return ZERO, "No state on record - professional tax not computed"
    if name in NO_PT:
        return ZERO, None
    table = PT_TABLES.get(name)
    if table is None:
        return ZERO, f"Professional tax for {name.title()} is not configured - computed as nil"

    slabs = table.get(gender.lower(), table["male"])
    for upper, amount in slabs:
        if upper is None or gross <= upper:
            if upper is None and month == 2 and "feb_top" in table:
                return table["feb_top"], None
            return amount, None
    return ZERO, None


def annual_tax_new_regime(annual_gross: Decimal) -> Decimal:
    taxable = max(ZERO, annual_gross - STANDARD_DEDUCTION)
    tax, lower = ZERO, ZERO
    for upper, rate in TDS_SLABS:
        top = taxable if upper is None else min(taxable, upper)
        if top > lower:
            tax += (top - lower) * rate
        if upper is None or taxable <= upper:
            break
        lower = upper

    # s.87A rebate up to the limit; above it, marginal relief - the tax may not
    # exceed the income over the limit, or a rupee over Rs 12 lakh would cost
    # Rs 60,000.
    tax = ZERO if taxable <= REBATE_LIMIT else min(tax, taxable - REBATE_LIMIT)

    for threshold, rate in SURCHARGE:
        if taxable > threshold:
            tax += tax * rate
            break
    return _r(tax * (1 + CESS_RATE))


def compute_payslip(employee: EmployeeInput, *, period: str) -> Payslip:
    year, month = parse_month_period(period)
    days_in_month = D(calendar.monthrange(year, month)[1])
    paid_days = employee.paid_days if employee.paid_days is not None else days_in_month
    if paid_days < 0 or paid_days > days_in_month:
        raise ValueError(f"{employee.employee_code}: paid days must be 0-{days_in_month}")
    factor = paid_days / days_in_month

    basic = _r(employee.basic * factor)
    hra = _r(employee.hra * factor)
    allowances = _r(employee.allowances * factor)
    gross = basic + hra + allowances
    monthly_rate_gross = employee.basic + employee.hra + employee.allowances
    notes: list[str] = []

    pf_wage = min(basic, PF_WAGE_CEILING)
    pf_employee = _r(pf_wage * PF_EMPLOYEE_RATE)
    pf_employer = _r(pf_wage * PF_EMPLOYER_RATE)

    if monthly_rate_gross <= ESI_GROSS_CEILING:
        esi_employee = (gross * ESI_EMPLOYEE_RATE).quantize(D("1"), rounding=ROUND_CEILING)
        esi_employer = (gross * ESI_EMPLOYER_RATE).quantize(D("1"), rounding=ROUND_CEILING)
    else:
        esi_employee = esi_employer = ZERO

    pt, pt_note = professional_tax(gross, employee.state, gender=employee.gender, month=month)
    if pt_note:
        notes.append(pt_note)

    tds = _r(annual_tax_new_regime(monthly_rate_gross * 12) / 12)
    if factor < 1:
        notes.append(f"Pro-rated for {paid_days} of {days_in_month} days")

    deductions = pf_employee + esi_employee + pt + tds + employee.other_deductions
    return Payslip(
        employee_code=employee.employee_code,
        employee_name=employee.employee_name,
        pan=employee.pan,
        uan=employee.uan,
        state=employee.state,
        paid_days=paid_days,
        basic=basic,
        hra=hra,
        allowances=allowances,
        gross=gross,
        pf_employee=pf_employee,
        pf_employer=pf_employer,
        esi_employee=esi_employee,
        esi_employer=esi_employer,
        professional_tax=pt,
        tds=tds,
        other_deductions=employee.other_deductions,
        net=gross - deductions,
        notes=notes,
    )
