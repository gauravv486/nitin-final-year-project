#!/usr/bin/env python
"""Seed a usable firm for development.

    python scripts/seed.py              # create, refuse if data exists
    python scripts/seed.py --reset      # wipe every table first
    python scripts/seed.py --base-only  # people, clients, chart, calendar, bank lines only

Needs a live database and the tables created:

    python -m alembic upgrade head

**The base** is plain records: one firm, five staff users and a portal user,
five clients, the standard chart of accounts, the statutory calendar generated
by the real calendar engine, and a month of bank lines per client.

**The demo** then runs the *actual pipeline* over synthetic inputs, rather
than writing pretend outputs into the tables:

* bank lines are classified by the trained model; a few are reviewed and one
  is overridden, which creates a real training correction;
* purchase-invoice PDFs are rendered, uploaded, extracted and verified;
* a GSTR-2B JSON with realistic differences (a typo'd invoice number, an
  amount the supplier reported differently, one invoice the supplier never
  filed, one the client never booked) is reconciled against those invoices;
* the risk checks run over the ledger, with a planted duplicate payment;
* a GST notice PDF is rendered, extracted, recorded and a reply drafted;
* payroll is calculated by the statutory engine for a Maharashtra and a
  Karnataka client, so the professional-tax difference is visible.

If any stage of the pipeline breaks, the seed shows it. Every document it
renders is marked fictitious in its own footer.
"""

from __future__ import annotations

import argparse
import math
import random
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "scripts"))

from generate_dataset import _SELF_TEMPLATES, _TEMPLATES, _fill  # noqa: E402
from sqlalchemy import select, text  # noqa: E402

from app.api.v1.income_tax import AisLineIn, build_statement  # noqa: E402
from app.api.v1.payroll import EmployeeIn, _calculate  # noqa: E402
from app.core.database import SessionLocal, check_connection, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.ml.extraction.samples import (  # noqa: E402
    SampleInvoice,
    SampleNotice,
    gstr2b_json,
    make_gstin,
    render_invoice,
    render_notice,
)
from app.ml.ledger.chart import STANDARD_CHART  # noqa: E402
from app.ml.ledger.vocabulary import (  # noqa: E402
    AMOUNT_BANDS,
    COUNTERPARTIES,
    DEFAULT_DIRECTION,
    DIRECTIONS,
)
from app.ml.recon.types import Tolerance  # noqa: E402
from app.models.books import JournalEntry, LedgerAccount  # noqa: E402
from app.models.compliance import ComplianceObligation, ComplianceTask, McaFiling, TaxNotice  # noqa: E402
from app.models.enums import (  # noqa: E402
    ClientStatus,
    ConsentPurpose,
    DocumentKind,
    EntityType,
    FilingStatus,
    FirmRole,
    JournalStatus,
    McaFormType,
    MessageAuthorKind,
    NoticeAuthority,
    NoticeStatus,
    ObligationCategory,
    ObligationFrequency,
    PayrollStatus,
    SubscriptionTier,
    ThreadStatus,
    TransactionDirection,
    UserStatus,
)
from app.models.practice import Client, ClientContact  # noqa: E402
from app.models.tenancy import AuditLog, ConsentRecord, Firm, FirmSettings, User  # noqa: E402
from app.models.workflow import CollaborationThread, OnboardingRecord, ThreadMessage  # noqa: E402
from app.services import compliance as compliance_engine  # noqa: E402
from app.services import documents as document_service  # noqa: E402
from app.services import drafting  # noqa: E402
from app.services import gst as gst_service  # noqa: E402
from app.services import ledger as ledger_service  # noqa: E402
from app.services import risk as risk_service  # noqa: E402
from app.services.documents import effective_fields  # noqa: E402
from app.services.resolutions import TEMPLATES  # noqa: E402
from app.utils.periods import (  # noqa: E402
    month_bounds,
    next_month_period,
    previous_month_period,
    to_month_period,
)
from app.utils.tabular import parse_amount, parse_date  # noqa: E402

#: Everyone gets this. Development only - the registration endpoint enforces a
#: real minimum, and nothing here should ever run against a real database.
DEV_PASSWORD = "caos-dev-password"

# ---------------------------------------------------------------- people -----

USERS = [
    ("owner@sharma.in", "Rohit", "Sharma", FirmRole.OWNER),
    ("partner@sharma.in", "Anita", "Desai", FirmRole.PARTNER),
    ("manager@sharma.in", "Ravi", "Iyer", FirmRole.MANAGER),
    ("staff@sharma.in", "Sneha", "Nair", FirmRole.STAFF),
    ("article@sharma.in", "Karan", "Patel", FirmRole.ARTICLE),
]
PORTAL_USER = ("accounts@aroratrading.in", "Arora", "Accounts", "Arora Trading")

