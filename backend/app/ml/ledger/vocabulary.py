"""Counterparty vocabulary per ledger account.

This is the domain knowledge the synthetic dataset is built from: who actually
appears in an Indian SME's bank statement, and which ledger they belong to.

Two properties of this file are deliberate and matter for honest evaluation:

**Overlap is kept, not removed.** ``AMAZON`` appears under Office Supplies,
Computers *and* Meals, because in real books it genuinely does. A generator
with one merchant per class produces a linearly separable dataset and a model
that reports 99% accuracy it will never see again. The overlap is what makes
the measured number mean something.

**Ambiguity is weighted.** ``_AMBIGUOUS`` records how often a shared merchant
belongs to each candidate class, so the Bayes-optimal error on those rows is
non-zero by construction. A model scoring above that on them is memorising.
"""

from __future__ import annotations

#: ledger code -> counterparties that plausibly appear for it.
#:
#: Names are real Indian businesses, utilities and government bodies, because
#: the tokenisation behaviour on "MAHAVITARAN" or "BWSSB" is different from
#: anything a placeholder like "Vendor 1" would exercise.
COUNTERPARTIES: dict[str, tuple[str, ...]] = {
    # ------------------------------------------------------- utilities ----
    "5210": (  # Electricity Charges
        "MSEB", "MAHAVITARAN", "ADANI ELECTRICITY", "TATA POWER", "BSES RAJDHANI",
        "BESCOM", "TNEB", "TORRENT POWER", "PSPCL", "APSPDCL", "UPPCL",
        "CESC LIMITED", "JVVNL", "MSEDCL", "KSEB",
    ),
    "5220": (  # Water Charges
        "BMC WATER", "BWSSB", "DELHI JAL BOARD", "CHENNAI METRO WATER",
        "HMWSSB", "PUNE MUNICIPAL WATER", "GWSSB",
    ),
    "5230": (  # Telephone & Internet
        "BHARTI AIRTEL", "AIRTEL", "RELIANCE JIO INFOCOMM", "JIO FIBER",
        "VODAFONE IDEA", "VI POSTPAID", "BSNL", "ACT FIBERNET", "HATHWAY",
        "EXCITEL BROADBAND", "TATA PLAY FIBER", "SPECTRANET",
    ),
    # ------------------------------------------------------ office spend ---
    "5300": (  # Printing & Stationery
        "VENUS TRADERS", "SHREE PRINTERS", "NAVNEET PUBLICATIONS",
        "CLASSMATE STATIONERY", "SRI SAI PRINTERS", "MODERN PRINTING PRESS",
        "CAMLIN STATIONERY", "JK PAPER",
    ),
    "5310": (  # Office Supplies
        "AMAZON", "AMAZON RETAIL", "FLIPKART", "JIOMART", "OFFICEYES",
        "BIGBASKET", "MOGLIX", "INDUSTRYBUYING", "UDAAN",
    ),
    "5320": (  # Postage & Courier
        "BLUEDART EXPRESS", "DTDC COURIER", "DELHIVERY", "PROFESSIONAL COURIER",
        "INDIA POST", "FEDEX", "GATI KWE", "XPRESSBEES", "EKART LOGISTICS",
    ),
    # ----------------------------------------------------------- travel ----
    "5400": (  # Travelling Expenses
        "MAKEMYTRIP", "IRCTC", "INTERGLOBE AVIATION", "INDIGO", "AIR INDIA",
        "SPICEJET", "AKASA AIR", "VISTARA", "YATRA ONLINE", "CLEARTRIP",
        "GOIBIBO", "EASEMYTRIP", "OYO ROOMS", "TREEBO HOTELS", "IBIBO",
    ),
    "5410": (  # Conveyance
        "OLA CABS", "ANI TECHNOLOGIES", "UBER INDIA", "RAPIDO", "MERU CABS",
        "NAMMA YATRI", "BMTC", "BEST UNDERTAKING", "DMRC",
    ),
    "5420": (  # Vehicle Fuel
        "INDIAN OIL", "IOCL PETROL PUMP", "HP PETROL PUMP", "BHARAT PETROLEUM",
        "RELIANCE PETRO", "SHELL INDIA", "NAYARA ENERGY", "HINDUSTAN PETROLEUM",
    ),
    "5430": (  # Vehicle Maintenance
        "MARUTI SERVICE", "TVS AUTOMOBILES", "BOSCH CAR SERVICE",
        "HYUNDAI SERVICE", "MAHINDRA FIRST CHOICE", "TATA MOTORS SERVICE",
        "APOLLO TYRES", "MRF TYRES",
    ),
    # ----------------------------------------------------- professional ---
    "5500": (  # Professional Fees
        "SHARMA AND ASSOCIATES", "IYER CONSULTANCY", "KPMG INDIA",
        "DELOITTE TOUCHE", "GRANT THORNTON", "NANGIA ANDERSEN",
        "MEHTA AND COMPANY", "DESAI CONSULTANTS", "PWC INDIA",
    ),
    "5520": (  # Legal Expenses
        "ADVOCATE R MENON", "LEGASIS SERVICES", "KHAITAN AND CO",
        "TRILEGAL", "CYRIL AMARCHAND", "ADVOCATE S NAIR", "COURT FEE",
    ),
    "5600": (  # Repairs & Maintenance
        "URBAN COMPANY", "SHREE ELECTRICALS", "AMC SERVICES",
        "BLUE STAR SERVICE", "VOLTAS AMC", "JOHNSON CONTROLS",
        "SRI VENKATESHWARA PLUMBING",
    ),
    "5700": (  # Insurance Premium
        "LIC OF INDIA", "LICI", "HDFC LIFE INSURANCE", "ICICI PRULIFE",
        "SBI LIFE INSURANCE", "BAJAJ ALLIANZ", "TATA AIG GENERAL",
        "NEW INDIA ASSURANCE", "STAR HEALTH", "NIVA BUPA",
        "ORIENTAL INSURANCE", "UNITED INDIA INSURANCE",
    ),
    # --------------------------------------------------- bank and credit ---
    "5800": (  # Bank Charges
        "SMS ALERT CHG", "AMB CHARGES", "FOLIO CHARGES", "NEFT CHARGES",
        "IMPS CHARGES", "CHQ RETURN CHARGES", "ATM DECLINE CHARGES",
        "GST ON BANK CHARGES", "ANNUAL MAINTENANCE CHG", "DD CHARGES",
        "STOP PAYMENT CHARGES", "CASH HANDLING CHARGES",
    ),
    "5810": (  # Interest on Loan
        "TERM LOAN INTEREST", "INT ON TERM LOAN", "LOAN EMI INTEREST",
        "OD INTEREST", "CC INTEREST", "VEHICLE LOAN INTEREST",
    ),
    # ----------------------------------------------------- growth spend ---
    "5900": (  # Advertisement & Marketing
        "GOOGLE ADS", "GOOGLE IRELAND", "META PLATFORMS", "FACEBOOK ADS",
        "LINKEDIN SINGAPORE", "JUSTDIAL", "INDIAMART", "TABOOLA",
        "AMAZON ADVERTISING",
    ),
    "5920": (  # Subscription & Software
        "MICROSOFT", "GOOGLE WORKSPACE", "ADOBE SYSTEMS", "ZOHO CORPORATION",
        "TALLY SOLUTIONS", "AMAZON WEB SERVICES", "AWS INDIA", "MICROSOFT AZURE",
        "GITHUB", "SLACK TECHNOLOGIES", "ZOOM VIDEO", "CANVA", "NOTION LABS",
        "DIGITALOCEAN", "ATLASSIAN", "FRESHWORKS",
    ),
    # -------------------------------------------------------- logistics ---
    "6000": (  # Freight & Transport
        "VRL LOGISTICS", "TCI FREIGHT", "SAFEXPRESS", "RIVIGO SERVICES",
        "GATI LIMITED", "MAHINDRA LOGISTICS", "ALLCARGO", "CONCOR",
        "SRI BALAJI TRANSPORT",
    ),
    "6100": (  # Meals & Entertainment
        "SWIGGY", "BUNDL TECHNOLOGIES", "ZOMATO", "DOMINOS PIZZA",
        "MCDONALDS", "STARBUCKS", "CAFE COFFEE DAY", "BARBEQUE NATION",
        "HALDIRAMS", "SARAVANA BHAVAN", "FAASOS", "EATFIT", "BLUE TOKAI",
    ),
    "6300": (  # Rates & Taxes
        "MUNICIPAL CORPORATION", "PROPERTY TAX", "BMC PROPERTY TAX",
        "GHMC TAX", "TRADE LICENCE FEE", "SHOP ESTABLISHMENT FEE",
    ),
    # ----------------------------------------------------- statutory ------
    "2200": ("TDS PAYMENT", "ITNS 281", "TDS 24Q", "TDS 26Q", "TDS 27Q", "TDS ON RENT"),
    "2310": ("EPFO", "EPF CONTRIBUTION", "PF ECR", "EMPLOYEE PROVIDENT FUND"),
    "2320": ("ESIC", "ESI CONTRIBUTION", "EMPLOYEES STATE INSURANCE"),
    "2330": ("PROFESSION TAX", "PTEC PAYMENT", "PTRC PAYMENT", "PT PAYMENT"),
    "2100": ("GST PAYMENT", "GSTR3B PAYMENT", "GST PMT 06", "CGST SGST PAYMENT"),
    "1200": ("GST INPUT CREDIT", "GST REFUND", "ITC CLAIM"),
    "1300": ("TDS REFUND", "INCOME TAX REFUND", "TDS CREDIT RECEIVED"),
    # ------------------------------------------------------- people -------
    "5100": (  # Salaries & Wages
        "SALARY", "STAFF SALARY", "SALARY DISBURSEMENT", "MONTHLY SALARY",
        "WAGES PAYMENT", "SAL CREDIT",
    ),
    "5200": (  # Rent
        "OFFICE RENT", "RENT PAYMENT", "GODOWN RENT", "SHOP RENT",
        "RAMESH PROPERTIES", "SHANTI ESTATES", "PRIME REALTY",
    ),
    # -------------------------------------------------- fixed assets ------
    "1510": (  # Computers & Peripherals
        "DELL INTERNATIONAL", "HP INDIA", "LENOVO INDIA", "APPLE INDIA",
        "ASUS INDIA", "ACER INDIA", "LOGITECH", "CROMA", "RELIANCE DIGITAL",
    ),
    "1520": (  # Furniture & Fixtures
        "GODREJ INTERIO", "PEPPERFRY", "URBAN LADDER", "NILKAMAL",
        "DURIAN FURNITURE", "FEATHERLITE",
    ),
    "1500": (  # Plant & Machinery
        "KIRLOSKAR BROTHERS", "CROMPTON GREAVES", "THERMAX", "INGERSOLL RAND",
        "ATLAS COPCO", "GRINDWELL NORTON",
    ),
    "1600": ("SECURITY DEPOSIT", "RENT DEPOSIT", "ELECTRICITY DEPOSIT"),
    # --------------------------------------------------------- income -----
    "4100": (  # Interest Income
        "CREDIT INTEREST", "FD INTEREST", "SAVINGS INTEREST",
        "INTEREST CAPITALISED", "RD INTEREST",
    ),
    "4200": (  # Dividend Income
        "DIVIDEND", "RELIANCE INDUSTRIES DIVIDEND", "TCS DIVIDEND",
        "HDFC BANK DIVIDEND", "ITC DIVIDEND", "INFOSYS DIVIDEND",
    ),
    "4300": ("RENT RECEIVED", "RENTAL INCOME", "LEASE RENT RECEIVED"),
    # --------------------------------------------------- trade parties ----
    "1100": (  # Sundry Debtors - customer receipts
        "ARORA TRADING", "MEHTA ENTERPRISES", "GUPTA TEXTILES",
        "KRISHNA LOGISTICS", "SHAH AND CO", "VERMA INDUSTRIES",
        "PATEL BROTHERS", "SINGH TRADERS", "REDDY AGENCIES",
    ),
    "2000": (  # Sundry Creditors - supplier payments
        "DEEPAK STEEL SUPPLIERS", "SUNRISE CHEMICALS", "VECTOR OFFICE SOLUTIONS",
        "MEHTA PACKAGING", "NATIONAL HARDWARE", "BOMBAY TRADING CO",
        "SRI RAM AGENCIES", "UNIVERSAL ENTERPRISES",
    ),
    "2400": ("TERM LOAN DISBURSEMENT", "LOAN REPAYMENT", "EMI DEBIT", "LOAN PRINCIPAL"),
    "1000": ("CASH DEPOSIT", "CASH WITHDRAWAL", "CASH RECD", "ATM CASH WDL"),
}


