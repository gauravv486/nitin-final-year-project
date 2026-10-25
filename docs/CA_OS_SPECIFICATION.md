# CA-OS: AI Operating System for Indian Chartered Accountant Firms
## Master Architecture & Functional Design Specification

---

## 1. Executive Summary & Vision

**CA-OS** (AI Practice ERP for Indian CA Firms) is an enterprise-grade, unified practice management and compliance intelligence platform designed specifically for Indian CA, CS, and Corporate Law firms. Instead of deploying fragmented, isolated applications for billing, task tracking, GST filing, and client messaging, CA-OS operates as a **single interconnected ecosystem**.

A change or input in any module propagates automatically across all layers:
```
Client Onboarding ➔ Folder Auto-Gen ➔ Document Upload ➔ OCR Extraction ➔ Ledger Mapping 
➔ Journal Generation ➔ GST/ITR Updates ➔ Compliance Calendar Triggers ➔ AI Advisory Insights ➔ Client Portal Notifications
```

---

## 2. Platform Architecture & The 5 Product Layers

CA-OS organizes the practice into five distinct, cooperating operating layers:

```mermaid
graph TD
    subgraph Layer 1: Practice OS
        M1[Dashboard & Nav] --> M2[AI Onboarding]
        M2 --> M3[Doc Management]
        M3 --> M4[Bookkeeping Automation]
        M4 --> M13[Collaboration Hub]
    end
    subgraph Layer 2: Compliance OS
        M5[GST Engine] --> M6[Income Tax & AIS]
        M6 --> M7[Notices & Litigation]
        M7 --> M9[Payroll & PF/ESI]
        M9 --> M10[Secretarial MCA/ROC]
        M10 --> M11[Compliance Calendar]
    end
    subgraph Layer 3: AI Intelligence OS
        AI[CA Intelligence Engine] --> OCR[Smart OCR]
        AI --> MAP[Ledger Mapping]
        AI --> DRAFT[Drafting AI]
        AI --> ANALYZE[Predictive RAG]
    end
    subgraph Layer 4: Security OS
        SEC[Security Admin] --> DPDP[DPDP Rules]
        SEC --> AUDIT[Audit Log Registry]
        SEC --> IAM[RBAC Grid]
    end
    subgraph Layer 5: Experience OS
        EXP[Experience Control] --> SET[Branding & Config]
        EXP --> REP[Reports & Export Hub]
    end

    Layer 1 <--> Layer 2
    Layer 2 <--> Layer 3
    Layer 3 <--> Layer 4
    Layer 1 <--> Layer 5
    Layer 2 <--> Layer 5
```

### Layer 1: Practice Operating System
- **Module 1: Dashboard & Navigation**: Command console containing KPI scorecards, workspace switcher, and dynamic widget canvas.
- **Module 2: AI Client Onboarding**: Automatic PAN, GSTIN, and MCA registration fetches, engagement letter generation, and workspace initialization.
- **Module 3: Document Management**: Hierarchical file structure with drag-and-drop uploads, metadata indexing, and versioning.
- **Module 4: Bookkeeping & Accounting Automation**: Bank statement ingestion, automated double-entry ledger mapping, and duplicate transaction detection.
- **Module 13: Client Communication & Collaboration**: Contextual chats, WhatsApp API integrations, billing follow-ups, and encrypted client approval grids.

### Layer 2: Compliance Operating System
- **Module 5: GST**: Reconciliation of GSTR-2B vs. Purchase Register, ITC risk profiling, and filing submission checks.
- **Module 6: Income Tax**: Automated ITR preparation (ITR-1 to 6), AIS/TIS comparison dashboards, and tax optimization recommendations.
- **Module 7: Notices & Litigation**: Notice classification, automated response drafting, and Supreme Court/High Court case law searches.
- **Module 9: Payroll & Statutory Compliance**: ESI, Provident Fund (PF), Professional Tax, and Labour Welfare Fund calculations.
- **Module 10: Corporate Secretarial (MCA / ROC)**: Company incorporation wizard, Board/General Meeting notice and minutes generation, statutory register automation, and form filing trackers.
- **Module 11: Compliance Calendar**: Intelligence calendar engine mapping statutory deadlines to assigned clients and alerts.

### Layer 3: AI Intelligence Operating System
- **Module 12: CA Intelligence Engine**: Core RAG pipeline, ledger mapping classification models, forecasting algorithms, NLP SQL builders, and Indian tax code embedding models.