#: Mirrors the clients the frontend was designed around - same names, PANs and
#: CINs. The GSTIN check digits are *computed*: the original demo GSTINs were
#: invented and fail the check digit, so the API's own validator would reject
#: them and these clients would be un-editable.
CLIENTS = [
    ("Arora Trading", "Arora Trading Private Limited", "AABCA1234M", "27AABCA1234M1ZU",
     "U51909MH2018PTC301442", EntityType.PRIVATE_LIMITED, "Mumbai", "Maharashtra", "MONTHLY"),
    ("Mehta Enterprises", "Mehta Enterprises LLP", "AAFFM5678K", "24AAFFM5678K1ZU",
     None, EntityType.LLP, "Ahmedabad", "Gujarat", "QUARTERLY"),
    ("Gupta Textiles", "Gupta Textiles Private Limited", "AADCG9012P", "09AADCG9012P1Z6",
     "U17110UP2015PTC072118", EntityType.PRIVATE_LIMITED, "Kanpur", "Uttar Pradesh", "MONTHLY"),
    ("Shah & Co", "Shah and Company", "AAHFS3456L", "27AAHFS3456L1ZQ",
     None, EntityType.PARTNERSHIP, "Pune", "Maharashtra", "QUARTERLY"),
    ("Krishna Logistics", "Krishna Logistics Private Limited", "AABCK7890N", "29AABCK7890N1ZO",
     "U63030KA2020PTC134560", EntityType.PRIVATE_LIMITED, "Bengaluru", "Karnataka", "MONTHLY"),
]

COMPANIES = [EntityType.PRIVATE_LIMITED.value, EntityType.PUBLIC_LIMITED.value]

#: (code, description, category, frequency, due day, month offset, applies to)
#: Annual offsets count from March, the month the financial year ends:
#: AOC-4 within 30 days of an AGM held by 30 September -> 30 October;
#: MGT-7 within 60 days -> 29 November; GSTR-9 by 31 December; ITR-6 for an
#: audited company by 31 October.
OBLIGATIONS = [
    ("GSTR-1", "Outward supplies statement", ObligationCategory.GST, ObligationFrequency.MONTHLY, 11, 1, []),
    ("GSTR-3B", "Summary return and tax payment", ObligationCategory.GST, ObligationFrequency.MONTHLY, 20, 1, []),
    ("GSTR-9", "Annual GST return", ObligationCategory.GST, ObligationFrequency.ANNUAL, 31, 9, []),
    ("TDS 24Q", "Quarterly TDS return, salary", ObligationCategory.TDS, ObligationFrequency.QUARTERLY, 31, 1, []),
    ("TDS 26Q", "Quarterly TDS return, non-salary", ObligationCategory.TDS, ObligationFrequency.QUARTERLY, 31, 1, []),
    ("PF ECR", "Provident fund electronic challan return", ObligationCategory.PAYROLL, ObligationFrequency.MONTHLY, 15, 1, []),
    ("ESI", "Employees' state insurance contribution", ObligationCategory.PAYROLL, ObligationFrequency.MONTHLY, 15, 1, []),
    ("ITR-6", "Income tax return, companies", ObligationCategory.INCOME_TAX, ObligationFrequency.ANNUAL, 31, 7, COMPANIES),
    ("AOC-4", "Financial statements with ROC", ObligationCategory.ROC, ObligationFrequency.ANNUAL, 30, 7, COMPANIES),
    ("MGT-7", "Annual return with ROC", ObligationCategory.ROC, ObligationFrequency.ANNUAL, 29, 8, COMPANIES),
]


def already_seeded(session) -> bool:
    return session.execute(select(Firm.id).limit(1)).scalar_one_or_none() is not None


def wipe(session) -> None:
    """Truncate every table. Development only."""
    tables = session.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'")
    ).scalars().all()
    if not tables:
        return
    joined = ", ".join(f'"public"."{t}"' for t in tables)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {joined} CASCADE"))
    print(f"  wiped {len(tables)} tables")


# ------------------------------------------------------------------- base ----


def _narration(code: str, counterparty: str, direction: str, rng: random.Random) -> str:
    """A narration in a real bank's grammar, from the classifier's own templates."""
    if code in _SELF_TEMPLATES and rng.random() < 0.6:
        return _fill(rng.choice(_SELF_TEMPLATES[code]), counterparty, rng)
    eligible = [(w, t) for w, t, d in _TEMPLATES if d in (None, direction)]
    weights, templates = zip(*eligible, strict=True)
    return _fill(rng.choices(templates, weights=weights)[0], counterparty, rng)


def _amount(code: str, rng: random.Random) -> Decimal:
    low, high = AMOUNT_BANDS.get(code, (500, 50_000))
    value = math.exp(rng.uniform(math.log(low), math.log(high)))
    return Decimal(f"{value:.2f}")


