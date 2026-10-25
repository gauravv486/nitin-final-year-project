-- ==========================================
-- PHYSICAL DATABASE SCHEMA FOR CA·OS SYSTEM
-- ==========================================

-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ------------------------------------------
-- 1. CORE SYSTEM SHELL TABLES
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    pan VARCHAR(10) UNIQUE NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    gstin VARCHAR(15) UNIQUE CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    address JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    pan VARCHAR(10) NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    gstin VARCHAR(15) CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    email VARCHAR(255),
    phone VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS firm_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'ARTICLE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_firm UNIQUE (user_id, firm_id)
);

-- Indexing for tenant validations
CREATE INDEX idx_clients_firm_id ON clients(firm_id);
CREATE INDEX idx_firm_access_user_id ON firm_access(user_id);

-- ------------------------------------------
-- 2. CLIENT ONBOARDING & PROFILES
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID UNIQUE NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    entity_type VARCHAR(100) NOT NULL,
    constitution_of_business VARCHAR(100),
    date_of_incorporation TIMESTAMP WITH TIME ZONE,
    turnover_range VARCHAR(50),
    employee_count INT NOT NULL DEFAULT 0,
    industry_sector VARCHAR(100),
    risk_score VARCHAR(50) NOT NULL DEFAULT 'LOW',
    risk_notes TEXT,
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gst_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_profile_id UUID UNIQUE NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    gstin VARCHAR(15) UNIQUE NOT NULL CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    registration_date TIMESTAMP WITH TIME ZONE,
    taxpayer_type VARCHAR(100),
    gst_status VARCHAR(50) NOT NULL,
    filing_frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    jurisdiction_state VARCHAR(150),
    jurisdiction_center VARCHAR(150),
    last_lookup_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS pan_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_profile_id UUID UNIQUE NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    pan VARCHAR(10) UNIQUE NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    pan_status VARCHAR(50) NOT NULL,
    holder_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    aadhaar_seeding VARCHAR(50),
    last_lookup_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS cin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_profile_id UUID UNIQUE NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    cin VARCHAR(21) UNIQUE NOT NULL CHECK (cin ~ '^[U|L][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$'),
    cin_status VARCHAR(50) NOT NULL,
    authorized_capital DECIMAL(18,2) NOT NULL,
    paid_up_capital DECIMAL(18,2) NOT NULL,
    roc_office VARCHAR(150),
    class_of_company VARCHAR(100),
    last_lookup_at TIMESTAMP WITH TIME ZONE
);

-- ------------------------------------------
-- 3. DOCUMENT MANAGEMENT & SEARCH TRIGGERS
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_folder UNIQUE (firm_id, client_profile_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
    client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    md5_checksum VARCHAR(32) NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    active_legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Setup full-text search indexing on files
ALTER TABLE documents ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION documents_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector := to_tsvector('english', coalesce(new.name,''));
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_documents_update BEFORE INSERT OR UPDATE
ON documents FOR EACH ROW EXECUTE FUNCTION documents_search_trigger();

CREATE INDEX idx_documents_search ON documents USING gin(search_vector);

-- ------------------------------------------
-- 4. BOOKKEEPING RANGE PARTITIONS
-- ------------------------------------------

-- Table structures for partitioned transaction logs
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    branch_name VARCHAR(255),
    opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0.0,
    closing_balance DECIMAL(18,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    statement_id UUID,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_narration TEXT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_num VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, transaction_date)
) PARTITION BY RANGE (transaction_date);

-- Seed monthly partitions for transaction ledger (FY 2026)
CREATE TABLE transactions_fy2026_m06 PARTITION OF transactions
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE transactions_fy2026_m07 PARTITION OF transactions
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

-- ------------------------------------------
-- 5. LEGAL PRECEDE & VECTOR EMBEDDINGS
-- ------------------------------------------

-- Case Law master and partitioned vector lookup indexes
CREATE TABLE IF NOT EXISTS case_laws (
    id UUID NOT NULL,
    citation VARCHAR(255) UNIQUE NOT NULL,
    case_name VARCHAR(512) NOT NULL,
    court VARCHAR(255) NOT NULL,
    decision_date TIMESTAMP WITH TIME ZONE NOT NULL,
    sections VARCHAR(100)[] NOT NULL,
    issue TEXT NOT NULL,
    outcome VARCHAR(100) NOT NULL,
    full_text TEXT NOT NULL,
    headnotes TEXT,
    ratios TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, decision_date)
) PARTITION BY RANGE (decision_date);