### Layer 4: Security Operating System
- **Module 14: Security, Access & Administration**: 2FA, zero-knowledge folder vaults, strict DPDP-compliant consent trackers, and immutable audit logs.

### Layer 5: Experience Operating System
- **Module 15: Settings & Configuration**: White-label firm layout, domain routing, integrations dashboard, and subscription managers.
- **Module 16: Reports & Export Hub**: Unified BI aggregator, report templates builder, scheduled recurrent dispatches, secure shared link creators, and PDF watermarker.

---

## 3. Global Data Flow & Cross-Module Automations

### 3.1 Document-to-Report Pipeline
```
[Document Portal] Upload Invoice
       │
       ▼ (OCR & Parser)
[CA Intelligence Engine] Extract fields (Vendor, GSTIN, PAN, Amount)
       │
       ▼ (Automated Ledger Mapping)
[Bookkeeping Engine] Auto-map to Ledger Accounts (e.g., Office Supplies)
       │
       ├───────────────────────────────────┐
       ▼                                   ▼
[GST Engine] Update GSTR-2B Matching    [Income Tax Engine] Recalculate AIS
       │                                   │
       ├───────────────────────────────────┘
       ▼
[Compliance Calendar] Tick off filing milestones / update checklist
       │
       ▼
[Reports & Export Hub] Re-render custom BI dashboards & refresh cached charts
```

### 3.2 Automated Client Onboarding Workflow
```
[AI Onboarding] Fill GSTIN/PAN ➔ Fetch MCA Data ➔ Generate Engagement Letter via LLM
       │
       ▼ (Workspace Provisioning)
[Doc Portal] Auto-create standardized folder structure
       │
       ▼ (Compliance Mapping)
[Compliance Calendar] Auto-bind all statutory deadlines based on client type (Pvt Ltd / LLP)
       │
       ▼ (Access Management)
[Security Console] Register Client Access Logins, send WhatsApp invitation to Client Portal
```

---

## 4. Shared Subsystems & Central AI Brain

### 4.1 CA Intelligence Engine
The central brain is built using **LangGraph** orchestrating multiple specialized agents:
- **OCR Intelligence Agent**: LayoutLMv3 models extracting data from multi-page PDFs, scans, and hand-written invoices.
- **RAG & Case Law Finder**: RAG engine indexing ITAT, CESTAT, High Court, and Supreme Court rulings using semantic embeddings in PGVector.
- **Ledger Classification Agent**: Re-ranks transaction data against standard charts of accounts with confidence scores.
- **Drafting Agent**: Auto-generates responses to notices, meeting minutes, and legal agreements following formal Indian CA/CS writing standards.

### 4.2 Global Command Center (`Ctrl + K`)
A system-wide search bar that fetches cross-module data dynamically:
- **Matches**: Client names, Document titles, PAN/GSTIN IDs, Notices, Tasks, Filings, Invoices, and Roster contacts.
- **Commands**: Typing `> New Client` opens the onboarding wizard; typing `> Export GSTR-2B` triggers the GST export panel directly.

### 4.3 Universal Status System
The entire platform maps status indicators strictly to the following hex color codes:
- **Not Started / Draft**: Gray (`#6B7280`)
- **In Progress / Reviewed**: Blue (`#3B82F6`)
- **Under Review / Approved / Retrying**: Amber (`#F59E0B`)
- **Completed / Delivered / Success**: Green (`#22C55E`)
- **Overdue**: Red (`#EF4444`)
- **Not Applicable / Archived**: Light Gray (`#E5E7EB`)
- **On Hold / Pending**: Purple (`#9333EA`)
- **AI Review Required / Flagged**: Violet (`#7C3AED`)
- **Error / Failed**: Dark Red (`#7F1D1D`)

---

## 5. Module & Feature Specifications

Here we outline the specifications for all 16 integrated modules.

---

### Module 1: Dashboard & Navigation (Layer 1)

#### Business Objective
Provide partners and staff with an immediate, high-fidelity command deck showing client risks, firm billing health, and upcoming statutory filings.

#### Problem Statement
Firms lose track of overall operation statuses, resulting in sudden deadline panic, missed billings, and compliance defaults.

#### User Stories
- As a Managing Partner, I want to see a circular ring of our firm-wide compliance rating so I can judge operational health instantly.
- As a Senior Staff member, I want an urgent alerts feed showing notices received or matching discrepancies requiring immediate review.

