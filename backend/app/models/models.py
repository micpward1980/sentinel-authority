"""Database models."""

import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Enum, JSON, LargeBinary
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    APPLICANT = "applicant"
    SUBSCRIBER = "subscriber"
    LICENSEE = "licensee"
    PENDING = "pending"


class CertificationState(str, enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    OBSERVE = "observe"
    BOUNDED = "bounded"
    CONFORMANT = "conformant"
    SUSPENDED = "suspended"
    REVOKED = "revoked"
    EXPIRED = "expired"


class TestState(str, enum.Enum):
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"



class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship("User", back_populates="org")
    applications = relationship("Application", back_populates="org")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    full_name = Column(String(255))
    organization = Column(String(255))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    org = relationship("Organization", back_populates="users")
    role = Column(Enum(UserRole), default=UserRole.SUBSCRIBER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_backup_codes = Column(Text, nullable=True)
    notifications_read_at = Column(DateTime, nullable=True)  # JSON array of hashed backup codes
    email_preferences = Column(JSON, default=lambda: {
        "application_updates": True, "test_notifications": True,
        "certificate_alerts": True, "agent_alerts": True, "marketing": False,
    })
    applications = relationship("Application", back_populates="applicant")


class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    session_id = Column(String(64), unique=True, index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    revoked_at = Column(DateTime, nullable=True)


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(50), unique=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id"))
    organization_name = Column(String(255), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    system_name = Column(String(255), nullable=False)
    system_description = Column(Text)
    system_version = Column(String(50))
    manufacturer = Column(String(255))
    odd_specification = Column(JSON)
    envelope_definition = Column(JSON)
    state = Column(Enum(CertificationState), default=CertificationState.PENDING)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    preferred_test_date = Column(DateTime)
    facility_location = Column(String(255))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    applicant = relationship("User", back_populates="applications")
    org = relationship("Organization", back_populates="applications")
    tests = relationship("CAT72Test", back_populates="application")
    certificate = relationship("Certificate", back_populates="application", uselist=False)


class CAT72Test(Base):
    __tablename__ = "cat72_tests"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(String(50), unique=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    duration_hours = Column(Integer, default=72)
    envelope_definition = Column(JSON)
    state = Column(Enum(TestState), default=TestState.SCHEDULED)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    elapsed_seconds = Column(Integer, default=0)
    operator_id = Column(Integer, ForeignKey("users.id"))
    total_samples = Column(Integer, default=0)
    conformant_samples = Column(Integer, default=0)
    interlock_activations = Column(Integer, default=0)
    max_drift_observed = Column(Float, default=0.0)
    convergence_score = Column(Float)
    drift_rate = Column(Float)
    stability_index = Column(Float)
    envelope_margin = Column(Float)
    evidence_hash = Column(String(64))
    evidence_chain = Column(JSON)
    result = Column(String(50))
    result_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    application = relationship("Application", back_populates="tests")
    telemetry = relationship("Telemetry", back_populates="test")
    interlock_events = relationship("InterlockEvent", back_populates="test")


class Telemetry(Base):
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("cat72_tests.id"), index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    elapsed_seconds = Column(Integer)
    state_vector = Column(JSON)
    in_envelope = Column(Boolean)
    envelope_distance = Column(Float)
    convergence_score = Column(Float)
    drift_rate = Column(Float)
    stability_index = Column(Float)
    sample_hash = Column(String(64))
    prev_hash = Column(String(64))
    test = relationship("CAT72Test", back_populates="telemetry")


class InterlockEvent(Base):
    __tablename__ = "interlock_events"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("cat72_tests.id"), index=True)
    timestamp = Column(DateTime, nullable=False)
    elapsed_seconds = Column(Integer)
    trigger_type = Column(String(50))
    trigger_parameter = Column(String(100))
    trigger_value = Column(Float)
    threshold_value = Column(Float)
    action_type = Column(String(50))
    action_details = Column(JSON)
    state_before = Column(JSON)
    state_after = Column(JSON)
    event_hash = Column(String(64))
    test = relationship("CAT72Test", back_populates="interlock_events")


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, index=True)
    certificate_number = Column(String(50), unique=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    organization_name = Column(String(255))
    system_name = Column(String(255))
    system_version = Column(String(50))
    odd_specification = Column(JSON)
    envelope_definition = Column(JSON)
    state = Column(Enum(CertificationState), default=CertificationState.CONFORMANT)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    issued_by = Column(Integer, ForeignKey("users.id"))
    test_id = Column(Integer, ForeignKey("cat72_tests.id"))
    convergence_score = Column(Float)
    evidence_hash = Column(String(64))
    signature = Column(String(50))  # Authority signature e.g., SA-SIG-1
    audit_log_ref = Column(String(50))  # Audit trail reference e.g., SA-LOG-2026-0001
    certificate_pdf = Column(LargeBinary)
    verification_url = Column(String(255))
    history = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    application = relationship("Application", back_populates="certificate")


class Licensee(Base):
    __tablename__ = "licensees"
    id = Column(Integer, primary_key=True, index=True)
    license_number = Column(String(50), unique=True, index=True)
    organization_name = Column(String(255), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    license_type = Column(String(50))
    licensed_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    api_key = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user_email = Column(String(255))
    action = Column(String(100), index=True)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    details = Column(JSON)
    log_hash = Column(String(64))
    prev_hash = Column(String(64))


# ENVELO API Keys

class ApplicationComment(Base):
    __tablename__ = "application_comments"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user_email = Column(String(255))
    user_role = Column(String(50))
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal notes not shown to applicant
    created_at = Column(DateTime, default=datetime.utcnow)


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String(64), unique=True, index=True)  # SHA-256 hash of the key
    key_prefix = Column(String(12))  # First 8 chars for identification (sa_live_xxxx)
    certificate_id = Column(Integer, ForeignKey("certificates.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String(100))  # Friendly name like "Production Key"
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    certificate = relationship("Certificate", backref="api_keys")
    user = relationship("User", backref="api_keys")


# ENVELO Sessions
class EnveloSession(Base):
    __tablename__ = "envelo_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(32), unique=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"))
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    agent_version = Column(String(20))
    status = Column(String(20), default="active")  # active, ended, disconnected
    last_telemetry_at = Column(DateTime, nullable=True)
    last_heartbeat_at = Column(DateTime, nullable=True)
    last_violation_alert_at = Column(DateTime, nullable=True)
    last_offline_alert_at = Column(DateTime, nullable=True)
    pass_count = Column(Integer, default=0)
    block_count = Column(Integer, default=0)
    
    certificate = relationship("Certificate", backref="envelo_sessions")
    api_key = relationship("APIKey", backref="sessions")


# ENVELO Telemetry Records
class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("envelo_sessions.id"), index=True)
    timestamp = Column(DateTime, index=True)
    action_id = Column(String(50))
    action_type = Column(String(100))
    result = Column(String(10))  # PASS or BLOCK
    execution_time_ms = Column(Float)
    parameters = Column(Text)  # JSON
    boundary_evaluations = Column(Text)  # JSON
    system_state = Column(Text)  # JSON
    
    session = relationship("EnveloSession", backref="telemetry_records")


# ENVELO Violations (for quick access to blocks)
class Violation(Base):
    __tablename__ = "violations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("envelo_sessions.id"), index=True)
    telemetry_id = Column(Integer, ForeignKey("telemetry_records.id"))
    timestamp = Column(DateTime, index=True)
    boundary_name = Column(String(100))
    violation_message = Column(Text)
    parameters = Column(Text)  # JSON
    
    session = relationship("EnveloSession", backref="violations")