#: Merchants that legitimately belong to more than one ledger, with the share
#: of real-world occurrences that goes to each.
#:
#: Amazon is the clearest case: most of a firm's Amazon spend is consumables,
#: some is hardware that should be capitalised, and the odd one is a food
#: order. No model can resolve that from narration alone - the amount helps,
#: nothing else does - so these rows set the floor on achievable accuracy.
_AMBIGUOUS: dict[str, dict[str, float]] = {
    "AMAZON": {"5310": 0.65, "1510": 0.25, "6100": 0.10},
    "AMAZON RETAIL": {"5310": 0.70, "1510": 0.30},
    "FLIPKART": {"5310": 0.60, "1510": 0.40},
    "CROMA": {"1510": 0.75, "5310": 0.25},
    "RELIANCE DIGITAL": {"1510": 0.80, "5310": 0.20},
    "JIOMART": {"5310": 0.75, "6100": 0.25},
    "BIGBASKET": {"5310": 0.45, "6100": 0.55},
    # Delhivery does both small-parcel courier and bulk freight.
    "DELHIVERY": {"5320": 0.55, "6000": 0.45},
    "GATI KWE": {"5320": 0.50, "6000": 0.50},
    "GATI LIMITED": {"6000": 0.70, "5320": 0.30},
    # Jio bills both connectivity and, for some firms, fibre installation.
    "RELIANCE JIO INFOCOMM": {"5230": 0.90, "5920": 0.10},
    # A Google charge could be Ads or Workspace; the narration rarely says.
    "GOOGLE ADS": {"5900": 0.95, "5920": 0.05},
    "GOOGLE WORKSPACE": {"5920": 0.90, "5900": 0.10},
    "GOOGLE IRELAND": {"5900": 0.55, "5920": 0.45},
    # LIC sells both life cover (expense) and investment-linked products.
    "LIC OF INDIA": {"5700": 0.85, "1600": 0.15},
    "LICI": {"5700": 0.85, "1600": 0.15},
    # Fuel cards are sometimes booked straight to vehicle maintenance.
    "INDIAN OIL": {"5420": 0.90, "5430": 0.10},
    "URBAN COMPANY": {"5600": 0.70, "5110": 0.30},
}