#### UI/UX & Layout Design
- **Desktop**: A fixed 240px navy sidebar on the left, top search bar for `Ctrl + K`, and a grid displaying:
  1. Compliance Score Ring (radial progress)
  2. Metric Cards (Active Clients, Pending Filings, Total Billings, Active Litigations)
  3. Upcoming Deadlines timeline (30-day radar)
  4. Activity logs stream
- **Mobile**: Responsive collapsed hamburger menu. Large metrics collapse into single-column vertical cards. Urgent notifications appear as sticky top banners.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS firm_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `GET /api/v1/dashboard/metrics` -> Returns aggregated counters, compliance rating, and upcoming calendar deadlines.
- `POST /api/v1/dashboard/widgets` -> Save dashboard layout customizations.

#### Cross-Module Integrations
- Automatically updates when a filing is completed in the **GST** or **Income Tax** modules.

---

### Module 2: AI Client Onboarding (Layer 1)

#### Business Objective
Streamline client intake from days to under 15 minutes while automatically validating corporate credentials and setting up the client environment.

#### Problem Statement
Manual collection of PAN, GSTIN, bank proofs, and corporate directors' details takes weeks of back-and-forth emails, delaying work start.

#### User Stories
- As a CA Partner, I want to type a client's GSTIN and have the system auto-fetch company name, address, and filing frequency, then generate an engagement letter.

#### UI/UX & Layout Design
- **Desktop**: Wizard layout with progress steps: 1) Identification (GSTIN/PAN input), 2) Auto-fetched registry review, 3) Engagement letter editor (AI-drafted with variable placeholders), 4) Portal invites configurations.
- **Mobile**: Simplified step-by-step swipe layout, optimized for uploading photos of PAN cards directly from phone cameras.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS onboarding_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    pan VARCHAR(10) UNIQUE,
    gstin VARCHAR(15) UNIQUE,
    constitution VARCHAR(100),
    directors JSONB DEFAULT '[]'::jsonb,
    engagement_letter_pdf VARCHAR(512),
    status VARCHAR(50) DEFAULT 'IN PROGRESS', -- Universal Status
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/onboarding/fetch-details` -> Accepts PAN/GSTIN/MCA CIN and queries corporate scrapers/APIs to return company schemas.
- `POST /api/v1/onboarding/generate-letter` -> Accepts terms and triggers central AI brain to write the engagement letter.

#### Cross-Module Integrations
- Once complete, triggers the **Document Portal** to auto-generate folders and the **Compliance Calendar** to register filing tasks.

---

### Module 3: Document Management (Layer 1)

#### Business Objective
Create a secure, search-indexed document storage repository that serves as the single source of truth for client audits.

#### Problem Statement
Clients upload documents across WhatsApp, email, and physical copies, causing loss of source files and audit trail gaps.

#### User Stories
- As a Junior CA, I want to drag and drop a bank statement, see the OCR parse its transactions, and automatically link it to the client's June audit folder.

#### UI/UX & Layout Design
- **Desktop**: Split screen with a folder tree on the left and a file explorer list on the right. Large drag-and-drop zone. Visual indicator showing OCR processing status.
- **Mobile**: Document camera scanner overlay. Scan invoices directly, convert to PDF, and upload to appropriate categories.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size INT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    ocr_payload JSONB DEFAULT '{}'::jsonb,
    category VARCHAR(100) DEFAULT 'UNSORTED',
    status VARCHAR(50) DEFAULT 'NOT STARTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/documents/upload` -> Accepts file upload multi-part data, triggers OCR worker, saves metadata.
- `GET /api/v1/documents/search` -> Performs semantic search on OCR-extracted text.

#### Cross-Module Integrations
- Feeds extracted data directly to the **Bookkeeping Engine** (Module 4) and matches invoices against **GST Ledger** (Module 5).

---

### Module 4: Bookkeeping & Accounting Automation (Layer 1)

#### Business Objective
Automate ledger posting and account matching to produce clean trial balances with minimal human effort.

#### Problem Statement
Manual journal entries and ledger reconciliation consume up to 60% of an article assistant's time.

#### User Stories
- As a Junior CA, I want the system to parse an invoice, recommend ledger accounts (e.g., "Printing & Stationery") with a confidence score, and let me approve it in one click.

