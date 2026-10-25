"""SQLAlchemy models.

Every model is imported here, and this module is what Alembic's ``env.py``
imports to populate ``Base.metadata``. A model that is not reachable from this
file is invisible to autogenerate, so its table silently never gets created -
which is the single most common way an Alembic setup goes wrong.
"""

from app.models.base import Base
from app.models.books import JournalEntry, LedgerAccount
from app.models.compliance import (
    AisLine,
    AisStatement,
    ComplianceObligation,
    ComplianceTask,
    GstReconciliation,
    GstReconciliationLine,
    GstReturn,
    McaFiling,
    PayrollLine,
    PayrollRun,
    TaxNotice,
)
from app.models.intelligence import (
    AiInteraction,
    CaseLawChunk,
    CaseLawDocument,
    LedgerTrainingExample,
    RiskFinding,
)
from app.models.practice import Client, ClientContact, Document, DocumentExtraction
from app.models.tenancy import (
    AuditLog,
    ConsentRecord,
    Firm,
    FirmSettings,
    Notification,
    RefreshToken,
    User,
)
from app.models.workflow import (
    ApprovalRequest,
    CollaborationThread,
    OnboardingRecord,
    Report,
    ReportShare,
    ThreadMessage,
)

__all__ = [
    "AiInteraction",
    "AisLine",
    "AisStatement",
    "ApprovalRequest",
    "AuditLog",
    "Base",
    "CaseLawChunk",
    "CaseLawDocument",
    "Client",
    "ClientContact",
    "CollaborationThread",
    "ComplianceObligation",
    "ComplianceTask",
    "ConsentRecord",
    "Document",
    "DocumentExtraction",
    "Firm",
    "FirmSettings",
    "GstReconciliation",
    "GstReconciliationLine",
    "GstReturn",
    "JournalEntry",
    "LedgerAccount",
    "LedgerTrainingExample",
    "McaFiling",
    "Notification",
    "OnboardingRecord",
    "PayrollLine",
    "PayrollRun",
    "RefreshToken",
    "Report",
    "ReportShare",
    "RiskFinding",
    "TaxNotice",
    "ThreadMessage",
    "User",
]