CREATE TABLE case_laws_y2026 PARTITION OF case_laws
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS case_law_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_law_id UUID NOT NULL,
    embedding vector(1536) NOT NULL
);

-- Fast cosine similarity indexing (HNSW)
CREATE INDEX idx_case_law_embeddings_hnsw ON case_law_embeddings USING hnsw (embedding vector_cosine_ops);

-- ==========================================
-- 6. MODULE 10: CORPORATE SECRETARIAL (MCA / ROC)
-- ==========================================

CREATE TABLE IF NOT EXISTS sec_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cin VARCHAR(21) UNIQUE NOT NULL CHECK (cin ~ '^[U|L][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$'),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    class_of_company VARCHAR(100) NOT NULL,
    registered_office JSONB NOT NULL,
    roc_office VARCHAR(150) NOT NULL,
    date_of_incorporation TIMESTAMP WITH TIME ZONE NOT NULL,
    authorized_capital DECIMAL(18,2) NOT NULL,
    paid_up_capital DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_directors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    din VARCHAR(8) NOT NULL CHECK (din ~ '^[0-9]{8}$'),
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    resignation_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    pan VARCHAR(10) NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_company_din UNIQUE (company_id, din)
);

CREATE TABLE IF NOT EXISTS sec_shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    pan VARCHAR(10) NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    total_shares BIGINT NOT NULL CHECK (total_shares >= 0),
    share_type VARCHAR(50) NOT NULL DEFAULT 'EQUITY',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_board_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    meeting_number INT NOT NULL,
    meeting_type VARCHAR(50) NOT NULL DEFAULT 'BOARD_MEETING',
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location_type VARCHAR(50) NOT NULL DEFAULT 'VENUE', -- VENUE, VC
    venue TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, HELD, CANCELLED, POSTPONED
    chairman_id UUID REFERENCES sec_directors(id) ON DELETE SET NULL,
    quorum_required INT NOT NULL CHECK (quorum_required > 0),
    quorum_present INT CHECK (quorum_present >= 0),
    notices_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_meeting_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES sec_board_meetings(id) ON DELETE CASCADE,
    director_id UUID NOT NULL REFERENCES sec_directors(id) ON DELETE CASCADE,
    attendance_status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- PRESENT, ABSENT, LEAVE_OF_ABSENCE
    mode_of_attendance VARCHAR(50) NOT NULL DEFAULT 'PHYSICAL', -- PHYSICAL, VC
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_meeting_director UNIQUE (meeting_id, director_id)
);

CREATE TABLE IF NOT EXISTS sec_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES sec_board_meetings(id) ON DELETE SET NULL,
    resolution_number VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'ORDINARY', -- ORDINARY, SPECIAL
    category VARCHAR(150) NOT NULL, -- Bank Account Opening, Director Appointment, etc.
    agenda_item TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    draft_content TEXT NOT NULL,
    finalized_content TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, REVIEWED, CIRCULATED, APPROVED, SIGNED, MINUTED
    generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_company_resolution UNIQUE (company_id, resolution_number)
);