def ambiguous_distribution(counterparty: str) -> dict[str, float] | None:
    """Class distribution for a shared merchant, or ``None`` if unambiguous."""
    return _AMBIGUOUS.get(counterparty.upper())


def all_counterparties() -> list[tuple[str, str]]:
    """Every ``(counterparty, ledger_code)`` pair, ambiguity resolved to the
    most likely class. Used for quick lookups and for the keyword fallback."""
    pairs: list[tuple[str, str]] = []
    for code, names in COUNTERPARTIES.items():
        for name in names:
            dist = ambiguous_distribution(name)
            if dist:
                best = max(dist.items(), key=lambda kv: kv[1])[0]
                pairs.append((name, best))
            else:
                pairs.append((name, code))
    return pairs


#: Typical amount band per ledger, in rupees: ``(low, high)``.
#:
#: Amount is a genuinely useful feature - a ₹250 debit is far more likely to be
#: conveyance than plant and machinery - and these bands are what the generator
#: samples from. Wide on purpose; a narrow band would let the model classify on
#: amount alone, which real data never permits.
AMOUNT_BANDS: dict[str, tuple[int, int]] = {
    "1000": (500, 200_000),
    "1100": (5_000, 2_000_000),
    "1200": (1_000, 500_000),
    "1300": (1_000, 300_000),
    "1500": (50_000, 5_000_000),
    "1510": (15_000, 400_000),
    "1520": (5_000, 250_000),
    "1600": (10_000, 500_000),
    "2000": (2_000, 1_500_000),
    "2100": (5_000, 800_000),
    "2200": (1_000, 300_000),
    "2310": (2_000, 150_000),
    "2320": (500, 40_000),
    "2330": (200, 5_000),
    "2400": (10_000, 3_000_000),
    "4100": (50, 60_000),
    "4200": (500, 150_000),
    "4300": (10_000, 400_000),
    "5100": (12_000, 900_000),
    "5200": (8_000, 500_000),
    "5210": (800, 120_000),
    "5220": (200, 25_000),
    "5230": (300, 40_000),
    "5300": (300, 40_000),
    "5310": (200, 60_000),
    "5320": (50, 15_000),
    "5400": (1_500, 250_000),
    "5410": (60, 6_000),
    "5420": (500, 25_000),
    "5430": (800, 80_000),
    "5500": (3_000, 500_000),
    "5520": (2_000, 300_000),
    "5600": (500, 150_000),
    "5700": (1_000, 300_000),
    "5800": (10, 3_000),
    "5810": (500, 200_000),
    "5900": (500, 400_000),
    "5920": (200, 150_000),
    "6000": (1_000, 400_000),
    "6100": (120, 25_000),
    "6300": (500, 120_000),
}

DEFAULT_AMOUNT_BAND = (500, 100_000)

#: Which direction each ledger's transactions normally take in a bank
#: statement. Used by the generator so it does not emit a credit labelled
#: "Vehicle Fuel".
DIRECTIONS: dict[str, str] = {
    "1100": "CREDIT",  # customer paid us
    "1300": "CREDIT",  # refund received
    "1200": "CREDIT",
    "2400": "CREDIT",  # loan disbursed into the account
    "4100": "CREDIT",
    "4200": "CREDIT",
    "4300": "CREDIT",
}
DEFAULT_DIRECTION = "DEBIT"
