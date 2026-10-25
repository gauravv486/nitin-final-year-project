"""Standard chart of accounts for an Indian SME, and the classifier's labels.

Two separate things live here and the distinction matters:

``STANDARD_CHART``
    The full chart seeded into every new firm - 57 accounts. A firm's books
    need all of them.

``CLASSIFIABLE_CODES``
    The subset a bank narration can actually predict. Roughly half. "Share
    Capital" and "Reserves & Surplus" are real accounts, but nothing in the
    text of a bank line distinguishes a capital infusion from any other large
    credit, so asking a model to guess them produces confident nonsense.

Everything outside ``CLASSIFIABLE_CODES`` routes to a human. That is not a gap
in the model - it is the model declining to guess, which is the behaviour you
want in an accounting system.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.enums import LedgerGroup


@dataclass(frozen=True, slots=True)
class LedgerSpec:
    code: str
    name: str
    group: LedgerGroup
    #: Whether a bank narration carries enough signal to predict this account.
    classifiable: bool = True


# Codes follow the convention most Indian accounting packages use:
#   1xxx assets · 2xxx liabilities · 3xxx equity · 4xxx income · 5xxx-6xxx
#   expenses · 9999 suspense
STANDARD_CHART: tuple[LedgerSpec, ...] = (
    # ----------------------------------------------------------- assets ---
    LedgerSpec("1000", "Cash in Hand", LedgerGroup.ASSET),
    LedgerSpec("1010", "Bank Current Account", LedgerGroup.ASSET, classifiable=False),
    LedgerSpec("1020", "Bank Savings Account", LedgerGroup.ASSET, classifiable=False),
    LedgerSpec("1100", "Sundry Debtors", LedgerGroup.ASSET),
    LedgerSpec("1200", "Input GST Credit", LedgerGroup.ASSET),
    LedgerSpec("1300", "TDS Receivable", LedgerGroup.ASSET),
    LedgerSpec("1400", "Advance to Suppliers", LedgerGroup.ASSET, classifiable=False),
    LedgerSpec("1500", "Plant & Machinery", LedgerGroup.ASSET),
    LedgerSpec("1510", "Computers & Peripherals", LedgerGroup.ASSET),
    LedgerSpec("1520", "Furniture & Fixtures", LedgerGroup.ASSET),
    LedgerSpec("1600", "Security Deposits", LedgerGroup.ASSET),
    # ------------------------------------------------------ liabilities ---
    LedgerSpec("2000", "Sundry Creditors", LedgerGroup.LIABILITY),
    LedgerSpec("2100", "Output GST Payable", LedgerGroup.LIABILITY),
    LedgerSpec("2200", "TDS Payable", LedgerGroup.LIABILITY),
    LedgerSpec("2300", "Salary Payable", LedgerGroup.LIABILITY, classifiable=False),
    LedgerSpec("2310", "PF Payable", LedgerGroup.LIABILITY),
    LedgerSpec("2320", "ESI Payable", LedgerGroup.LIABILITY),
    LedgerSpec("2330", "Professional Tax Payable", LedgerGroup.LIABILITY),
    LedgerSpec("2400", "Term Loan", LedgerGroup.LIABILITY),
    LedgerSpec("2410", "Working Capital Loan", LedgerGroup.LIABILITY, classifiable=False),
    LedgerSpec("2500", "Advance from Customers", LedgerGroup.LIABILITY, classifiable=False),
    # ----------------------------------------------------------- equity ---
    # None of these are predictable from narration text: a ₹10 lakh credit
    # reading "NEFT CR-ICIC0001-R SHARMA" is equally plausibly capital, a loan
    # or a customer receipt. Only a human knows which.
    LedgerSpec("3000", "Share Capital", LedgerGroup.EQUITY, classifiable=False),
    LedgerSpec("3100", "Partners' Capital", LedgerGroup.EQUITY, classifiable=False),
    LedgerSpec("3200", "Drawings", LedgerGroup.EQUITY, classifiable=False),
    LedgerSpec("3300", "Reserves & Surplus", LedgerGroup.EQUITY, classifiable=False),
    # ----------------------------------------------------------- income ---
    LedgerSpec("4000", "Sales - Goods", LedgerGroup.INCOME, classifiable=False),
    LedgerSpec("4010", "Sales - Services", LedgerGroup.INCOME, classifiable=False),
    LedgerSpec("4100", "Interest Income", LedgerGroup.INCOME),
    LedgerSpec("4200", "Dividend Income", LedgerGroup.INCOME),
    LedgerSpec("4300", "Rental Income", LedgerGroup.INCOME),
    LedgerSpec("4400", "Other Income", LedgerGroup.INCOME, classifiable=False),
    LedgerSpec("4500", "Discount Received", LedgerGroup.INCOME, classifiable=False),
    # --------------------------------------------------------- expenses ---
    LedgerSpec("5000", "Purchases", LedgerGroup.EXPENSE, classifiable=False),
    LedgerSpec("5100", "Salaries & Wages", LedgerGroup.EXPENSE),
    LedgerSpec("5110", "Staff Welfare", LedgerGroup.EXPENSE, classifiable=False),
    LedgerSpec("5120", "Director Remuneration", LedgerGroup.EXPENSE, classifiable=False),
    LedgerSpec("5200", "Rent", LedgerGroup.EXPENSE),
    LedgerSpec("5210", "Electricity Charges", LedgerGroup.EXPENSE),
    LedgerSpec("5220", "Water Charges", LedgerGroup.EXPENSE),
    LedgerSpec("5230", "Telephone & Internet", LedgerGroup.EXPENSE),
    LedgerSpec("5300", "Printing & Stationery", LedgerGroup.EXPENSE),
    LedgerSpec("5310", "Office Supplies", LedgerGroup.EXPENSE),
    LedgerSpec("5320", "Postage & Courier", LedgerGroup.EXPENSE),
    LedgerSpec("5400", "Travelling Expenses", LedgerGroup.EXPENSE),
    LedgerSpec("5410", "Conveyance", LedgerGroup.EXPENSE),
    LedgerSpec("5420", "Vehicle Fuel", LedgerGroup.EXPENSE),
    LedgerSpec("5430", "Vehicle Maintenance", LedgerGroup.EXPENSE),
    LedgerSpec("5500", "Professional Fees", LedgerGroup.EXPENSE),
    LedgerSpec("5510", "Audit Fees", LedgerGroup.EXPENSE, classifiable=False),
    LedgerSpec("5520", "Legal Expenses", LedgerGroup.EXPENSE),
    LedgerSpec("5600", "Repairs & Maintenance", LedgerGroup.EXPENSE),
    LedgerSpec("5700", "Insurance Premium", LedgerGroup.EXPENSE),
    LedgerSpec("5800", "Bank Charges", LedgerGroup.EXPENSE),
    LedgerSpec("5810", "Interest on Loan", LedgerGroup.EXPENSE),
    LedgerSpec("5900", "Advertisement & Marketing", LedgerGroup.EXPENSE),
    LedgerSpec("5920", "Subscription & Software", LedgerGroup.EXPENSE),
    LedgerSpec("6000", "Freight & Transport", LedgerGroup.EXPENSE),
    LedgerSpec("6100", "Meals & Entertainment", LedgerGroup.EXPENSE),
    LedgerSpec("6200", "Commission & Brokerage", LedgerGroup.EXPENSE, classifiable=False),
    LedgerSpec("6300", "Rates & Taxes", LedgerGroup.EXPENSE),
    LedgerSpec("6400", "Miscellaneous Expenses", LedgerGroup.EXPENSE, classifiable=False),
    # ---------------------------------------------------------- suspense ---
    #: Where an unclassifiable line parks until a person decides. Never a
    #: prediction target - predicting "suspense" would just hide the problem.
    LedgerSpec("9999", "Suspense Account", LedgerGroup.ASSET, classifiable=False),
)

BY_CODE: dict[str, LedgerSpec] = {spec.code: spec for spec in STANDARD_CHART}

#: The label space the classifier is trained on.
CLASSIFIABLE_CODES: tuple[str, ...] = tuple(
    spec.code for spec in STANDARD_CHART if spec.classifiable
)

SUSPENSE_CODE = "9999"


def name_for(code: str) -> str:
    spec = BY_CODE.get(code)
    return spec.name if spec else code


def group_for(code: str) -> LedgerGroup | None:
    spec = BY_CODE.get(code)
    return spec.group if spec else None


def is_classifiable(code: str) -> bool:
    spec = BY_CODE.get(code)
    return bool(spec and spec.classifiable)


def expected_direction(code: str) -> str | None:
    """The direction a posting to this account normally takes.

    Used as a sanity filter on predictions, not as a hard rule: a refund
    genuinely does credit an expense account. But a DEBIT predicted as
    "Interest Income" is almost certainly wrong, and catching that is free.

    Returns ``"DEBIT"``, ``"CREDIT"`` or ``None`` when either is ordinary.
    """
    group = group_for(code)
    if group is LedgerGroup.EXPENSE:
        return "DEBIT"
    if group is LedgerGroup.INCOME:
        return "CREDIT"
    return None