#### UI/UX & Layout Design
- **Desktop**: Columns list showing Transaction Date, Description, Extracted Amount, AI Suggested Ledger, Confidence Meter (e.g., 94%), and Approve/Override buttons.
- **Mobile**: Triage swipe interface. Swipe right to approve transaction ledger mapping, swipe left to flag for senior CA review.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS bookkeeping_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    suggested_ledger VARCHAR(100),
    confidence_score NUMERIC(5, 2),
    status VARCHAR(50) DEFAULT 'UNDER REVIEW',
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `GET /api/v1/bookkeeping/suggestions` -> Returns list of unmapped bank/cash transactions with suggested ledgers from AI Brain.
- `POST /api/v1/bookkeeping/approve` -> Saves journal entries and locks reconciliation status.

#### Cross-Module Integrations
- Feeds transaction balances directly into **Reports & Export Hub** (Module 16) and updates **Income Tax AIS** (Module 6).

---

### Module 5: GST Compliance (Layer 2)

#### Business Objective
Automate monthly and quarterly GST reconciliations, maximizing client ITC (Input Tax Credit) and eliminating late fees.

#### Problem Statement
Differences between a client's purchase ledger and the government's GSTR-2B portal report lead to lost ITC or tax notices if reconciled incorrectly.

#### User Stories
- As a CA Partner, I want to see a GSTR-2B reconciliation list highlighting supplier name mismatches and exact difference amounts.

#### UI/UX & Layout Design
- **Desktop**: Side-by-side comparison tables. Left side shows portal invoices; right side shows books invoices. Mismatch lines highlighted in amber. Circular progress charts for filing completion statuses.
- **Mobile**: Grid layout showing client list and colored badges for GSTR-1 and GSTR-3B filings (Green = Filed, Amber = Pending, Red = Overdue).

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS gst_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    gst_period VARCHAR(7) NOT NULL, -- YYYY-MM
    portal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    books_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    mismatches JSONB NOT NULL DEFAULT '[]'::jsonb,
    itc_at_risk NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'IN PROGRESS',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/gst/reconcile` -> Triggers reconciliation comparison between portal JSON/Excel and accounting ledgers.
- `GET /api/v1/gst/summary` -> Returns aggregate stats for all clients under the firm's portfolio.

#### Cross-Module Integrations
- Unreconciled vendors trigger automated task follow-ups in the **Client Communication Hub** (Module 13).

---

### Module 6: Income Tax Compliance (Layer 2)

#### Business Objective
Provide complete automation of the income tax workflow, matching tax logs against AIS/TIS figures.

#### Problem Statement
Clients face penalties because information in ITR filings does not match the IRS/Income Tax portal AIS (Annual Information Statement).

#### User Stories
- As a CA, I want to upload a client's AIS file and compare interest, mutual fund, and salary lines against their book entries, flagging discrepancies automatically.

#### UI/UX & Layout Design
- **Desktop**: Three-column comparison layout (AIS Records, Books Ledger, Discrepancies) with filterable sections (Salary, Business, Capital Gains, Others).
- **Mobile**: Summary view showing ITR filing progress and estimated tax savings metrics.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS it_ais_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assessment_year VARCHAR(9) NOT NULL, -- e.g., 2026-27
    ais_data JSONB NOT NULL,
    books_comparison JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'NOT STARTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/tax/parse-ais` -> Ingests PDF/JSON AIS, runs extraction, and runs match query against local trial balance.
- `GET /api/v1/tax/recommendations` -> Returns AI suggestions for deductions and tax planning.

#### Cross-Module Integrations
- High tax liabilities trigger notifications in **Client Communication** and are compiled inside **Reports Hub** (Module 16).

---

### Module 7: Notices & Litigation (Layer 2)

#### Business Objective
Manage statutory notices from direct and indirect tax departments, automating case research and response writing.

#### Problem Statement
Firms fail to track notice reply deadlines, causing clients to default on hearings, which leads to heavy penalties.

#### User Stories
- As a CA Partner, I want to upload a notice PDF, have the AI identify the section (e.g., "Section 143(1)"), find relevant tax court cases, and draft a response letter.