CREATE TABLE IF NOT EXISTS sec_agm_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    date_of_agm TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT NOT NULL,
    clear_days_count INT NOT NULL CHECK (clear_days_count >= 0),
    notice_sent_date DATE NOT NULL,
    e_voting_start TIMESTAMP WITH TIME ZONE,
    e_voting_end TIMESTAMP WITH TIME ZONE,
    proxy_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    document_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES sec_board_meetings(id) ON DELETE CASCADE,
    meeting_type VARCHAR(50) NOT NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    current_version INT NOT NULL DEFAULT 1,
    final_signed_key VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_mca_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    form_type VARCHAR(50) NOT NULL, -- AOC-4, MGT-7, DIR-12, etc.
    filing_year VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    form_data JSONB NOT NULL,
    signed_dsc_user_id UUID,
    is_xbrl BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_srn_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES sec_mca_forms(id) ON DELETE CASCADE,
    srn VARCHAR(9) UNIQUE NOT NULL CHECK (srn ~ '^[A-Z][0-9]{8}$'),
    amount_paid DECIMAL(10,2) NOT NULL CHECK (amount_paid >= 0),
    challan_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PAYMENT_DONE',
    error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_statutory_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    register_type VARCHAR(50) NOT NULL, -- MGT-1, MBP-1, MBP-4, CHG-7, etc.
    records_data JSONB NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    last_updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_share_capital_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    class_of_shares VARCHAR(100) NOT NULL,
    authorized_shares BIGINT NOT NULL CHECK (authorized_shares >= 0),
    authorized_value DECIMAL(18,2) NOT NULL CHECK (authorized_value >= 0),
    paid_up_shares BIGINT NOT NULL CHECK (paid_up_shares >= 0),
    paid_up_value DECIMAL(18,2) NOT NULL CHECK (paid_up_value >= 0),
    transaction_type VARCHAR(50) NOT NULL, -- ALLOTMENT, TRANSFER, SPLIT, BUYBACK
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    charge_id VARCHAR(100) NOT NULL,
    amount DECIMAL(18,2) NOT NULL CHECK (amount >= 0),
    lender_name VARCHAR(255) NOT NULL,
    asset_details TEXT NOT NULL,
    creation_date DATE NOT NULL,
    modification_date DATE,
    satisfaction_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, SATISFIED, MODIFIED
    chg_1_srn VARCHAR(9),
    chg_4_srn VARCHAR(9),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_compliance_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    description TEXT NOT NULL,
    risk_category VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    assigned_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_director_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES sec_directors(id) ON DELETE CASCADE,
    kyc_due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, OVERDUE
    pan_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_secretarial_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    audit_year VARCHAR(10) NOT NULL,
    lead_auditor_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, SIGNED
    observations JSONB NOT NULL,
    risks_flagged INT NOT NULL DEFAULT 0,
    report_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_corporate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date_of_event DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    workflows_state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_compliance_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    risk_type VARCHAR(100) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors JSONB NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS sec_secretarial_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    client_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexing for fast search queries
CREATE INDEX idx_sec_directors_din ON sec_directors(din);
CREATE INDEX idx_sec_resolutions_company_status ON sec_resolutions(company_id, status);
CREATE INDEX idx_sec_mca_forms_company_type ON sec_mca_forms(company_id, form_type);
CREATE INDEX idx_sec_compliance_calendar_due ON sec_compliance_calendar(due_date);
CREATE INDEX idx_sec_director_kyc_status ON sec_director_kyc(status);
CREATE INDEX idx_sec_charges_company ON sec_charges(company_id);

-- ==========================================
-- 7. MODULE 11: COMPLIANCE CALENDAR & ALERTS
-- ==========================================

CREATE TABLE IF NOT EXISTS cal_compliance_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL, -- E.g., GSTR-3B, regular ITR-6
    name VARCHAR(255) NOT NULL,
    authority VARCHAR(100) NOT NULL, -- GSTN, CBDT, CBIC, MCA, EPFO, ESIC, etc.
    category VARCHAR(100) NOT NULL, -- GST, INCOME_TAX, TDS, ROC, PF, ESI, PT, LWF, CUSTOM
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_deadline_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_type_id UUID NOT NULL REFERENCES cal_compliance_types(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL, -- MONTHLY, QUARTERLY, ANNUALLY, ONE_TIME
    day_of_month INT,
    months_after_fy INT,
    grace_period_days INT NOT NULL DEFAULT 0,
    penalty_per_day DECIMAL(10,2) NOT NULL DEFAULT 100.00
);