def seed_base(session, *, rng: random.Random, today: date) -> dict:
    firm = Firm(
        name="Sharma & Associates", frn="123456W", pan="AAAFS1234A", email="office@sharma.in",
        phone="02212345678", address_line1="401, Nariman Bhavan, Nariman Point", city="Mumbai",
        state="Maharashtra", pincode="400021", tier=SubscriptionTier.GROWTH,
    )
    session.add(firm)
    session.flush()
    session.add(FirmSettings(firm_id=firm.id))

    password_hash = hash_password(DEV_PASSWORD)
    users: dict[FirmRole, User] = {}
    for email, first, last, role in USERS:
        user = User(firm_id=firm.id, email=email, password_hash=password_hash, first_name=first,
                    last_name=last, role=role, status=UserStatus.ACTIVE)
        session.add(user)
        users[role] = user
    session.flush()

    # Spread ownership so row visibility is actually exercised: STAFF must see
    # only their own clients, and with one manager that path never runs.
    managers = [users[FirmRole.MANAGER], users[FirmRole.STAFF], users[FirmRole.ARTICLE]]
    clients: dict[str, Client] = {}
    for index, (name, legal, pan, gstin, cin, entity, city, state, frequency) in enumerate(CLIENTS):
        client = Client(
            firm_id=firm.id, name=name, legal_name=legal, pan=pan, gstin=gstin, cin=cin, entity_type=entity,
            status=ClientStatus.ACTIVE, engaged_on=date(2025, 4, 1), manager_id=managers[index % len(managers)].id,
            email=f"accounts@{name.split()[0].lower()}.in", city=city, state=state, gst_frequency=frequency,
        )
        session.add(client)
        clients[name] = client
    session.flush()

    email, first, last, client_name = PORTAL_USER
    portal = User(firm_id=firm.id, client_id=clients[client_name].id, email=email, password_hash=password_hash,
                  first_name=first, last_name=last, role=FirmRole.CLIENT, status=UserStatus.ACTIVE)
    session.add(portal)

    directors = {
        "Arora Trading": [("Vikas Arora", "Managing Director"), ("Neha Arora", "Director")],
        "Gupta Textiles": [("Suresh Gupta", "Director"), ("Kavita Gupta", "Director")],
        "Krishna Logistics": [("Ramesh Krishnan", "Director"), ("Lakshmi Krishnan", "Director")],
        "Mehta Enterprises": [("Hitesh Mehta", "Designated Partner")],
        "Shah & Co": [("Paresh Shah", "Partner")],
    }
    for name, people in directors.items():
        for person, designation in people:
            session.add(ClientContact(
                client_id=clients[name].id, name=person, designation=designation,
                din=f"{rng.randint(10_000_000, 99_999_999)}" if "Partner" not in designation or "Designated" in designation else None,
                is_signatory=True,
            ))

    chart: dict[str, LedgerAccount] = {}
    for spec in STANDARD_CHART:
        account = LedgerAccount(firm_id=firm.id, code=spec.code, name=spec.name, group=spec.group, is_standard=True)
        session.add(account)
        chart[spec.code] = account

    for code, description, category, frequency, day, offset, applies in OBLIGATIONS:
        session.add(ComplianceObligation(
            firm_id=firm.id, code=code, name=code, description=description, category=category,
            frequency=frequency, due_day_of_month=day, due_month_offset=offset, applies_to=applies,
        ))
    session.flush()

    # ---------------------------------------------------- calendar --------
    # Generated by the real engine for the financial year so far, then given
    # a plausible history: anything due before this month was filed.
    current = to_month_period(today)
    period, periods = f"{today.year if today.month >= 4 else today.year - 1}-03", []
    while period <= current:
        periods.append(period)
        period = next_month_period(period)
    for period in periods:
        compliance_engine.generate_tasks(session, firm_id=firm.id, period=period)
    session.flush()
    _shape_task_history(session, firm.id, today, rng)

    # ------------------------------------------------- bank statement -----
    statement_period = previous_month_period(current)
    start, end = month_bounds(statement_period)
    pool = [(code, cp) for code, names in COUNTERPARTIES.items() if code in chart for cp in names]
    entries = 0
    for client in clients.values():
        for _ in range(40):
            code, counterparty = rng.choice(pool)
            direction = DIRECTIONS.get(code, DEFAULT_DIRECTION)
            when = start + timedelta(days=rng.randint(0, (end - start).days))
            session.add(JournalEntry(
                firm_id=firm.id, client_id=client.id, transaction_date=when,
                narration=_narration(code, counterparty, direction, rng), amount=_amount(code, rng),
                direction=TransactionDirection(direction), status=JournalStatus.SUGGESTED, period=statement_period,
            ))
            entries += 1

    session.commit()
    return {
        "firm": firm, "users": users, "portal": portal, "clients": clients, "chart": chart,
        "statement_period": statement_period, "current_period": current, "entries": entries,
    }