#### UI/UX & Layout Design
- **Desktop**: Grid showing all active disputes with remaining days, notice section, and a split screen for drafting: Left side shows notice metadata and case laws; right side holds the interactive AI document editor.
- **Mobile**: Simple card feed. View notice summary, remaining response days, and click to share drafts with clients via WhatsApp.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS tax_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    notice_number VARCHAR(100) UNIQUE NOT NULL,
    issuing_authority VARCHAR(100) NOT NULL, -- e.g., Income Tax Dept
    section_code VARCHAR(100),
    due_date DATE NOT NULL,
    scanned_text TEXT,
    ai_draft_response TEXT,
    status VARCHAR(50) DEFAULT 'UNDER REVIEW',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/litigation/analyze-notice` -> Submits notice file, returns department details, section codes, due date, and AI draft reply.
- `GET /api/v1/litigation/cases` -> Queries case law database for relevant judgements.

#### Cross-Module Integrations
- Notice deadlines automatically update the **Compliance Calendar** (Module 11) and log actions in the **Global Activity Timeline**.

---

### Module 9: Payroll & Statutory Compliance (Layer 2)

#### Business Objective
Ensure error-free payroll operations while keeping clients 100% compliant with PF, ESI, and labor laws.

#### Problem Statement
Payroll adjustments, new hires, and shifting professional tax slabs across Indian states create calculation compliance risks.

#### User Stories
- As an HR/Payroll Admin in the firm, I want to upload attendance sheets, auto-compute PF/ESI, and generate compliant payslips with local Professional Tax slabs applied.

#### UI/UX & Layout Design
- **Desktop**: Tabbed view: 1) Employee Roster, 2) Monthly Salary Sheet, 3) PF/ESI Challans, 4) Compliance filings. Interactive graph showing total CTC vs PF contributions.
- **Mobile**: Quick approval dashboard. Swipe to authorize employee payroll lists and dispatch Payslips.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    payroll_period VARCHAR(7) NOT NULL, -- YYYY-MM
    total_ctc NUMERIC(15, 2) NOT NULL,
    pf_contribution NUMERIC(15, 2) NOT NULL,
    esi_contribution NUMERIC(15, 2) NOT NULL,
    pt_deductions NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'NOT STARTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/payroll/calculate` -> Ingests employee details and generates payslip and statutory contribution lists.
- `GET /api/v1/payroll/challans` -> Returns formatted PF/ESI text files ready for portal uploads.

#### Cross-Module Integrations
- Payroll records feed into **Bookkeeping Journals** (Module 4) to update salary and statutory liability accounts.

---

### Module 10: Corporate Secretarial (MCA / ROC) (Layer 2)

#### Business Objective
Manage corporate filings, meeting documentation, and statutory registers under the Companies Act 2013.

#### Problem Statement
Filing forms (AOC-4, MGT-7) late with the Registrar of Companies (ROC) results in severe daily penalties and directors' disqualification.

#### User Stories
- As a CS (Company Secretary), I want to trigger a board meeting flow, generate notices, draft minutes automatically from agenda templates, and track the status of related MCA e-forms.

#### UI/UX & Layout Design
- **Desktop**: Grid showing clients, their corporate secretarial filing stages (e.g., AGM, Annual Filings), and buttons to generate documents or check MCA portal queue.
- **Mobile**: Timeline view of company secretarial milestones and quick sign-off buttons for resolutions.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS mca_filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    form_type VARCHAR(50) NOT NULL, -- e.g., AOC-4, MGT-7
    financial_year VARCHAR(9) NOT NULL,
    submission_date DATE,
    srn VARCHAR(50), -- Service Request Number
    status VARCHAR(50) DEFAULT 'NOT STARTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/secretarial/generate-minutes` -> Generates meeting minutes document based on company details and agenda items.
- `GET /api/v1/secretarial/mca-status` -> Tracks MCA portal submission and updates SRN logs.

#### Cross-Module Integrations
- Form filing deadlines sync to the **Compliance Calendar** (Module 11) and updates the **Security Access Log** (Module 14) upon digital signing.

---

### Module 11: Compliance Calendar (Layer 2)

#### Business Objective
Ensure zero missed statutory deadlines across the entire client base.

#### Problem Statement
Tracking different tax deadlines for hundreds of clients in spreadsheets is error-prone, leading to missed dates and costly penalties.

#### User Stories
- As a Senior CA, I want a single calendar showing GST, Income Tax, PF, ESI, and ROC filing dates color-coded by urgency and client counts.

