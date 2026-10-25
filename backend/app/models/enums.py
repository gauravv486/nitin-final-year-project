"""Domain enumerations.

Each is a ``str`` enum so that the value stored in Postgres, the value in JSON
on the wire, and the Python member are the same string - no mapping layer and
nothing to get out of step.

Where a frontend union already exists in ``frontend/lib/demo-data.ts``, the
docstring records it. The API converts to those exact strings on the way out,
so the existing UI needs no changes.
"""

from __future__ import annotations

from enum import StrEnum


class FirmRole(StrEnum):
    """Firm-level permission.

    The frontend's sidebar only distinguishes partner / staff / client; the
    extra grades matter for authorisation, not navigation. See
    ``ui_role`` in app/core/security.py for the mapping.
    """

    OWNER = "OWNER"
    PARTNER = "PARTNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"
    ARTICLE = "ARTICLE"
    BILLING = "BILLING"
    CLIENT = "CLIENT"


class UserStatus(StrEnum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class SubscriptionTier(StrEnum):
    """Matches the four tiers on the pricing page."""

    STARTER = "STARTER"
    GROWTH = "GROWTH"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class EntityType(StrEnum):
    PRIVATE_LIMITED = "PRIVATE_LIMITED"
    PUBLIC_LIMITED = "PUBLIC_LIMITED"
    LLP = "LLP"
    PARTNERSHIP = "PARTNERSHIP"
    PROPRIETORSHIP = "PROPRIETORSHIP"
    HUF = "HUF"
    TRUST = "TRUST"
    SOCIETY = "SOCIETY"
    INDIVIDUAL = "INDIVIDUAL"


class ClientStatus(StrEnum):
    PROSPECT = "PROSPECT"
    ONBOARDING = "ONBOARDING"
    ACTIVE = "ACTIVE"
    DORMANT = "DORMANT"
    EXITED = "EXITED"


class FilingStatus(StrEnum):
    """Shared by GST returns, ITR, ROC forms and calendar tasks.

    Frontend union: ``filed | in-progress | pending | overdue``.
    """

    NOT_STARTED = "NOT_STARTED"
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    FILED = "FILED"
    OVERDUE = "OVERDUE"


class DocumentKind(StrEnum):
    PURCHASE_INVOICE = "PURCHASE_INVOICE"
    SALES_INVOICE = "SALES_INVOICE"
    BANK_STATEMENT = "BANK_STATEMENT"
    TDS_CERTIFICATE = "TDS_CERTIFICATE"
    GST_RETURN = "GST_RETURN"
    AIS_TIS = "AIS_TIS"
    NOTICE = "NOTICE"
    ROC_DOCUMENT = "ROC_DOCUMENT"
    PAYROLL_INPUT = "PAYROLL_INPUT"
    OTHER = "OTHER"


class DocumentStatus(StrEnum):
    """Frontend union: ``queued | extracting | needs-review | verified``."""

    QUEUED = "QUEUED"
    EXTRACTING = "EXTRACTING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"


class LedgerGroup(StrEnum):
    """Top-level classification of a chart-of-accounts entry."""

    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class JournalStatus(StrEnum):
    """Lifecycle of a transaction's ledger mapping.

    ``SUGGESTED`` is the classifier's opinion, ``APPROVED`` a human's decision.
    Both are kept; an override stays visible, which is the point of the trail.
    """

    SUGGESTED = "SUGGESTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class TransactionDirection(StrEnum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class GstReturnType(StrEnum):
    GSTR1 = "GSTR1"
    GSTR3B = "GSTR3B"
    GSTR9 = "GSTR9"
    GSTR9C = "GSTR9C"
    CMP08 = "CMP08"


class ReconRunStatus(StrEnum):
    DRAFT = "DRAFT"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class MatchStatus(StrEnum):
    """Outcome of pairing one books invoice against one GSTR-2B invoice.

    Frontend union:
    ``matched | amount-mismatch | missing-in-books | missing-in-2b``.
    """

    MATCHED = "MATCHED"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    MISSING_IN_BOOKS = "MISSING_IN_BOOKS"
    MISSING_IN_2B = "MISSING_IN_2B"


class AisHead(StrEnum):
    """Heads of income as the Annual Information Statement groups them."""

    SALARY = "SALARY"
    INTEREST = "INTEREST"
    DIVIDEND = "DIVIDEND"
    CAPITAL_GAINS = "CAPITAL_GAINS"
    BUSINESS_RECEIPTS = "BUSINESS_RECEIPTS"
    RENT = "RENT"
    TDS_TCS = "TDS_TCS"
    FOREIGN_REMITTANCE = "FOREIGN_REMITTANCE"
    OTHER = "OTHER"


class NoticeAuthority(StrEnum):
    INCOME_TAX = "INCOME_TAX"
    GST = "GST"
    ROC_MCA = "ROC_MCA"
    TDS_CPC = "TDS_CPC"
    STATE_TAX = "STATE_TAX"
    OTHER = "OTHER"


class NoticeStatus(StrEnum):
    RECEIVED = "RECEIVED"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESPONSE_DRAFTED = "RESPONSE_DRAFTED"
    RESPONSE_FILED = "RESPONSE_FILED"
    HEARING_SCHEDULED = "HEARING_SCHEDULED"
    CLOSED = "CLOSED"


class PayrollStatus(StrEnum):
    DRAFT = "DRAFT"
    CALCULATED = "CALCULATED"
    APPROVED = "APPROVED"
    PAID = "PAID"


class McaFormType(StrEnum):
    AOC_4 = "AOC_4"
    MGT_7 = "MGT_7"
    MGT_7A = "MGT_7A"
    ADT_1 = "ADT_1"
    DIR_3_KYC = "DIR_3_KYC"
    DPT_3 = "DPT_3"
    INC_20A = "INC_20A"
    MSME_1 = "MSME_1"
    PAS_3 = "PAS_3"
    OTHER = "OTHER"


class ObligationFrequency(StrEnum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    HALF_YEARLY = "HALF_YEARLY"
    ANNUAL = "ANNUAL"
    ONE_TIME = "ONE_TIME"


class ObligationCategory(StrEnum):
    GST = "GST"
    INCOME_TAX = "INCOME_TAX"
    TDS = "TDS"
    ROC = "ROC"
    PAYROLL = "PAYROLL"
    OTHER = "OTHER"


class RiskCheck(StrEnum):
    """Which analytical test produced a finding.

    All six are unsupervised or rule-based, which is deliberate: there are no
    labelled fraud examples to train on, and inventing some would make the
    metrics meaningless.
    """

    DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT"
    ROUND_SUM = "ROUND_SUM"
    BENFORD_DEVIATION = "BENFORD_DEVIATION"
    WEEKEND_ENTRY = "WEEKEND_ENTRY"
    VENDOR_CONCENTRATION = "VENDOR_CONCENTRATION"
    OUTLIER_AMOUNT = "OUTLIER_AMOUNT"
    BACKDATED_ENTRY = "BACKDATED_ENTRY"


class RiskSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskStatus(StrEnum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class ThreadChannel(StrEnum):
    CLIENT_PORTAL = "CLIENT_PORTAL"
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"


class ThreadStatus(StrEnum):
    OPEN = "OPEN"
    AWAITING_CLIENT = "AWAITING_CLIENT"
    AWAITING_FIRM = "AWAITING_FIRM"
    CLOSED = "CLOSED"


class MessageAuthorKind(StrEnum):
    FIRM_USER = "FIRM_USER"
    CLIENT_USER = "CLIENT_USER"
    SYSTEM = "SYSTEM"


class ApprovalStatus(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class NotificationType(StrEnum):
    ALERT = "ALERT"
    TASK = "TASK"
    COMPLIANCE = "COMPLIANCE"
    SYSTEM = "SYSTEM"


class NotificationStatus(StrEnum):
    UNREAD = "UNREAD"
    READ = "READ"
    ARCHIVED = "ARCHIVED"


class ReportFormat(StrEnum):
    CSV = "CSV"
    XLSX = "XLSX"
    JSON = "JSON"


class ReportStatus(StrEnum):
    QUEUED = "QUEUED"
    READY = "READY"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class ConsentPurpose(StrEnum):
    DATA_PROCESSING = "DATA_PROCESSING"
    PORTAL_ACCESS = "PORTAL_ACCESS"
    EFILING_AUTHORISATION = "EFILING_AUTHORISATION"
    MARKETING = "MARKETING"


class ConsentStatus(StrEnum):
    GRANTED = "GRANTED"
    WITHDRAWN = "WITHDRAWN"


class AuditOutcome(StrEnum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    DENIED = "DENIED"


class CourtTier(StrEnum):
    """Precedential weight, highest first. Used to rank case-law search hits."""

    SUPREME_COURT = "SUPREME_COURT"
    HIGH_COURT = "HIGH_COURT"
    ITAT = "ITAT"
    CESTAT = "CESTAT"
    AAR = "AAR"
    OTHER = "OTHER"


class LlmProvider(StrEnum):
    OLLAMA = "OLLAMA"
    ANTHROPIC = "ANTHROPIC"
    STUB = "STUB"
