-- ============================================================================
-- SENTINEL AUTHORITY CERTIFICATION PLATFORM
-- Database Schema v1.0
-- PostgreSQL 15+
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE account_type AS ENUM (
    'applicant',
    'certified_operator', 
    'licensed_implementer',
    'insurer',
    'regulator'
);

CREATE TYPE account_status AS ENUM (
    'pending',
    'active',
    'suspended',
    'terminated'
);

CREATE TYPE certification_state AS ENUM (
    'observe',
    'bounded',
    'certified',
    'suspended',
    'revoked'
);

CREATE TYPE cat72_status AS ENUM (
    'scheduled',
    'initializing',
    'in_progress',
    'passed',
    'failed',
    'aborted'
);

CREATE TYPE event_severity AS ENUM (
    'info',
    'warning',
    'violation',
    'critical',
    'breach'
);

CREATE TYPE odd_class AS ENUM (
    'indoor_logistics',
    'outdoor_logistics',
    'highway_l4',
    'urban_l3',
    'urban_l4',
    'industrial_fixed',
    'industrial_mobile',
    'aerial_confined',
    'aerial_beyond_visual',
    'marine_coastal',
    'marine_open',
    'custom'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Organizations/Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    account_type account_type NOT NULL DEFAULT 'applicant',
    status account_status NOT NULL DEFAULT 'pending',
    
    -- Contact information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    billing_email VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    
    -- Billing
    stripe_customer_id VARCHAR(255),
    billing_tier VARCHAR(50) DEFAULT 'standard',
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT valid_email CHECK (primary_contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Users (authentication handled by external provider, this stores app-specific data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_auth_id VARCHAR(255) UNIQUE, -- Auth0/Clerk user ID
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- admin, member, viewer, api_only
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    
    key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of the actual key
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification
    name VARCHAR(255) NOT NULL,
    
    scopes TEXT[] DEFAULT ARRAY['read'],
    
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SYSTEMS & ENVELOPES
-- ============================================================================

-- Autonomous systems registered for certification
CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_number VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    
    odd_class odd_class NOT NULL,
    odd_class_custom VARCHAR(100), -- If odd_class = 'custom'
    
    certification_state certification_state NOT NULL DEFAULT 'observe',
    certification_state_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Current envelope reference
    current_envelope_id UUID, -- FK added after envelope table
    
    -- Manufacturer/integrator info
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Envelope definitions (versioned)
CREATE TABLE envelopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    
    version VARCHAR(20) NOT NULL,
    version_major INT NOT NULL DEFAULT 1,
    version_minor INT NOT NULL DEFAULT 0,
    version_patch INT NOT NULL DEFAULT 0,
    
    -- Envelope specification
    specification JSONB NOT NULL, -- The actual envelope constraints
    
    -- Physics-derived constraints
    velocity_max_mps DECIMAL(10,4),
    acceleration_max_mps2 DECIMAL(10,4),
    angular_velocity_max_radps DECIMAL(10,4),
    position_bounds JSONB, -- GeoJSON or coordinate bounds
    
    -- Operational constraints
    temperature_min_c DECIMAL(5,2),
    temperature_max_c DECIMAL(5,2),
    wind_speed_max_mps DECIMAL(6,2),
    visibility_min_m DECIMAL(8,2),
    
    -- Time constraints
    operating_hours_start TIME,
    operating_hours_end TIME,
    operating_days INT[], -- 0=Sunday, 6=Saturday
    
    -- Rate constraints
    max_decisions_per_second INT,
    max_actuations_per_second INT,
    
    -- Invariants (formal specification)
    invariants JSONB DEFAULT '[]',
    
    -- Approval status
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    
    -- Hash for integrity
    specification_hash VARCHAR(64), -- SHA-256 of specification JSONB
    
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(system_id, version)
);

-- Add FK from systems to envelopes
ALTER TABLE systems 
    ADD CONSTRAINT fk_current_envelope 
    FOREIGN KEY (current_envelope_id) REFERENCES envelopes(id);

-- ============================================================================
-- CAT-72 TESTING
-- ============================================================================

-- CAT-72 Test sessions
CREATE TABLE cat72_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_number VARCHAR(20) UNIQUE NOT NULL,
    
    system_id UUID NOT NULL REFERENCES systems(id),
    envelope_id UUID NOT NULL REFERENCES envelopes(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    status cat72_status NOT NULL DEFAULT 'scheduled',
    
    -- Scheduling
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    
    -- Duration tracking
    required_duration_hours DECIMAL(5,2) NOT NULL DEFAULT 72.0,
    elapsed_hours DECIMAL(8,4) DEFAULT 0,
    
    -- Event counters
    total_events INT DEFAULT 0,
    violation_count INT DEFAULT 0,
    intervention_count INT DEFAULT 0,
    envelope_breach_count INT DEFAULT 0,
    
    -- Pass/fail criteria
    max_violations_allowed INT DEFAULT 0,
    max_interventions_allowed INT DEFAULT 0,
    max_breaches_allowed INT DEFAULT 0,
    
    -- Test environment
    environment VARCHAR(50), -- staging, production, simulation
    test_location VARCHAR(255),
    test_conditions JSONB DEFAULT '{}',
    
    -- Results
    result_summary TEXT,
    result_data JSONB,
    
    -- Fail-closed verification
    fail_closed_verified BOOLEAN,
    fail_closed_verification_data JSONB,
    
    -- Multi-regime stress
    regimes_tested TEXT[],
    regime_results JSONB,
    
    -- Evidence
    evidence_package_url VARCHAR(500),
    evidence_hash VARCHAR(64),
    
    -- Operator
    test_operator_id UUID REFERENCES users(id),
    reviewer_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CAT-72 telemetry events (high-volume)
CREATE TABLE cat72_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES cat72_tests(id) ON DELETE CASCADE,
    
    event_time TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity event_severity NOT NULL DEFAULT 'info',
    
    -- Event details
    message TEXT,
    data JSONB,
    
    -- Position at event time (if applicable)
    position_lat DECIMAL(10,7),
    position_lon DECIMAL(10,7),
    position_alt_m DECIMAL(8,2),
    
    -- System state at event time
    velocity_mps DECIMAL(8,4),
    heading_deg DECIMAL(6,2),
    
    -- Envelope evaluation
    envelope_evaluation JSONB, -- Which constraints were checked
    constraint_violated VARCHAR(100),
    
    -- Interlock action
    interlock_triggered BOOLEAN DEFAULT FALSE,
    interlock_action VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create hypertable for time-series if TimescaleDB is available
-- SELECT create_hypertable('cat72_events', 'event_time', if_not_exists => TRUE);

-- ============================================================================
-- CONFORMANCE RECORDS
-- ============================================================================

-- ODDC Conformance Records (the official attestations)
CREATE TABLE conformance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_number VARCHAR(30) UNIQUE NOT NULL, -- ODDC-YYYY-NNNNN
    
    system_id UUID NOT NULL REFERENCES systems(id),
    envelope_id UUID NOT NULL REFERENCES envelopes(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    cat72_test_id UUID REFERENCES cat72_tests(id),
    
    -- Certification details
    certification_state certification_state NOT NULL,
    odd_class odd_class NOT NULL,
    
    -- Validity
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Revocation
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revocation_reason TEXT,
    
    -- Cryptographic integrity
    record_hash VARCHAR(64) NOT NULL, -- SHA-256 of record contents
    signature VARCHAR(512) NOT NULL, -- Digital signature
    signature_algorithm VARCHAR(50) DEFAULT 'ECDSA-P256-SHA256',
    signing_key_id VARCHAR(100),
    
    -- Previous record (for chain of custody)
    previous_record_id UUID REFERENCES conformance_records(id),
    
    -- Full record content for verification
    record_content JSONB NOT NULL,
    
    -- Issuance
    issued_by UUID REFERENCES users(id),
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

-- Immutable audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES accounts(id),
    api_key_id UUID REFERENCES api_keys(id),
    ip_address INET,
    user_agent TEXT,
    
    -- Action
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    
    -- Changes
    old_value JSONB,
    new_value JSONB,
    
    -- Request context
    request_id VARCHAR(50),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System events log
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    event_type VARCHAR(100) NOT NULL,
    severity event_severity NOT NULL DEFAULT 'info',
    
    source VARCHAR(100),
    message TEXT NOT NULL,
    data JSONB,
    
    -- Related entities
    account_id UUID REFERENCES accounts(id),
    system_id UUID REFERENCES systems(id),
    test_id UUID REFERENCES cat72_tests(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS & TASKS
-- ============================================================================

-- Tasks/reminders
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    task_type VARCHAR(50), -- review, renewal, remediation, etc.
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    
    -- Related entities
    system_id UUID REFERENCES systems(id),
    conformance_record_id UUID REFERENCES conformance_records(id),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, completed, cancelled
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    notification_type VARCHAR(50), -- alert, reminder, update, etc.
    priority VARCHAR(20) DEFAULT 'normal',
    
    -- Related entities
    resource_type VARCHAR(50),
    resource_id UUID,
    action_url VARCHAR(500),
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Delivery
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FEES & BILLING
-- ============================================================================

CREATE TABLE fee_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    fee_type VARCHAR(50) NOT NULL, -- certification, renewal, cat72, expedited
    odd_class odd_class,
    
    amount_cents INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    description TEXT,
    
    effective_from DATE NOT NULL,
    effective_to DATE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    
    subtotal_cents INT NOT NULL,
    tax_cents INT DEFAULT 0,
    total_cents INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    stripe_invoice_id VARCHAR(255),
    
    line_items JSONB NOT NULL DEFAULT '[]',
    
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Accounts
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_created ON accounts(created_at);

-- Users
CREATE INDEX idx_users_account ON users(account_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_external_auth ON users(external_auth_id);

-- Systems
CREATE INDEX idx_systems_account ON systems(account_id);
CREATE INDEX idx_systems_state ON systems(certification_state);
CREATE INDEX idx_systems_odd_class ON systems(odd_class);

-- Envelopes
CREATE INDEX idx_envelopes_system ON envelopes(system_id);
CREATE INDEX idx_envelopes_approved ON envelopes(is_approved);

-- CAT-72 Tests
CREATE INDEX idx_cat72_system ON cat72_tests(system_id);
CREATE INDEX idx_cat72_account ON cat72_tests(account_id);
CREATE INDEX idx_cat72_status ON cat72_tests(status);
CREATE INDEX idx_cat72_scheduled ON cat72_tests(scheduled_start_at);

-- CAT-72 Events
CREATE INDEX idx_cat72_events_test ON cat72_events(test_id);
CREATE INDEX idx_cat72_events_time ON cat72_events(event_time);
CREATE INDEX idx_cat72_events_severity ON cat72_events(severity);
CREATE INDEX idx_cat72_events_test_time ON cat72_events(test_id, event_time);

-- Conformance Records
CREATE INDEX idx_conformance_system ON conformance_records(system_id);
CREATE INDEX idx_conformance_account ON conformance_records(account_id);
CREATE INDEX idx_conformance_state ON conformance_records(certification_state);
CREATE INDEX idx_conformance_expires ON conformance_records(expires_at);
CREATE INDEX idx_conformance_hash ON conformance_records(record_hash);

-- Audit Log
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_account ON audit_log(account_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Tasks
CREATE INDEX idx_tasks_account ON tasks(account_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_at);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER trigger_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_systems_updated_at
    BEFORE UPDATE ON systems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cat72_tests_updated_at
    BEFORE UPDATE ON cat72_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str VARCHAR(4);
    seq_num INT;
BEGIN
    year_str := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 9) AS INT)), 0) + 1
    INTO seq_num
    FROM accounts
    WHERE account_number LIKE 'SA-' || year_str || '-%';
    
    NEW.account_number := 'SA-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_account_number
    BEFORE INSERT ON accounts
    FOR EACH ROW
    WHEN (NEW.account_number IS NULL)
    EXECUTE FUNCTION generate_account_number();

-- Generate system number
CREATE OR REPLACE FUNCTION generate_system_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(system_number FROM 5) AS INT)), 0) + 1
    INTO seq_num
    FROM systems;
    
    NEW.system_number := 'SYS-' || LPAD(seq_num::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_system_number
    BEFORE INSERT ON systems
    FOR EACH ROW
    WHEN (NEW.system_number IS NULL)
    EXECUTE FUNCTION generate_system_number();

-- Generate CAT-72 test number
CREATE OR REPLACE FUNCTION generate_cat72_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str VARCHAR(4);
    seq_num INT;
BEGIN
    year_str := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(test_number FROM 10) AS INT)), 0) + 1
    INTO seq_num
    FROM cat72_tests
    WHERE test_number LIKE 'CAT-' || year_str || '-%';
    
    NEW.test_number := 'CAT-' || year_str || '-' || LPAD(seq_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_cat72_number
    BEFORE INSERT ON cat72_tests
    FOR EACH ROW
    WHEN (NEW.test_number IS NULL)
    EXECUTE FUNCTION generate_cat72_number();

-- Generate conformance record number
CREATE OR REPLACE FUNCTION generate_conformance_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str VARCHAR(4);
    seq_num INT;
BEGIN
    year_str := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(record_number FROM 11) AS INT)), 0) + 1
    INTO seq_num
    FROM conformance_records
    WHERE record_number LIKE 'ODDC-' || year_str || '-%';
    
    NEW.record_number := 'ODDC-' || year_str || '-' || LPAD(seq_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_conformance_number
    BEFORE INSERT ON conformance_records
    FOR EACH ROW
    WHEN (NEW.record_number IS NULL)
    EXECUTE FUNCTION generate_conformance_number();

-- Log certification state changes
CREATE OR REPLACE FUNCTION log_certification_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.certification_state IS DISTINCT FROM NEW.certification_state THEN
        NEW.certification_state_changed_at := NOW();
        
        INSERT INTO system_events (event_type, severity, source, message, system_id, data)
        VALUES (
            'certification_state_change',
            'info',
            'system',
            'Certification state changed from ' || OLD.certification_state || ' to ' || NEW.certification_state,
            NEW.id,
            jsonb_build_object(
                'old_state', OLD.certification_state,
                'new_state', NEW.certification_state
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_certification_state_change
    BEFORE UPDATE ON systems
    FOR EACH ROW
    EXECUTE FUNCTION log_certification_state_change();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active certifications view
CREATE VIEW v_active_certifications AS
SELECT 
    cr.id,
    cr.record_number,
    cr.certification_state,
    cr.issued_at,
    cr.expires_at,
    s.name AS system_name,
    s.system_number,
    s.odd_class,
    a.name AS account_name,
    a.account_number,
    e.version AS envelope_version,
    CASE 
        WHEN cr.expires_at < NOW() THEN 'expired'
        WHEN cr.expires_at < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'valid'
    END AS validity_status
FROM conformance_records cr
JOIN systems s ON cr.system_id = s.id
JOIN accounts a ON cr.account_id = a.id
JOIN envelopes e ON cr.envelope_id = e.id
WHERE cr.is_revoked = FALSE
ORDER BY cr.expires_at;

-- Active CAT-72 tests view
CREATE VIEW v_active_cat72_tests AS
SELECT 
    t.id,
    t.test_number,
    t.status,
    t.scheduled_start_at,
    t.actual_start_at,
    t.elapsed_hours,
    t.required_duration_hours,
    t.violation_count,
    t.intervention_count,
    t.envelope_breach_count,
    ROUND((t.elapsed_hours / t.required_duration_hours * 100)::numeric, 1) AS progress_percent,
    s.name AS system_name,
    s.system_number,
    a.name AS account_name,
    a.account_number,
    e.version AS envelope_version
FROM cat72_tests t
JOIN systems s ON t.system_id = s.id
JOIN accounts a ON t.account_id = a.id
JOIN envelopes e ON t.envelope_id = e.id
WHERE t.status IN ('scheduled', 'initializing', 'in_progress')
ORDER BY t.scheduled_start_at;

-- Account summary view
CREATE VIEW v_account_summary AS
SELECT 
    a.id,
    a.account_number,
    a.name,
    a.account_type,
    a.status,
    a.primary_contact_name,
    a.primary_contact_email,
    a.created_at,
    COUNT(DISTINCT s.id) AS total_systems,
    COUNT(DISTINCT s.id) FILTER (WHERE s.certification_state = 'certified') AS certified_systems,
    COUNT(DISTINCT s.id) FILTER (WHERE s.certification_state = 'bounded') AS bounded_systems,
    COUNT(DISTINCT s.id) FILTER (WHERE s.certification_state = 'observe') AS observe_systems,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in_progress') AS active_tests
FROM accounts a
LEFT JOIN systems s ON a.id = s.account_id
LEFT JOIN cat72_tests t ON a.id = t.account_id
GROUP BY a.id;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Fee schedule
INSERT INTO fee_schedule (fee_type, odd_class, amount_cents, description, effective_from) VALUES
('certification_initial', NULL, 4500000, 'Initial ODDC certification determination', '2025-01-01'),
('certification_renewal', NULL, 1500000, 'Annual certification renewal', '2025-01-01'),
('cat72_test', NULL, 2500000, 'CAT-72 test administration', '2025-01-01'),
('cat72_expedited', NULL, 5000000, 'Expedited CAT-72 test (priority scheduling)', '2025-01-01'),
('maintenance_annual', NULL, 250000, 'Annual maintenance fee', '2025-01-01'),
('envelope_revision', NULL, 750000, 'Envelope revision review', '2025-01-01');

-- Create admin account and user
INSERT INTO accounts (account_number, name, legal_name, account_type, status, primary_contact_name, primary_contact_email)
VALUES ('SA-2025-0001', 'Sentinel Authority', 'Sentinel Authority LLC', 'certified_operator', 'active', 'System Administrator', 'admin@sentinelauthority.org');

-- ============================================================================
-- ROW LEVEL SECURITY (for multi-tenancy)
-- ============================================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat72_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conformance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies will be created based on the application's authentication context
-- Example policy (would be customized based on auth implementation):
-- CREATE POLICY systems_tenant_isolation ON systems
--     USING (account_id = current_setting('app.current_account_id')::uuid);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE accounts IS 'Organizations registered with Sentinel Authority';
COMMENT ON TABLE systems IS 'Autonomous systems registered for ENVELO certification';
COMMENT ON TABLE envelopes IS 'Versioned envelope specifications defining operational constraints';
COMMENT ON TABLE cat72_tests IS '72-hour Convergence Authorization Test sessions';
COMMENT ON TABLE cat72_events IS 'Telemetry events captured during CAT-72 tests';
COMMENT ON TABLE conformance_records IS 'Official ODDC conformance attestations with cryptographic signatures';
COMMENT ON TABLE audit_log IS 'Immutable audit trail of all system actions';

COMMENT ON COLUMN envelopes.specification IS 'JSON specification of envelope constraints including physics limits, invariants, and rate constraints';
COMMENT ON COLUMN conformance_records.record_hash IS 'SHA-256 hash of the record_content for integrity verification';
COMMENT ON COLUMN conformance_records.signature IS 'ECDSA digital signature of the record_hash';
