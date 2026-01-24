"""
Database connection and SQLAlchemy models for Sentinel Authority
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import (
    String, Text, Integer, Boolean, DateTime, Numeric, JSON, 
    ForeignKey, Enum as SQLEnum, UniqueConstraint, Index, func
)
from sqlalchemy.dialects.postgresql import UUID, INET, ARRAY, JSONB
from datetime import datetime
from typing import Optional, List, Any
import uuid
import enum

from config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Dependency for FastAPI
async def get_db():
    """Dependency that provides a database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database (create tables if needed)."""
    async with engine.begin() as conn:
        # In production, use Alembic migrations instead
        # await conn.run_sync(Base.
metadata.create_all)
        pass


# Base class for all models
class Base(DeclarativeBase):
    pass


# ============================================================================
# ENUMS
# ============================================================================

class AccountType(str, enum.Enum):
    APPLICANT = "applicant"
    CERTIFIED_OPERATOR = "certified_operator"
    LICENSED_IMPLEMENTER = "licensed_implementer"
    INSURER = "insurer"
    REGULATOR = "regulator"


class AccountStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class CertificationState(str, enum.Enum):
    OBSERVE = "observe"
    BOUNDED = "bounded"
    CERTIFIED = "certified"
    SUSPENDED = "suspended"
    REVOKED = "revoked"


class CAT72Status(str, enum.Enum):
    SCHEDULED = "scheduled"
    INITIALIZING = "initializing"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    ABORTED = "aborted"


class EventSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    VIOLATION = "violation"
    CRITICAL = "critical"
    BREACH = "breach"


class ODDClass(str, enum.Enum):
    INDOOR_LOGISTICS = "indoor_logistics"
    OUTDOOR_LOGISTICS = "outdoor_logistics"
    HIGHWAY_L4 = "highway_l4"
    URBAN_L3 = "urban_l3"
    URBAN_L4 = "urban_l4"
    INDUSTRIAL_FIXED = "industrial_fixed"
    INDUSTRIAL_MOBILE = "industrial_mobile"
    AERIAL_CONFINED = "aerial_confined"
    AERIAL_BEYOND_VISUAL = "aerial_beyond_visual"
    MARINE_COASTAL = "marine_coastal"
    MARINE_OPEN = "marine_open"
    CUSTOM = "custom"


# ============================================================================
# MODELS
# ============================================================================

class Account(Base):
    """Organization/Account model."""
    __tablename__ = "accounts"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255))
    account_type: Mapped[AccountType] = mapped_column(SQLEnum(AccountType), default=AccountType.APPLICANT)
    status: Mapped[AccountStatus] = mapped_column(SQLEnum(AccountStatus), default=AccountStatus.PENDING)
    
    # Contact
    primary_contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    primary_contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    primary_contact_phone: Mapped[Optional[str]] = mapped_column(String(50))
    billing_email: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Address
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state_province: Mapped[Optional[str]] = mapped_column(String(100))
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(100), default="United States")
    
    # Billing
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255))
    billing_tier: Mapped[str] = mapped_column(String(50), default="standard")
    
    # Metadata
    notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    
    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="account")
    systems: Mapped[List["System"]] = relationship("System", back_populates="account")
    cat72_tests: Mapped[List["CAT72Test"]] = relationship("CAT72Test", back_populates="account")
    conformance_records: Mapped[List["ConformanceRecord"]] = relationship("ConformanceRecord", back_populates="account")


class User(Base):
    """User model."""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_auth_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="member")
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    account: Mapped[Optional["Account"]] = relationship("Account", back_populates="users")


class APIKey(Base):
    """API Key model."""
    __tablename__ = "api_keys"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    scopes: Mapped[List[str]] = mapped_column(ARRAY(String), default=["read"])
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class System(Base):
    """Autonomous system model."""
    __tablename__ = "systems"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    system_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[Optional[str]] = mapped_column(String(50))
    
    odd_class: Mapped[ODDClass] = mapped_column(SQLEnum(ODDClass), nullable=False)
    odd_class_custom: Mapped[Optional[str]] = mapped_column(String(100))
    
    certification_state: Mapped[CertificationState] = mapped_column(SQLEnum(CertificationState), default=CertificationState.OBSERVE)
    certification_state_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    current_envelope_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("envelopes.id"))
    
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255))
    model_number: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100))
    
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="systems")
    envelopes: Mapped[List["Envelope"]] = relationship("Envelope", back_populates="system", foreign_keys="Envelope.system_id")
    current_envelope: Mapped[Optional["Envelope"]] = relationship("Envelope", foreign_keys=[current_envelope_id])
    cat72_tests: Mapped[List["CAT72Test"]] = relationship("CAT72Test", back_populates="system")


class Envelope(Base):
    """Envelope specification model."""
    __tablename__ = "envelopes"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    system_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("systems.id", ondelete="CASCADE"), nullable=False)
    
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    version_major: Mapped[int] = mapped_column(Integer, default=1)
    version_minor: Mapped[int] = mapped_column(Integer, default=0)
    version_patch: Mapped[int] = mapped_column(Integer, default=0)
    
    specification: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    # Physics constraints
    velocity_max_mps: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    acceleration_max_mps2: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    angular_velocity_max_radps: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    position_bounds: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    # Environmental constraints
    temperature_min_c: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    temperature_max_c: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    wind_speed_max_mps: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    visibility_min_m: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    
    # Rate constraints
    max_decisions_per_second: Mapped[Optional[int]] = mapped_column(Integer)
    max_actuations_per_second: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Invariants
    invariants: Mapped[list] = mapped_column(JSONB, default=list)
    
    # Approval
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    specification_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships
    system: Mapped["System"] = relationship("System", back_populates="envelopes", foreign_keys=[system_id])
    
    __table_args__ = (
        UniqueConstraint('system_id', 'version', name='uq_envelope_system_version'),
    )


class CAT72Test(Base):
    """CAT-72 Test model."""
    __tablename__ = "cat72_tests"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    
    system_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("systems.id"), nullable=False)
    envelope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    
    status: Mapped[CAT72Status] = mapped_column(SQLEnum(CAT72Status), default=CAT72Status.SCHEDULED)
    
    scheduled_start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    required_duration_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=72.0)
    elapsed_hours: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    
    total_events: Mapped[int] = mapped_column(Integer, default=0)
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    intervention_count: Mapped[int] = mapped_column(Integer, default=0)
    envelope_breach_count: Mapped[int] = mapped_column(Integer, default=0)
    
    max_violations_allowed: Mapped[int] = mapped_column(Integer, default=0)
    max_interventions_allowed: Mapped[int] = mapped_column(Integer, default=0)
    max_breaches_allowed: Mapped[int] = mapped_column(Integer, default=0)
    
    environment: Mapped[Optional[str]] = mapped_column(String(50))
    test_location: Mapped[Optional[str]] = mapped_column(String(255))
    test_conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    result_summary: Mapped[Optional[str]] = mapped_column(Text)
    result_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    fail_closed_verified: Mapped[Optional[bool]] = mapped_column(Boolean)
    fail_closed_verification_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    regimes_tested: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    regime_results: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    evidence_package_url: Mapped[Optional[str]] = mapped_column(String(500))
    evidence_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    test_operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    system: Mapped["System"] = relationship("System", back_populates="cat72_tests")
    envelope: Mapped["Envelope"] = relationship("Envelope")
    account: Mapped["Account"] = relationship("Account", back_populates="cat72_tests")
    events: Mapped[List["CAT72Event"]] = relationship("CAT72Event", back_populates="test")


class CAT72Event(Base):
    """CAT-72 telemetry event model."""
    __tablename__ = "cat72_events"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cat72_tests.id", ondelete="CASCADE"), nullable=False)
    
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[EventSeverity] = mapped_column(SQLEnum(EventSeverity), default=EventSeverity.INFO)
    
    message: Mapped[Optional[str]] = mapped_column(Text)
    data: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    position_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    position_lon: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    position_alt_m: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    
    velocity_mps: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    heading_deg: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    
    envelope_evaluation: Mapped[Optional[dict]] = mapped_column(JSONB)
    constraint_violated: Mapped[Optional[str]] = mapped_column(String(100))
    
    interlock_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    interlock_action: Mapped[Optional[str]] = mapped_column(String(100))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    test: Mapped["CAT72Test"] = relationship("CAT72Test", back_populates="events")
    
    __table_args__ = (
        Index('idx_cat72_events_test_time', 'test_id', 'event_time'),
    )


class ConformanceRecord(Base):
    """ODDC Conformance Record model."""
    __tablename__ = "conformance_records"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    
    system_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("systems.id"), nullable=False)
    envelope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    cat72_test_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cat72_tests.id"))
    
    certification_state: Mapped[CertificationState] = mapped_column(SQLEnum(CertificationState), nullable=False)
    odd_class: Mapped[ODDClass] = mapped_column(SQLEnum(ODDClass), nullable=False)
    
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text)
    
    record_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    signature: Mapped[str] = mapped_column(String(512), nullable=False)
    signature_algorithm: Mapped[str] = mapped_column(String(50), default="ECDSA-P256-SHA256")
    signing_key_id: Mapped[Optional[str]] = mapped_column(String(100))
    
    previous_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("conformance_records.id"))
    
    record_content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    issued_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    system: Mapped["System"] = relationship("System")
    envelope: Mapped["Envelope"] = relationship("Envelope")
    account: Mapped["Account"] = relationship("Account", back_populates="conformance_records")
    cat72_test: Mapped[Optional["CAT72Test"]] = relationship("CAT72Test")


class AuditLog(Base):
    """Audit log model."""
    __tablename__ = "audit_log"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    api_key_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("api_keys.id"))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv6 compatible
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    request_id: Mapped[Optional[str]] = mapped_column(String(50))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    """Task model."""
    __tablename__ = "tasks"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    task_type: Mapped[Optional[str]] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    
    system_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("systems.id"))
    conformance_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("conformance_records.id"))
    
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    status: Mapped[str] = mapped_column(String(20), default="open")
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