CREATE TABLE IF NOT EXISTS cal_compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    compliance_type_id UUID NOT NULL REFERENCES cal_compliance_types(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, OVERDUE
    assigned_user_id UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_government_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_type_id UUID NOT NULL REFERENCES cal_compliance_types(id) ON DELETE CASCADE,
    original_due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    extended_due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    circular_number VARCHAR(100) NOT NULL,
    official_link TEXT,
    extended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_event_id UUID NOT NULL REFERENCES cal_compliance_events(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    trigger_time TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- CRITICAL, HIGH, MEDIUM, LOW
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, SNOOZED, ACKNOWLEDGED, FAILED
    snooze_until TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_alert_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- IN_APP, EMAIL, WHATSAPP, SMS, PUSH
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cal_alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES cal_alerts(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES cal_alert_channels(id) ON DELETE RESTRICT,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS cal_alert_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(150) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    body_format TEXT NOT NULL,
    is_dlt_approved BOOLEAN NOT NULL DEFAULT FALSE,
    dlt_template_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS cal_compliance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    calculation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    gst_score DECIMAL(5,2) NOT NULL,
    tds_score DECIMAL(5,2) NOT NULL,
    tax_score DECIMAL(5,2) NOT NULL,
    roc_score DECIMAL(5,2) NOT NULL,
    pf_esi_score DECIMAL(5,2) NOT NULL,
    doc_submission_score DECIMAL(5,2) NOT NULL,
    notice_response_score DECIMAL(5,2) NOT NULL,
    total_score DECIMAL(5,2) NOT NULL,
    grade VARCHAR(50) NOT NULL -- EXCELLENT, GOOD, FAIR, POOR, CRITICAL
);

CREATE TABLE IF NOT EXISTS cal_client_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    score_history JSONB NOT NULL,
    current_grade VARCHAR(50) NOT NULL,
    trend VARCHAR(50) NOT NULL DEFAULT 'STABLE', -- UP, DOWN, STABLE
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_compliance_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    risk_type VARCHAR(100) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_factors JSONB NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS cal_capacity_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date TIMESTAMP WITH TIME ZONE NOT NULL,
    department VARCHAR(100) NOT NULL,
    total_load INT NOT NULL,
    staff_count INT NOT NULL,
    avg_utilization DECIMAL(5,2) NOT NULL,
    capacity_status VARCHAR(50) NOT NULL -- UNDER_UTILIZED, BALANCED, OVERLOADED
);

CREATE TABLE IF NOT EXISTS cal_staff_workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_deadline_count INT NOT NULL,
    max_capacity INT NOT NULL,
    workload_percentage DECIMAL(5,2) NOT NULL,
    assigned_events JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cal_sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_type_id UUID NOT NULL REFERENCES cal_compliance_types(id) ON DELETE CASCADE,
    creation_to_assignment_hrs INT NOT NULL,
    assignment_to_start_hrs INT NOT NULL,
    start_to_completion_hrs INT NOT NULL,
    escalation_rules JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS cal_holiday_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(10) NOT NULL,
    holiday_date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_national_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_state_date UNIQUE (state_code, holiday_date)
);

CREATE TABLE IF NOT EXISTS cal_communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(50) NOT NULL, -- INBOUND, OUTBOUND
    message_body TEXT NOT NULL,
    delivery_receipt TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes
CREATE INDEX idx_cal_events_due_status ON cal_compliance_events(due_date, status);
CREATE INDEX idx_cal_alerts_trigger_status ON cal_alerts(trigger_time, status);
CREATE INDEX idx_cal_scores_company_date ON cal_compliance_scores(company_id, calculation_date);
CREATE INDEX idx_cal_communication_logs_company ON cal_communication_logs(company_id);

-- =========================================================================
-- MODULE 13: CLIENT COMMUNICATION & COLLABORATION TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS collab_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    company_id UUID REFERENCES sec_companies(id) ON DELETE CASCADE,
    module_name VARCHAR(100) NOT NULL, -- GST, Income Tax, Corporate Secretarial, etc.
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'NORMAL', -- URGENT, HIGH, NORMAL, LOW
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, OVERDUE
    subtasks JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { id, title, completed }
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { fileName, fileUrl }
    time_spent_mins INT NOT NULL DEFAULT 0,
    sla_limit_hrs INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_id UUID NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
    CONSTRAINT unique_dependency UNIQUE (predecessor_id, successor_id)
);

CREATE TABLE IF NOT EXISTS collab_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- PORTAL, EMAIL, WHATSAPP
    category VARCHAR(100) NOT NULL, -- TAX_ADVISORY, DOCUMENT_REQUEST, FILING_QUERY, PAYMENT_DISPUTE, ACCOUNT_ACCESS, GENERAL
    priority VARCHAR(50) NOT NULL DEFAULT 'NORMAL', -- URGENT, HIGH, NORMAL, LOW
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    csat_score INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS collab_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES collab_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- STAFF, CLIENT
    message_body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_ticket_sla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE NOT NULL REFERENCES collab_tickets(id) ON DELETE CASCADE,
    sla_limit_mins INT NOT NULL,
    response_due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_level INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collab_chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    room_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT', -- DIRECT, GROUP, BROADCAST
    company_id UUID REFERENCES sec_companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES collab_chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- STAFF, CLIENT
    message_body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- SENT, DELIVERED, READ
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES collab_chat_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    size_bytes INT NOT NULL
);