#### UI/UX & Layout Design
- **Desktop**: Monthly calendar layout. Deadlines labeled with type (GST/IT/PF) and indicators showing client completion progress. Side panel displays urgent tasks.
- **Mobile**: Agenda list view. Shows upcoming deadlines for the next 7 days in chronological order with easy-to-tap filters.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS compliance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    deadline_date DATE NOT NULL,
    obligation_type VARCHAR(100) NOT NULL, -- e.g., GSTR-3B, TDS Q1
    assigned_staff_id UUID REFERENCES users(id),
    completed_count INT NOT NULL DEFAULT 0,
    total_clients INT NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'IN PROGRESS',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `GET /api/v1/calendar/deadlines` -> Returns deadline events based on selected month, filterable by compliance category.
- `POST /api/v1/calendar/extend` -> Updates due dates in bulk for extensions announced by the Finance Ministry.

#### Cross-Module Integrations
- Triggers push notifications and updates the **Dashboard Alerts** (Module 1) as deadlines draw near.

---

### Module 12: AI Assistant & Insights (Layer 3)

#### Business Objective
Provide natural-language access to compliance data and offer proactive advice, reducing time spent on report analysis.

#### Problem Statement
Finding specific tax figures or cross-checking rules requires digging through complex database tables and multi-page documents.

#### User Stories
- As a Managing Partner, I want to type "Which clients have unclaimed GST credit above 5 Lakhs?" and receive a tabular report with active links.

#### UI/UX & Layout Design
- **Desktop**: Conversational chat layout with a persistent right sidebar showing parsed parameters, source files references, and relevant section references.
- **Mobile**: Dynamic conversational voice-active screen. Double tap to speak, with real-time text-to-speech feedback.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    feedback_score INT, -- 1-5 scale
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/ai/query` -> Ingests user message, runs RAG query over client database and case law, returns text and data array.
- `POST /api/v1/ai/feedback` -> Logs user review score of AI output.

#### Cross-Module Integrations
- Queries data from the **GST, Bookkeeping, and Income Tax** schemas and displays insights in the **Reports Hub** (Module 16).

---

### Module 13: Client Communication & Collaboration (Layer 1)

#### Business Objective
Centralize client communications, file sharing, approvals, and invoice follow-ups in a secure, audit-ready hub.

#### Problem Statement
Scattered client conversations on WhatsApp, email, and phone calls make tracking approvals difficult and break compliance audit logs.

#### User Stories
- As a Senior Staff member, I want to share a tax return calculation sheet, request client approval, and receive an automated signature log on the document.

#### UI/UX & Layout Design
- **Desktop**: Dual pane interface: Left pane displays client channels (WhatsApp, Client Portal, Team); Right pane shows the thread, document attachment history, approval buttons, and client payment links.
- **Mobile**: Chat-first interface resembling WhatsApp, but with direct access to attachment folders and quick-reply action cards.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS collaboration_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL DEFAULT 'CLIENT_PORTAL', -- WHATSAPP, EMAIL
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    approval_status VARCHAR(50) DEFAULT 'NOT APPLICABLE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/collaboration/send-message` -> Sends text and attachment across specified channels.
- `POST /api/v1/collaboration/request-approval` -> Triggers a secure link request for client authorization.

#### Cross-Module Integrations
- Approval actions update the status of items in **GST, Income Tax**, and the **Reports Hub**.

---

### Module 14: Security, Access & Administration (Layer 4)

#### Business Objective
Enforce complete data privacy, encryption, 2FA, DPDP compliance, and granular authorization controls across all files.

#### Problem Statement
CAs handle sensitive corporate and financial keys; leaks or unauthorized staff access can lead to lawsuits and loss of license.

#### User Stories
- As a Super Admin, I want to grant a junior assistant read-only access to Client A for 7 days, and have access expire automatically.

