"""The compliance calendar engine - Module 11.

An *obligation* is the rule ("GSTR-3B, 20th of the following month"); a *task*
is one client's instance of it for one period. ``generate_tasks`` turns the
first into the second for a month, and is idempotent - the unique constraint
on (client, form, period) means running it twice creates nothing new.

Applicability is where calendars usually go wrong, so it is explicit:

* GST returns only for clients with a GSTIN. Monthly filers get GSTR-1 on the
  11th and GSTR-3B on the 20th; QRMP filers get both quarterly (GSTR-1 on the
  13th, GSTR-3B on the 22nd - the 24th for category-Y states) and a PMT-06
  payment on the 25th in the first two months of each quarter.
* ROC forms and ITR-6 only for companies, via the obligation's ``applies_to``.
* PF and ESI only for clients with a payroll on record - generating PF tasks
  for a client with no employees is noise that trains people to ignore the list.
* Quarterly TDS returns are due on the 31st of the month after the quarter,
  except Q4 (January-March), which is due on 31 May.
* Annual obligations are generated once, from the March period that ends the
  financial year.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.compliance import ComplianceObligation, ComplianceTask, PayrollRun
from app.models.enums import (
    ClientStatus,
    FilingStatus,
    ObligationCategory,
    ObligationFrequency,
)
from app.models.practice import Client
from app.utils.periods import (
    due_date_for,
    financial_year_of,
    month_bounds,
    month_period_label,
    parse_month_period,
    quarter_of_month,
)

#: States filing QRMP GSTR-3B on the 24th rather than the 22nd (category Y).
#: Identified by GST state code.
CATEGORY_Y_STATES = {
    "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17",
    "18", "19", "20", "21", "35",
}


def _quarter_label(period: str) -> str:
    year, month = parse_month_period(period)
    fy = financial_year_of(date(year, month, 1))
    start, end = fy.split("-")
    return f"Q{quarter_of_month(month)} FY{start[2:]}-{end}"


def is_quarter_end(month: int) -> bool:
    return month in (3, 6, 9, 12)


def generate_tasks(
    session: Session,
    *,
    firm_id: uuid.UUID,
    period: str,
    client_ids: list[uuid.UUID] | None = None,
) -> int:
    """Create the tasks ``period`` gives rise to. Returns how many were new."""
    year, month = parse_month_period(period)
    clients_query = select(Client).where(
        Client.firm_id == firm_id,
        Client.deleted_at.is_(None),
        Client.status.in_([ClientStatus.ACTIVE, ClientStatus.ONBOARDING]),
    )
    if client_ids:
        clients_query = clients_query.where(Client.id.in_(client_ids))
    clients = session.execute(clients_query).scalars().all()
    obligations = session.execute(
        select(ComplianceObligation).where(
            ComplianceObligation.firm_id == firm_id, ComplianceObligation.is_active.is_(True)
        )
    ).scalars().all()

    with_payroll = set(
        session.execute(
            select(Client.id).where(
                Client.firm_id == firm_id, exists().where(PayrollRun.client_id == Client.id)
            )
        ).scalars()
    )
    existing = {
        (row.client_id, row.form, row.period)
        for row in session.execute(
            select(ComplianceTask.client_id, ComplianceTask.form, ComplianceTask.period).where(
                ComplianceTask.firm_id == firm_id
            )
        )
    }

    created = 0

    def add(client: Client, obligation: ComplianceObligation | None, form: str, description: str,
            label: str, due: date) -> None:
        nonlocal created
        key = (client.id, form, label)
        if key in existing:
            return
        existing.add(key)
        session.add(
            ComplianceTask(
                firm_id=firm_id,
                client_id=client.id,
                obligation_id=obligation.id if obligation else None,
                assignee_id=client.manager_id,
                form=form,
                description=description,
                period=label,
                due_date=due,
                status=FilingStatus.PENDING,
            )
        )
        created += 1

    for client in clients:
        qrmp = client.gst_frequency == "QUARTERLY"
        for obligation in obligations:
            if obligation.applies_to and client.entity_type.value not in obligation.applies_to:
                continue
            if obligation.category is ObligationCategory.GST and not client.gstin:
                continue
            if obligation.category is ObligationCategory.PAYROLL and client.id not in with_payroll:
                continue

            code = obligation.code
            description = obligation.description or obligation.name

            if code in ("GSTR-1", "GSTR-3B") and qrmp:
                if not is_quarter_end(month):
                    continue
                day = 13 if code == "GSTR-1" else (24 if (client.gstin or "")[:2] in CATEGORY_Y_STATES else 22)
                add(client, obligation, code, f"{description} (QRMP, quarterly)", _quarter_label(period),
                    due_date_for(period, day, 1))
                continue

            if obligation.frequency is ObligationFrequency.MONTHLY:
                add(client, obligation, code, description, month_period_label(period),
                    due_date_for(period, obligation.due_day_of_month or 20, obligation.due_month_offset))
            elif obligation.frequency is ObligationFrequency.QUARTERLY:
                if not is_quarter_end(month):
                    continue
                offset = 2 if (code.startswith("TDS") and month == 3) else obligation.due_month_offset
                add(client, obligation, code, description, _quarter_label(period),
                    due_date_for(period, obligation.due_day_of_month or 31, offset))
            elif obligation.frequency is ObligationFrequency.ANNUAL:
                if month != 3:
                    continue
                fy = financial_year_of(date(year, month, 1))
                add(client, obligation, code, description, f"FY {fy}",
                    due_date_for(period, obligation.due_day_of_month or 31, obligation.due_month_offset))

        if qrmp and client.gstin and not is_quarter_end(month):
            add(client, None, "PMT-06", "Monthly tax payment under QRMP", month_period_label(period),
                due_date_for(period, 25, 1))

    return created


def is_overdue(task: ComplianceTask, today: date | None = None) -> bool:
    return task.status is not FilingStatus.FILED and task.due_date < (today or date.today())


def effective_status(task: ComplianceTask, today: date | None = None) -> FilingStatus:
    """A pending task past its date *is* overdue, whether or not anyone has
    updated the row. Computed on read so the calendar can never be stale."""
    return FilingStatus.OVERDUE if is_overdue(task, today) else task.status


def current_month_period(today: date | None = None) -> str:
    today = today or date.today()
    return f"{today.year:04d}-{today.month:02d}"


__all__ = [
    "current_month_period",
    "effective_status",
    "generate_tasks",
    "is_overdue",
    "month_bounds",
]