CREATE TABLE IF NOT EXISTS collab_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, VIEWED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    billing_type VARCHAR(50) NOT NULL, -- SERVICE, RETAINER, MILESTONE, HOURLY
    amount DECIMAL(15,2) NOT NULL,
    tax_gst DECIMAL(15,2) NOT NULL, -- 18% Professional services tax
    total_amount DECIMAL(15,2) NOT NULL,
    payment_link TEXT,
    due_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES collab_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS collab_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES collab_invoices(id) ON DELETE CASCADE,
    amount_paid DECIMAL(15,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    gateway_reference VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS'
);

CREATE TABLE IF NOT EXISTS collab_client_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    csat_score DECIMAL(3,2) DEFAULT 5.00,
    billing_timeliness_score INT NOT NULL DEFAULT 100,
    doc_submission_score INT NOT NULL DEFAULT 100,
    communication_frequency_score INT NOT NULL DEFAULT 100,
    query_resolution_score INT NOT NULL DEFAULT 100,
    compliance_health_score INT NOT NULL DEFAULT 100,
    relationship_grade VARCHAR(50) NOT NULL DEFAULT 'HEALTHY', -- EXCELLENT, HEALTHY, NEEDS_ATTENTION, AT_RISK, CRITICAL
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_client_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- CLIENT_CREATED, DOCUMENT_UPLOADED, GST_FILED, NOTICE_RECEIVED, TICKET_RAISED, INVOICE_SENT, PAYMENT_RECEIVED, TASK_COMPLETED
    description TEXT NOT NULL,
    metadata JSONB, -- Contextual details like task ID, invoice ID, amount, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(100) NOT NULL, -- GST_FILING, ITR_FILING, INVOICE, AUDIT_REPORT, NOTICE, DOCUMENT, ROC_FILING, FINANCIAL_STATEMENT
    target_id UUID NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, REVIEW, APPROVED, FINALIZE, ARCHIVED
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL DEFAULT 'STAFF', -- STAFF, CLIENT
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    publisher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes for Module 13
CREATE INDEX idx_collab_tasks_company_due ON collab_tasks(company_id, due_date);
CREATE INDEX idx_collab_tasks_assignee_status ON collab_tasks(assignee_id, status);
CREATE INDEX idx_collab_tickets_company_status ON collab_tickets(company_id, status);
CREATE INDEX idx_collab_chat_messages_room ON collab_chat_messages(room_id);
CREATE INDEX idx_collab_invoices_company_status ON collab_invoices(company_id, status);
CREATE INDEX idx_collab_client_timeline_company_event ON collab_client_timeline(company_id, event_type);
CREATE INDEX idx_collab_approvals_target ON collab_approvals(target_type, target_id);

-- =========================================================================
-- MODULE 14: SECURITY, ACCESS & ADMINISTRATION TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) UNIQUE NOT NULL, -- SUPER_ADMIN, ADMIN, CA_PARTNER, etc.
    permissions_matrix JSONB NOT NULL, -- { module: { action: boolean } }
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_client_access_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    permission_matrix JSONB NOT NULL, -- custom overrides
    expires_at TIMESTAMP WITH TIME ZONE, -- for time-limited access
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    module_name VARCHAR(100) NOT NULL,
    rationale TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(150),
    role_name VARCHAR(100),
    action_type VARCHAR(100) NOT NULL, -- LOGIN, LOGOUT, CREATE, MODIFY, DELETE, EXPORT
    module_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    record_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45) NOT NULL,
    device_info VARCHAR(255),
    session_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS admin_consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    consent_form_version VARCHAR(50) NOT NULL,
    agreed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45) NOT NULL,
    method VARCHAR(50) NOT NULL -- CLICK_THROUGH, SIGNED_DOC
);

CREATE TABLE IF NOT EXISTS admin_dpdp_grievances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES sec_companies(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    dpo_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS admin_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info VARCHAR(255),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    ip_address VARCHAR(45),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50) NOT NULL, -- DAILY_INCREMENTAL, WEEKLY_FULL, ON_DEMAND
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING', -- RUNNING, SUCCESS, FAILURE
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES sec_companies(id) ON DELETE CASCADE,
    export_type VARCHAR(100) NOT NULL, -- CLIENT_FULL, DB_CSV, DOCUMENTS
    file_path TEXT,
    password_protected BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes for Module 14