def _shape_task_history(session, firm_id, today: date, rng: random.Random) -> None:
    month_start = today.replace(day=1)
    for task in session.execute(select(ComplianceTask).where(ComplianceTask.firm_id == firm_id)).scalars():
        if task.due_date < month_start:
            task.status = FilingStatus.FILED
        elif task.due_date < today:
            # Due earlier this month: most were filed, a few slipped.
            task.status = FilingStatus.FILED if rng.random() < 0.75 else FilingStatus.PENDING
        elif task.due_date.month == today.month:
            task.status = FilingStatus.IN_PROGRESS if rng.random() < 0.4 else FilingStatus.PENDING
        if task.status is FilingStatus.FILED:
            filed = task.due_date - timedelta(days=rng.randint(0, 6))
            task.completed_at = datetime(filed.year, filed.month, filed.day, 16, 30, tzinfo=UTC)


# ------------------------------------------------------------------- demo ----


SUPPLIERS = [
    ("Deepak Steel Suppliers Private Limited", "27", "AACCD1122E", "Plot 12, MIDC Bhosari, Pune 411026", "MS steel sheets"),
    ("Vector Office Solutions LLP", "27", "AAGFV4455R", "Unit 4, Andheri East, Mumbai 400093", "Office furniture"),
    ("Mehta Packaging Industries", "24", "AAFPM7781K", "GIDC Vatva, Ahmedabad 382445", "Corrugated boxes"),
    ("Sunrise Chemicals Private Limited", "33", "AABCS6677J", "SIPCOT, Gummidipoondi 601201", "Industrial solvents"),
    ("Bharat Freight Carriers", "27", "AAJFB2210Q", "Transport Nagar, Nagpur 440008", "Freight charges"),
]


def _audit(session, user: User, action: str, resource_type: str, resource_id, meta: dict | None = None) -> None:
    """Seed actions are real runs of the pipeline; they are logged as such,
    and marked ``seeded`` so nobody mistakes them for a person's activity."""
    session.add(AuditLog(firm_id=user.firm_id, user_id=user.id, action=action, resource_type=resource_type,
                         resource_id=str(resource_id), meta={"seeded": True, **(meta or {})}))