#### UI/UX & Layout Design
- **Desktop**: Grid matrix showing roles (Partner, Staff, Article, Client) vs modules. Checkboxes allow editing permissions. Display active login locations and detailed audit logs.
- **Mobile**: Dynamic security console showing active login sessions with "Revoke Access" buttons.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- e.g., FILE_DOWNLOAD, ROLE_UPDATE
    resource_id VARCHAR(100),
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/security/grant-access` -> Assigns roles or temporary client authorizations.
- `GET /api/v1/security/audit-logs` -> Fetches log history filterable by IP or User.

#### Cross-Module Integrations
- Every single API route queries this module's logic to check access tokens before returning content.

---

### Module 15: Settings & Configuration (Layer 5)

#### Business Objective
Enable firms to fully white-label, configure, and customize the platform to fit their operations.

#### Problem Statement
CA firms want the client portal to display their own branding (logo, colors, domain) rather than a generic third-party SaaS look.

#### User Stories
- As an Admin, I want to upload our firm logo, select our primary color, and configure the automatic notification rules for GST late alerts.

#### UI/UX & Layout Design
- **Desktop**: Left panel settings directory (Firm Info, White-Label Branding, Integrations, Notification Rules, AI Fine-Tuning). Right panel config editor with dynamic previews.
- **Mobile**: Grouped configuration settings list. Collapses complex options into toggle switches and file input drawers.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS firm_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    branding_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `POST /api/v1/settings/save-branding` -> Saves design assets, primary hex colors, and custom fonts.
- `GET /api/v1/settings/details` -> Returns custom configuration details for UI setup.

#### Cross-Module Integrations
- Feeds color tokens directly to **Reports & Export Hub** (Module 16) to apply whitelabeling to exports.

---

### Module 16: Reports & Export Hub (Layer 5)

#### Business Objective
Act as the central business intelligence engine, aggregating data across all modules into clean, signed PDFs.

#### Problem Statement
Partners spend hours manually compiling Excel and PDF summaries from accounting, GST, and litigation modules for client meetings.

#### User Stories
- As a CA Partner, I want to generate a multi-module report (GST, Profit & Loss, Notice Status) signed with our firm's digital certificate and password-protected for the client.

#### UI/UX & Layout Design
- **Desktop**: Tabbed layout (KPI Analytics, Saved Reports Library, AI Prompt Compiler, Recurrent Schedules, Audit Logs, Custom White-Label Config). Layout matches the current [ReportsExportHub.tsx](file:///Users/harshsharma/Downloads/ca-ai-compliance-website/components/reports/ReportsExportHub.tsx) implementation.
- **Mobile**: Grid with dashboard stats and buttons to share pre-generated reports to clients. Shows warning blocker on advanced setup screens.

#### Database Schema
```sql
CREATE TABLE IF NOT EXISTS rep_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES rep_categories(id),
    data_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### API Design
- `GET /api/v1/reports/export` -> Streams report buffer (PDF, CSV, Excel) with cryptographic certificate signature.
- `POST /api/v1/reports/share` -> Generates an expiry-restricted secure shared link and access password.

#### Cross-Module Integrations
- Fetches ledger values from **Bookkeeping** (Module 4), compliance statuses from **GST** (Module 5), and notice updates from **Litigation** (Module 7).

---

## 6. Shared Resilience, Error, & Fallback Controls

Across the entire platform, the following standard controls are enforced:

### 6.1 AI Latency & Outage Fallback System
If the CA Intelligence Engine encounters a model outage or API rate limits:
1. **Explain the Failure**: Display a message indicating the service is temporarily overloaded or unavailable.
2. **Provide Manual Override**: Switch to a manual form builder allowing users to enter/select metadata manually.
3. **Log & Sync**: Cache input data in local storage and retry background synchronization once the API connection recovers.

### 6.2 Viewport Experience Blocker
For complex grids and configurations (e.g., advanced billing layouts, multi-column bank recons):
- Detect window width. If below `768px`, overlays a centered dialog box warning the user: `"Please use a desktop device for the best experience."`
- Keeps primary client communication, document scanning, and tasks fully accessible.

---

## 7. Production Readiness Checklist

### 7.1 Security & DPDP Compliance
- [ ] Enforce HTTPS-only routes with HSTS headers.
- [ ] Implement AES-256 encryption for client-uploaded financial documents in object storage.
- [ ] Build user-consent checkboxes for DPDP-compliant WhatsApp data retrieval.
- [ ] Enforce database row-level security (RLS) based on `firm_id` and assigned roles.

### 7.2 Scalability & Performance
- [ ] Cache dashboard reports in Redis with a 15-minute TTL.
- [ ] Use Elasticsearch/Vector indexing for document text searches.
- [ ] Deploy serverless queues (e.g., BullMQ/Celery) for asynchronous OCR processing and email dispatches.
- [ ] Configure database connection pooling with PgBouncer.

### 7.3 Testing Scenarios
- [ ] Unit test the ledger-mapping algorithm using mock banking transactions.
- [ ] Integration test the client onboarding flow from details lookup to folder provisioning.
- [ ] Verify the universal status badges map to the defined hex values across light/dark themes.
- [ ] Verify that password-protected PDF downloads can be opened and validate the signature hash.