CREATE INDEX idx_admin_audit_logs_time ON admin_audit_logs(timestamp);
CREATE INDEX idx_admin_audit_logs_user ON admin_audit_logs(user_id);
CREATE INDEX idx_admin_sessions_user_token ON admin_user_sessions(user_id, session_token);
CREATE INDEX idx_admin_consent_company ON admin_consent_logs(company_id);
CREATE INDEX idx_admin_grievance_status ON admin_dpdp_grievances(status);
CREATE INDEX idx_admin_backups_created ON admin_backup_schedules(created_at);

-- =========================================================================
-- MODULE 15: SETTINGS & CONFIGURATION TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS cfg_firm_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    financial_year_start VARCHAR(10) NOT NULL DEFAULT '04-01', -- April 1st
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(50) NOT NULL DEFAULT 'DD-MM-YYYY',
    number_format VARCHAR(50) NOT NULL DEFAULT 'INDIAN', -- 1,00,000 vs 100,000
    business_hours_start TIME NOT NULL DEFAULT '09:00:00',
    business_hours_end TIME NOT NULL DEFAULT '18:00:00',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfg_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID UNIQUE NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    primary_color VARCHAR(50) NOT NULL DEFAULT '#1e3a8a',
    secondary_color VARCHAR(50) NOT NULL DEFAULT '#10b981',
    logo_url TEXT,
    stamp_url TEXT,
    letterhead_template TEXT,
    document_theme_preset VARCHAR(100) NOT NULL DEFAULT 'PROFESSIONAL'
);

CREATE TABLE IF NOT EXISTS cfg_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL, -- TALLY, GST_PORTAL, RAZORPAY, etc.
    credentials JSONB NOT NULL, -- encrypted credentials or tokens
    sync_schedule VARCHAR(100) NOT NULL DEFAULT '0 0 * * *', -- cron format
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'DISCONNECTED', -- CONNECTED, DISCONNECTED, ERROR
    error_logs TEXT
);

CREATE TABLE IF NOT EXISTS cfg_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channels_preference JSONB NOT NULL, -- { email: boolean, whatsapp: boolean, sms: boolean }
    types_preference JSONB NOT NULL, -- { compliance: boolean, payments: boolean, tasks: boolean }
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    digest_type VARCHAR(50) NOT NULL DEFAULT 'INSTANT' -- INSTANT, DAILY_DIGEST, WEEKLY_DIGEST
);

CREATE TABLE IF NOT EXISTS cfg_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID UNIQUE NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    plan_tier VARCHAR(100) NOT NULL DEFAULT 'GROWTH', -- GROWTH, SCALE, ENTERPRISE
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    amount DECIMAL(15,2) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_counters JSONB NOT NULL DEFAULT '{}'::jsonb -- { activeUsersCount, filingsCount, aiQueryCount }
);

CREATE TABLE IF NOT EXISTS cfg_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID UNIQUE NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    preferred_model VARCHAR(100) NOT NULL DEFAULT 'GPT-4o',
    confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70, -- 0.00 to 1.00
    allow_data_training BOOLEAN NOT NULL DEFAULT FALSE,
    memory_retention_days INT NOT NULL DEFAULT 90,
    auto_approve_filings BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_deployment_mode VARCHAR(50) NOT NULL DEFAULT 'CLOUD' -- CLOUD, VPC, ON_PREM
);