def seed_demo(session, ctx: dict, *, rng: random.Random, today: date) -> dict:
    firm: Firm = ctx["firm"]
    users: dict[FirmRole, User] = ctx["users"]
    clients: dict[str, Client] = ctx["clients"]
    manager, staff = users[FirmRole.MANAGER], users[FirmRole.STAFF]
    statement_period = ctx["statement_period"]
    counts: dict[str, object] = {}

    # ------------------------------------------- planted risk patterns ----
    gupta = clients["Gupta Textiles"]
    start, end = month_bounds(statement_period)
    planted = [
        (start + timedelta(days=8), "NEFT DR-HDFC0001234-SHREE GANESH TRANSPORT-N123456789012345-PAYMENT", "48500.00"),
        (start + timedelta(days=10), "NEFT DR-HDFC0001234-SHREE GANESH TRANSPORT-N123456789012399-PAYMENT", "48500.00"),
        (end - timedelta(days=1), "RTGS-HDFCR52026091812345-UNREGISTERED CONSULTANT-PAYMENT", "100000.00"),
    ]
    for when, narration, amount in planted:
        session.add(JournalEntry(
            firm_id=firm.id, client_id=gupta.id, transaction_date=when, narration=narration,
            amount=Decimal(amount), direction=TransactionDirection.DEBIT, status=JournalStatus.SUGGESTED,
            period=statement_period,
        ))

    # Receipts in the previous financial year, for the AIS comparison.
    arora = clients["Arora Trading"]
    fy_start_year = today.year - 1 if today.month >= 4 else today.year - 2
    receipts = [
        (date(fy_start_year, 6, 30), "HDFC BANK", "INT.PD:01-04 TO 30-06 HDFC BANK", "11850.00", "4100"),
        (date(fy_start_year, 9, 30), "HDFC BANK", "INT.PD:01-07 TO 30-09 HDFC BANK", "12105.00", "4100"),
        (date(fy_start_year, 12, 31), "HDFC BANK", "INT.PD:01-10 TO 31-12 HDFC BANK", "12010.00", "4100"),
        (date(fy_start_year + 1, 3, 31), "HDFC BANK", "INT.PD:01-01 TO 31-03 HDFC BANK", "12235.00", "4100"),
        (date(fy_start_year, 8, 14), "MAHINDRA LOGISTICS LIMITED", "NEFT Cr-UTIB0000123-MAHINDRA LOGISTICS LIMITED-412233445566", "396000.00", "1100"),
        (date(fy_start_year + 1, 1, 20), "MAHINDRA LOGISTICS LIMITED", "NEFT Cr-UTIB0000123-MAHINDRA LOGISTICS LIMITED-412233449999", "396000.00", "1100"),
    ]
    for when, counterparty, narration, amount, code in receipts:
        session.add(JournalEntry(
            firm_id=firm.id, client_id=arora.id, transaction_date=when, narration=narration, counterparty=counterparty,
            amount=Decimal(amount), direction=TransactionDirection.CREDIT, status=JournalStatus.APPROVED,
            posted_ledger_id=ctx["chart"][code].id, reviewed_by_id=staff.id, reviewed_at=datetime.now(UTC),
            period=to_month_period(when),
        ))
    session.flush()

    # ------------------------------------------------------- classify -----
    classified = auto = 0
    for client in clients.values():
        outcome = ledger_service.classify_entries(
            session, firm_id=firm.id, client_id=client.id, period=statement_period
        )
        classified += outcome.classified
        auto += outcome.auto_applied
        _audit(session, manager, "ENTRIES_CLASSIFY", "client", client.id,
               {"period": statement_period, "classified": outcome.classified, "auto_applied": outcome.auto_applied})
    counts["entries_classified"] = classified
    counts["entries_auto_applied"] = auto
    # The session does not autoflush (app/core/database.py), so each stage is
    # flushed before the next one queries what it wrote.
    session.flush()

    queue = session.execute(
        select(JournalEntry).where(JournalEntry.firm_id == firm.id, JournalEntry.status == JournalStatus.UNDER_REVIEW)
        .order_by(JournalEntry.confidence.desc())
    ).scalars().all()
    reviewed = 0
    for entry in queue[:4]:
        suggested = session.get(LedgerAccount, entry.suggested_ledger_id)
        ledger_service.review_entry(session, entry=entry, reviewer_id=staff.id, ledger_code=suggested.code)
        reviewed += 1
    # One genuine correction. The model reads "CONSULTANT" and suggests
    # Professional Fees; the manager knows this engagement was litigation
    # support, which belongs in Legal Expenses. Posting it elsewhere sets
    # `overridden` and harvests the pair into ledger_training_examples - the
    # only real labelled data the project ever accumulates, so the seed has to
    # exercise that path rather than just agree with the model.
    consultancy = session.execute(
        select(JournalEntry).where(JournalEntry.narration.like("%UNREGISTERED CONSULTANT%"))
    ).scalar_one()
    ledger_service.review_entry(session, entry=consultancy, reviewer_id=manager.id, ledger_code="5520")
    assert consultancy.overridden, "the seed's correction must differ from the suggestion"
    counts["entries_reviewed"] = reviewed + 1
    counts["entries_overridden"] = 1
    session.flush()

    # ----------------------------------------- invoices -> extraction -----
    period = statement_period
    p_start, _ = month_bounds(period)
    invoices: list[SampleInvoice] = []
    for index, (name, state, pan, address, description) in enumerate(SUPPLIERS):
        invoices.append(SampleInvoice(
            supplier_name=name, supplier_gstin=make_gstin(state, pan), supplier_address=address,
            buyer_name=arora.legal_name, buyer_gstin=arora.gstin, invoice_no=f"{name.split()[0][:2].upper()}/{p_start:%y}-{index + 441:04d}",
            invoice_date=p_start + timedelta(days=3 + index * 5), description=description,
            taxable=Decimal(str(rng.choice([45000, 75000, 128000, 212000, 96000, 450000]))),
            rate_percent=Decimal("5") if "Freight" in name else Decimal("18"),
        ))
    documents = []
    for invoice in invoices:
        pdf = render_invoice(invoice)
        document = document_service.upload(
            session, client=arora, uploaded_by=ctx["portal"].id, data=pdf,
            filename=f"{invoice.supplier_name.split()[0].lower()}-{invoice.invoice_no.split('-')[-1]}.pdf",
            kind=DocumentKind.PURCHASE_INVOICE, period=None, folder=f"/{period}/purchases",
        )
        documents.append(document)
        _audit(session, ctx["portal"], "DOCUMENT_UPLOAD", "document", document.id, {"file_name": document.file_name})
    # Four verified by staff; the last left for review, as a real queue would be.
    for document in documents[:4]:
        document_service.verify(session, document=document, corrections={})
        _audit(session, staff, "DOCUMENT_VERIFY", "document", document.id, {"file_name": document.file_name})
    counts["documents"] = len(documents)
    session.flush()

    # --------------------------------------------- GSTR-2B reconcile ------
    # Realistic differences against the books side:
    #   [0] exact; [1] supplier typed the invoice number with an O for a 0;
    #   [2] supplier reported a different amount; [3] never filed by the
    #   supplier (missing in 2B); plus one invoice the client never booked.
    unbooked = SampleInvoice(
        supplier_name="Sunrise Chemicals Private Limited", supplier_gstin=make_gstin("33", "AABCS6677J"),
        supplier_address="", buyer_name=arora.legal_name, buyer_gstin=arora.gstin, invoice_no="SC-2026-307",
        invoice_date=p_start + timedelta(days=21), description="", taxable=Decimal("96000"),
    )
    portal_side = [
        (invoices[0], {}),
        (invoices[1], {"invoice_no": invoices[1].invoice_no.replace("0", "O", 1)}),
        # Supplier reported Rs 3,500 less taxable value: the books claim Rs 630
        # more credit than the portal supports - that excess is at risk.
        (invoices[2], {"taxable": invoices[2].taxable - 3500, "tax": (invoices[2].tax - Decimal("630")).quantize(Decimal("0.01"))}),
        (unbooked, {}),
    ]
    gstr2b = gstr2b_json(arora.gstin, period, portal_side)
    portal_lines, portal_meta = gst_service.parse_gstr2b_json(gstr2b)
    books, books_meta = gst_service.books_from_documents(session, client_id=arora.id, period=period)
    run = gst_service.run_reconciliation(
        session, firm_id=firm.id, client_id=arora.id, period=period, books=books, portal=portal_lines,
        tolerance=Tolerance(), sources={"portal": portal_meta, "books": books_meta}, replace=False,
    )
    session.flush()
    _audit(session, manager, "GST_RECON_RUN", "gst_reconciliation", run.id, {"period": period})
    counts["recon_itc_at_risk"] = f"Rs {run.itc_at_risk:,.2f}"
    counts["recon_matched"] = f"{run.matched_lines}/{run.total_lines}"
    # Keep the 2B file with the client's documents, as a practice would.
    document_service.upload(
        session, client=arora, uploaded_by=manager.id, data=gstr2b, filename=f"gstr2b-{period}.json",
        kind=DocumentKind.GST_RETURN, period=period, folder=f"/{period}/gst",
    )

    # ------------------------------------------------------ risk ----------
    findings = 0
    for client in clients.values():
        _, rows = risk_service.run_checks(session, firm_id=firm.id, client_id=client.id, period=statement_period)
        findings += len(rows)
        _audit(session, manager, "RISK_RUN", "client", client.id, {"period": statement_period, "findings": len(rows)})
    counts["risk_findings"] = findings

    # ----------------------------------------------------- notices --------
    notice_pdf = render_notice(SampleNotice(
        authority_header="Office of the Assistant Commissioner of CGST, Kanpur Division",
        din=f"ZD09{today:%d%m%y}0123456", section_text="This notice is issued under section 73 of the CGST Act, 2017 in FORM GST DRC-01.",
        issued_on=today - timedelta(days=27), reply_by=today + timedelta(days=8),
        taxpayer_name=gupta.legal_name, taxpayer_id=gupta.gstin,
        subject="Mismatch between ITC claimed in GSTR-3B and ITC available in GSTR-2B for FY 2024-25",
        body="On scrutiny of returns, input tax credit claimed in GSTR-3B exceeds the credit\n"
             "auto-populated in GSTR-2B. You are directed to show cause why the excess credit\n"
             "should not be recovered with interest under section 50.",
        demand=Decimal("284000"),
    ))
    notice_document = document_service.upload(
        session, client=gupta, uploaded_by=manager.id, data=notice_pdf, filename="drc-01-notice.pdf",
        kind=DocumentKind.NOTICE, period=None, folder="/notices",
    )
    fields = effective_fields(notice_document.extraction)
    gst_notice = TaxNotice(
        firm_id=firm.id, client_id=gupta.id, document_id=notice_document.id, owner_id=manager.id,
        notice_number=fields["notice_number"], authority=NoticeAuthority(fields["authority"]),
        section_code=fields.get("section_code"), subject=fields.get("subject"),
        issued_on=parse_date(fields.get("issued_on")), received_on=today - timedelta(days=24),
        due_date=parse_date(fields["due_date"]), demand_amount=parse_amount(fields.get("demand_amount")),
        extracted_text=notice_document.extraction.raw_text,
    )
    session.add(gst_notice)
    session.flush()
    draft = drafting.draft_notice_reply(session, user_id=manager.id, firm=firm, client=gupta, notice=gst_notice, instructions=None)
    gst_notice.draft_response, gst_notice.draft_model = draft.text, draft.model or draft.provider
    gst_notice.status = NoticeStatus.RESPONSE_DRAFTED
    session.add(TaxNotice(
        firm_id=firm.id, client_id=arora.id, owner_id=staff.id, notice_number=f"CPC/{today.year}/143(1)/88123",
        authority=NoticeAuthority.INCOME_TAX, section_code="143(1)(a)",
        subject="Proposed adjustment: TDS claimed exceeds 26AS", issued_on=today - timedelta(days=21),
        received_on=today - timedelta(days=20), due_date=today + timedelta(days=24), demand_amount=Decimal("46500"),
    ))
    counts["notices"] = 2
    counts["notice_draft_provider"] = draft.provider

    # ----------------------------------------------------- payroll --------
    staff_rows = {
        "Arora Trading": [
            ("E001", "Anita Raghavan", "female", 42000, 18000, 18000), ("E002", "Vikram Shetty", "male", 22000, 9000, 15000),
            ("E003", "Priya Menon", "female", 9000, 4000, 5000), ("E004", "Rahul Bose", "male", 9000, 4000, 5000),
            ("E005", "Sneha Kulkarni", "female", 15000, 6000, 11000),
        ],
        "Krishna Logistics": [
            ("K001", "Manjunath Gowda", "male", 30000, 12000, 18000), ("K002", "Shwetha Rao", "female", 16000, 6400, 9600),
            ("K003", "Imran Pasha", "male", 8000, 3200, 4800), ("K004", "Divya Hegde", "female", 12000, 4800, 7200),
        ],
    }
    for name, rows in staff_rows.items():
        employees = [
            EmployeeIn(employee_code=code, employee_name=person, gender=gender, basic=Decimal(basic),
                       hra=Decimal(hra), allowances=Decimal(allow),
                       paid_days=Decimal("20") if code.endswith("4") else None)
            for code, person, gender, basic, hra, allow in rows
        ]
        payroll_run = _calculate(session, firm_id=firm.id, client=clients[name], period=statement_period,
                                 employees=employees, replace=False)
        payroll_run.status = PayrollStatus.APPROVED
        payroll_run.approved_by_id, payroll_run.approved_at = manager.id, datetime.now(UTC)
    session.flush()
    # The payroll now exists, so the calendar engine adds PF and ESI - and
    # running it again is safe because it is idempotent.
    for period_ in (statement_period, ctx["current_period"]):
        compliance_engine.generate_tasks(session, firm_id=firm.id, period=period_)
    session.flush()
    _shape_task_history(session, firm.id, today, rng)
    counts["payroll_runs"] = len(staff_rows)

    # --------------------------------------------------- secretarial ------
    fy = f"{fy_start_year}-{(fy_start_year + 1) % 100:02d}"
    agm = date(fy_start_year + 1, 9, 30)
    for name in ("Arora Trading", "Gupta Textiles", "Krishna Logistics"):
        client = clients[name]
        session.add(McaFiling(firm_id=firm.id, client_id=client.id, form_type=McaFormType.AOC_4, financial_year=fy,
                              due_date=agm + timedelta(days=30), status=FilingStatus.PENDING, meeting_date=agm, meeting_type="AGM"))
        session.add(McaFiling(firm_id=firm.id, client_id=client.id, form_type=McaFormType.MGT_7, financial_year=fy,
                              due_date=agm + timedelta(days=60), status=FilingStatus.PENDING, meeting_date=agm, meeting_type="AGM"))
    session.add(McaFiling(firm_id=firm.id, client_id=gupta.id, form_type=McaFormType.DIR_3_KYC, financial_year=fy,
                          due_date=date(fy_start_year + 1, 9, 30), status=FilingStatus.FILED,
                          submitted_on=date(fy_start_year + 1, 9, 22), srn="X98412771"))
    krishna = clients["Krishna Logistics"]
    session.add(McaFiling(firm_id=firm.id, client_id=krishna.id, form_type=McaFormType.ADT_1, financial_year=fy,
                          due_date=agm + timedelta(days=15), status=FilingStatus.FILED,
                          submitted_on=agm + timedelta(days=11), srn="X98107233"))
    session.flush()
    aoc4 = session.execute(select(McaFiling).where(McaFiling.client_id == arora.id, McaFiling.form_type == McaFormType.AOC_4)).scalar_one()
    template = TEMPLATES["approve_annual_accounts"]
    minutes, resolution = drafting.draft_board_minutes(
        session, user_id=manager.id, firm=firm, client=arora, template=template,
        values={"year_end": f"31 March {fy_start_year + 1}", "signatories": "Vikas Arora (Managing Director) and Neha Arora (Director)"},
        meeting_date=date(fy_start_year + 1, 8, 28), meeting_time="11:00 AM", place="the registered office, Mumbai",
        chairperson="Vikas Arora", directors_present=["Vikas Arora", "Neha Arora"],
    )
    aoc4.resolution_md, aoc4.minutes_md = resolution, minutes.text
    counts["mca_filings"] = 8

    # ---------------------------------------------- collaboration ---------
    conversations = [
        (arora, f"{statement_period} purchase bills", [
            (ctx["portal"], MessageAuthorKind.CLIENT_USER, "Uploaded the purchase invoices for the month."),
            (staff, MessageAuthorKind.FIRM_USER, "Thanks - four verified. The Bharat Freight bill is with us for review."),
            (ctx["portal"], MessageAuthorKind.CLIENT_USER, "Sunrise Chemicals says they billed us SC-2026-307 too. Can you check?"),
        ], ThreadStatus.AWAITING_FIRM),
        (gupta, f"Notice {gst_notice.notice_number}", [
            (manager, MessageAuthorKind.FIRM_USER, "We have received a DRC-01 for the ITC mismatch. Draft reply is ready for review."),
        ], ThreadStatus.AWAITING_CLIENT),
        (krishna, "Payroll inputs", [
            (manager, MessageAuthorKind.FIRM_USER, "Please confirm Divya Hegde's joining date - we have pro-rated for 20 days."),
        ], ThreadStatus.AWAITING_CLIENT),
    ]
    for client, subject, messages, status in conversations:
        thread = CollaborationThread(firm_id=firm.id, client_id=client.id, subject=subject, status=status)
        session.add(thread)
        session.flush()
        at = datetime.now(UTC) - timedelta(hours=len(messages) * 5)
        for author, kind, body in messages:
            session.add(ThreadMessage(thread_id=thread.id, author_id=author.id, author_kind=kind, body=body, created_at=at))
            at += timedelta(hours=4)
        thread.last_message_at = at - timedelta(hours=4)
    counts["threads"] = len(conversations)

    # ------------------------------------------------ consent, AIS --------
    for client in clients.values():
        session.add(ConsentRecord(firm_id=firm.id, client_id=client.id, purpose=ConsentPurpose.DATA_PROCESSING,
                                  granted_by=f"Authorised signatory, {client.legal_name}",
                                  granted_at=datetime(2025, 4, 2, 11, 0, tzinfo=UTC)))
    session.add(ConsentRecord(firm_id=firm.id, client_id=arora.id, purpose=ConsentPurpose.PORTAL_ACCESS,
                              granted_by="Vikas Arora, Managing Director", granted_at=datetime(2025, 4, 2, 11, 5, tzinfo=UTC)))
    ay = f"{fy_start_year + 1}-{(fy_start_year + 2) % 100:02d}"
    build_statement(session, firm_id=firm.id, client=arora, ay=ay, replace=False, lines=[
        AisLineIn(head="INTEREST", counterparty="HDFC Bank Ltd", tan="MUMH03189E", ais_amount=Decimal("48200"), tds_credit=Decimal("4820")),
        AisLineIn(head="Contract receipts 194C", counterparty="Mahindra Logistics Ltd", tan="MUMM12345B",
                  ais_amount=Decimal("864000"), tds_credit=Decimal("8640")),
        AisLineIn(head="DIVIDEND", counterparty="ICICI Securities Ltd", ais_amount=Decimal("18600"), tds_credit=Decimal("1860")),
    ])

    # ----------------------------------------------------- onboarding -----
    session.add(OnboardingRecord(
        firm_id=firm.id, owner_id=manager.id, stage="REGISTRY_REVIEW", legal_name="Patel Agro Foods LLP",
        pan="AAPFP4321H", gstin=make_gstin("24", "AAPFP4321H"), entity_type=EntityType.LLP,
        registry_payload={"derived": {"source": "derived from identifiers - no registry lookup performed",
                                      "state": "Gujarat", "pan_holder_type": "Firm or LLP", "entity_type": "LLP", "notes": []},
                          "registrations": ["GST"], "registrations_confirmed": False},
        directors=[],
    ))

    session.commit()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="truncate every table first")
    parser.add_argument("--base-only", action="store_true", help="skip the pipeline demo")
    parser.add_argument("--seed", type=int, default=20261025)
    args = parser.parse_args()

    ok, detail = check_connection()
    if not ok:
        print(f"Cannot reach the database: {detail}\n\nSet DATABASE_URL in .env, then:\n"
              "  python -m alembic upgrade head\n\nSee README.md -> 'Connecting PostgreSQL'.", file=sys.stderr)
        return 1
    print(f"connected: {detail}")

    session = SessionLocal()
    today = date.today()
    rng = random.Random(args.seed)
    try:
        if args.reset:
            wipe(session)
        elif already_seeded(session):
            print("This database already has a firm. Re-run with --reset to wipe and reseed, "
                  "which deletes everything.", file=sys.stderr)
            return 1
        ctx = seed_base(session, rng=rng, today=today)
        print(f"\nbase: 1 firm, {len(USERS)} staff + 1 portal user, {len(ctx['clients'])} clients, "
              f"{len(ctx['chart'])} ledgers, {ctx['entries']} bank lines for {ctx['statement_period']}")
        if not args.base_only:
            print("demo: running the pipeline (classify, extract, reconcile, risk, notices, payroll)...")
            counts = seed_demo(session, ctx, rng=rng, today=today)
            for key, value in counts.items():
                print(f"  {key:<24} {value}")
    finally:
        session.close()

    print(
        "\nSign in with any of:\n"
        + "\n".join(f"  {email:<26} ({role.value})" for email, _, _, role in USERS)
        + f"\n  {PORTAL_USER[0]:<26} (CLIENT portal, {PORTAL_USER[3]})"
        + f"\n\npassword: {DEV_PASSWORD}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