CREATE TABLE IF NOT EXISTS cfg_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    template_type VARCHAR(100) NOT NULL, -- INVOICE, EMAIL, WHATSAPP, PAYSLIP, RESOLUTION
    name VARCHAR(255) NOT NULL,
    subject_template TEXT,
    body_template TEXT NOT NULL,
    variables_metadata JSONB NOT NULL, -- List of variables like {{client_name}}
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfg_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL, -- GST_FILED, INVOICE_OVERDUE, TICKET_OPENED
    condition_rules JSONB NOT NULL, -- trigger parameters
    actions_sequence JSONB NOT NULL, -- array of { type: 'EMAIL', templateId: '...' }
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfg_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(100) UNIQUE NOT NULL, -- AI_COPILOT_ENABLED, VOICE_BOT_BETA
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS cfg_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL, -- CLIENT, EMPLOYEE, DOCUMENT
    field_label VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- TEXT, NUMBER, DATE, SELECT
    validation_regex VARCHAR(255),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    options_list JSONB, -- Array of strings for select types
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfg_system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpu_utilization DECIMAL(5,2) NOT NULL,
    memory_utilization DECIMAL(5,2) NOT NULL,
    db_connection_count INT NOT NULL,
    active_jobs_queue INT NOT NULL,
    api_response_time_ms INT NOT NULL,
    storage_used_bytes BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfg_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(150) NOT NULL,
    rate_limit_per_min INT NOT NULL DEFAULT 60,
    requests_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS cfg_white_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID UNIQUE NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    custom_domain VARCHAR(255) UNIQUE,
    dns_txt_record VARCHAR(255),
    ssl_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ACTIVE, EXPIRED
    dns_synced BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cfg_configuration_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    version INT NOT NULL,
    configuration_payload JSONB NOT NULL, -- serialized settings map
    backup_note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes for Module 15
CREATE INDEX idx_cfg_integrations_firm ON cfg_integrations(firm_id);
CREATE INDEX idx_cfg_templates_type ON cfg_templates(firm_id, template_type);
CREATE INDEX idx_cfg_workflows_trigger ON cfg_workflows(firm_id, trigger_event);
CREATE INDEX idx_cfg_custom_fields_entity ON cfg_custom_fields(firm_id, entity_type);
CREATE INDEX idx_cfg_system_health_time ON cfg_system_health(created_at);
CREATE INDEX idx_cfg_api_keys_hash ON cfg_api_keys(api_key_hash);

-- =========================================================================
-- MODULE 16: REPORTS & EXPORT HUB TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS rep_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES rep_categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    filters_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    run_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    layout_config JSONB NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    filter_payload JSONB NOT NULL,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES rep_reports(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    cron_expression VARCHAR(100) NOT NULL DEFAULT '0 0 1 * *',
    recipients JSONB NOT NULL,
    delivery_channels JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES rep_reports(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    filters_applied JSONB NOT NULL,
    execution_time_ms INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES rep_reports(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    change_note VARCHAR(255),
    payload JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_id UUID NOT NULL REFERENCES rep_history(id) ON DELETE CASCADE,
    export_format VARCHAR(20) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,
    digital_signature_hash VARCHAR(255),
    download_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES rep_reports(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_generate BOOLEAN NOT NULL DEFAULT TRUE,
    can_download BOOLEAN NOT NULL DEFAULT TRUE,
    can_share BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    dashboard_type VARCHAR(50) NOT NULL DEFAULT 'MANAGING_PARTNER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES rep_dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    layout_position JSONB NOT NULL,
    data_source_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_shared_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES rep_exports(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_channel VARCHAR(50) NOT NULL DEFAULT 'SECURE_LINK',
    secure_link_token VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    access_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES rep_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    parent_comment_id UUID REFERENCES rep_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cached_payload JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes for Module 16
CREATE INDEX idx_rep_reports_firm ON rep_reports(firm_id, category_id);
CREATE INDEX idx_rep_schedules_report ON rep_schedules(report_id, is_active);
CREATE INDEX idx_rep_history_report ON rep_history(report_id, created_at DESC);
CREATE INDEX idx_rep_exports_history ON rep_exports(history_id);
CREATE INDEX idx_rep_permissions_report ON rep_permissions(report_id, role);
CREATE INDEX idx_rep_dashboards_firm ON rep_dashboards(firm_id);
CREATE INDEX idx_rep_widgets_dashboard ON rep_dashboard_widgets(dashboard_id);
CREATE INDEX idx_rep_shared_reports_token ON rep_shared_reports(secure_link_token);
CREATE INDEX idx_rep_comments_report ON rep_comments(report_id);
CREATE INDEX idx_rep_analytics_cache_key ON rep_analytics_cache(cache_key);

-- =========================================================================
-- MODULE 17: BANK SYNC & ACCOUNT AGGREGATOR TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS aa_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    consent_handle VARCHAR(255) NOT NULL,
    consent_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ACTIVE, REVOKED, EXPIRED
    fip_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE bank_accounts ADD COLUMN aa_linked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bank_accounts ADD COLUMN aa_consent_id UUID REFERENCES aa_consents(id) ON DELETE SET NULL;
