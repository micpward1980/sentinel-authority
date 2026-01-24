"""
Pydantic schemas for Sentinel Authority API
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class AccountTypeEnum(str, Enum):
    applicant = "applicant"
    certified_operator = "certified_operator"
    licensed_implementer = "licensed_implementer"
    insurer = "insurer"
    regulator = "regulator"


class AccountStatusEnum(str, Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    terminated = "terminated"


class CertificationStateEnum(str, Enum):
    observe = "observe"
    bounded = "bounded"
    certified = "certified"
    suspended = "suspended"
    revoked = "revoked"


class CAT72StatusEnum(str, Enum):
    scheduled = "scheduled"
    initializing = "initializing"
    in_progress = "in_progress"
    passed = "passed"
    failed = "failed"
    aborted = "aborted"


class EventSeverityEnum(str, Enum):
    info = "info"
    warning = "warning"
    violation = "violation"
    critical = "critical"
    breach = "breach"


class ODDClassEnum(str, Enum):
    indoor_logistics = "indoor_logistics"
    outdoor_logistics = "outdoor_logistics"
    highway_l4 = "highway_l4"
    urban_l3 = "urban_l3"
    urban_l4 = "urban_l4"
    industrial_fixed = "industrial_fixed"
    industrial_mobile = "industrial_mobile"
    aerial_confined = "aerial_confined"
    aerial_beyond_visual = "aerial_beyond_visual"
    marine_coastal = "marine_coastal"
    marine_open = "marine_open"
    custom = "custom"


# ============================================================================
# BASE SCHEMAS
# ============================================================================

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# ACCOUNT SCHEMAS
# ============================================================================

class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    account_type: AccountTypeEnum = AccountTypeEnum.applicant
    
    primary_contact_name: Optional[str] = Field(None, max_length=255)
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = Field(None, max_length=50)
    billing_email: Optional[EmailStr] = None
    
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state_province: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: str = Field("United States", max_length=100)
    
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[AccountTypeEnum] = None
    status: Optional[AccountStatusEnum] = None
    
    primary_contact_name: Optional[str] = Field(None, max_length=255)
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = Field(None, max_length=50)
    billing_email: Optional[EmailStr] = None
    
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state_province: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AccountResponse(BaseSchema):
    id: UUID
    account_number: str
    name: str
    legal_name: Optional[str] = None
    account_type: AccountTypeEnum
    status: AccountStatusEnum
    
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    billing_email: Optional[str] = None
    
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    
    billing_tier: str
    notes: Optional[str] = None
    metadata: Dict[str, Any]
    
    created_at: datetime
    updated_at: datetime


class AccountSummary(BaseSchema):
    id: UUID
    account_number: str
    name: str
    account_type: AccountTypeEnum
    status: AccountStatusEnum
    created_at: datetime


# ============================================================================
# USER SCHEMAS
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = Field(None, max_length=255)
    role: str = Field("member", pattern="^(admin|member|viewer|api_only)$")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, pattern="^(admin|member|viewer|api_only)$")
    is_active: Optional[bool] = None


class UserResponse(BaseSchema):
    id: UUID
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


# ============================================================================
# SYSTEM SCHEMAS
# ============================================================================

class SystemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    
    odd_class: ODDClassEnum
    odd_class_custom: Optional[str] = Field(None, max_length=100)
    
    manufacturer: Optional[str] = Field(None, max_length=255)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SystemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    
    odd_class: Optional[ODDClassEnum] = None
    odd_class_custom: Optional[str] = Field(None, max_length=100)
    
    manufacturer: Optional[str] = Field(None, max_length=255)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    
    metadata: Optional[Dict[str, Any]] = None


class SystemResponse(BaseSchema):
    id: UUID
    system_number: str
    account_id: UUID
    
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    
    odd_class: ODDClassEnum
    odd_class_custom: Optional[str] = None
    
    certification_state: CertificationStateEnum
    certification_state_changed_at: datetime
    
    current_envelope_id: Optional[UUID] = None
    
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    
    metadata: Dict[str, Any]
    
    created_at: datetime
    updated_at: datetime


class SystemSummary(BaseSchema):
    id: UUID
    system_number: str
    name: str
    odd_class: ODDClassEnum
    certification_state: CertificationStateEnum


# ============================================================================
# ENVELOPE SCHEMAS
# ============================================================================

class InvariantDefinition(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    expression: str
    severity: str = "critical"


class EnvelopeCreate(BaseModel):
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$")
    
    specification: Dict[str, Any]
    
    velocity_max_mps: Optional[float] = Field(None, ge=0)
    acceleration_max_mps2: Optional[float] = Field(None, ge=0)
    angular_velocity_max_radps: Optional[float] = Field(None, ge=0)
    position_bounds: Optional[Dict[str, Any]] = None
    
    temperature_min_c: Optional[float] = None
    temperature_max_c: Optional[float] = None
    wind_speed_max_mps: Optional[float] = Field(None, ge=0)
    visibility_min_m: Optional[float] = Field(None, ge=0)
    
    max_decisions_per_second: Optional[int] = Field(None, ge=1)
    max_actuations_per_second: Optional[int] = Field(None, ge=1)
    
    invariants: Optional[List[InvariantDefinition]] = Field(default_factory=list)
    
    notes: Optional[str] = None


class EnvelopeResponse(BaseSchema):
    id: UUID
    system_id: UUID
    
    version: str
    version_major: int
    version_minor: int
    version_patch: int
    
    specification: Dict[str, Any]
    
    velocity_max_mps: Optional[float] = None
    acceleration_max_mps2: Optional[float] = None
    angular_velocity_max_radps: Optional[float] = None
    position_bounds: Optional[Dict[str, Any]] = None
    
    temperature_min_c: Optional[float] = None
    temperature_max_c: Optional[float] = None
    wind_speed_max_mps: Optional[float] = None
    visibility_min_m: Optional[float] = None
    
    max_decisions_per_second: Optional[int] = None
    max_actuations_per_second: Optional[int] = None
    
    invariants: List[Any]
    
    is_approved: bool
    approved_at: Optional[datetime] = None
    
    specification_hash: Optional[str] = None
    notes: Optional[str] = None
    
    created_at: datetime


# ============================================================================
# CAT-72 SCHEMAS
# ============================================================================

class CAT72Create(BaseModel):
    system_id: UUID
    envelope_id: UUID
    
    scheduled_start_at: datetime
    
    required_duration_hours: float = Field(72.0, ge=1, le=168)
    
    max_violations_allowed: int = Field(0, ge=0)
    max_interventions_allowed: int = Field(0, ge=0)
    max_breaches_allowed: int = Field(0, ge=0)
    
    environment: Optional[str] = Field(None, max_length=50)
    test_location: Optional[str] = Field(None, max_length=255)
    test_conditions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    notes: Optional[str] = None


class CAT72Update(BaseModel):
    status: Optional[CAT72StatusEnum] = None
    
    scheduled_start_at: Optional[datetime] = None
    actual_start_at: Optional[datetime] = None
    actual_end_at: Optional[datetime] = None
    
    elapsed_hours: Optional[float] = Field(None, ge=0)
    
    result_summary: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    
    fail_closed_verified: Optional[bool] = None
    fail_closed_verification_data: Optional[Dict[str, Any]] = None
    
    regimes_tested: Optional[List[str]] = None
    regime_results: Optional[Dict[str, Any]] = None
    
    evidence_package_url: Optional[str] = None
    evidence_hash: Optional[str] = None
    
    notes: Optional[str] = None


class CAT72Response(BaseSchema):
    id: UUID
    test_number: str
    
    system_id: UUID
    envelope_id: UUID
    account_id: UUID
    
    status: CAT72StatusEnum
    
    scheduled_start_at: datetime
    actual_start_at: Optional[datetime] = None
    actual_end_at: Optional[datetime] = None
    
    required_duration_hours: float
    elapsed_hours: float
    
    total_events: int
    violation_count: int
    intervention_count: int
    envelope_breach_count: int
    
    max_violations_allowed: int
    max_interventions_allowed: int
    max_breaches_allowed: int
    
    environment: Optional[str] = None
    test_location: Optional[str] = None
    test_conditions: Dict[str, Any]
    
    result_summary: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    
    fail_closed_verified: Optional[bool] = None
    
    regimes_tested: Optional[List[str]] = None
    
    evidence_package_url: Optional[str] = None
    evidence_hash: Optional[str] = None
    
    notes: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime


class CAT72EventCreate(BaseModel):
    event_time: datetime
    event_type: str = Field(..., max_length=50)
    severity: EventSeverityEnum = EventSeverityEnum.info
    
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    
    position_lat: Optional[float] = Field(None, ge=-90, le=90)
    position_lon: Optional[float] = Field(None, ge=-180, le=180)
    position_alt_m: Optional[float] = None
    
    velocity_mps: Optional[float] = Field(None, ge=0)
    heading_deg: Optional[float] = Field(None, ge=0, lt=360)
    
    envelope_evaluation: Optional[Dict[str, Any]] = None
    constraint_violated: Optional[str] = Field(None, max_length=100)
    
    interlock_triggered: bool = False
    interlock_action: Optional[str] = Field(None, max_length=100)


class CAT72EventResponse(BaseSchema):
    id: UUID
    test_id: UUID
    
    event_time: datetime
    event_type: str
    severity: EventSeverityEnum
    
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    
    position_lat: Optional[float] = None
    position_lon: Optional[float] = None
    position_alt_m: Optional[float] = None
    
    velocity_mps: Optional[float] = None
    heading_deg: Optional[float] = None
    
    envelope_evaluation: Optional[Dict[str, Any]] = None
    constraint_violated: Optional[str] = None
    
    interlock_triggered: bool
    interlock_action: Optional[str] = None
    
    created_at: datetime


# ============================================================================
# CONFORMANCE RECORD SCHEMAS
# ============================================================================

class ConformanceRecordCreate(BaseModel):
    system_id: UUID
    envelope_id: UUID
    cat72_test_id: Optional[UUID] = None
    
    certification_state: CertificationStateEnum
    
    effective_at: Optional[datetime] = None
    expires_at: datetime
    
    notes: Optional[str] = None


class ConformanceRecordResponse(BaseSchema):
    id: UUID
    record_number: str
    
    system_id: UUID
    envelope_id: UUID
    account_id: UUID
    cat72_test_id: Optional[UUID] = None
    
    certification_state: CertificationStateEnum
    odd_class: ODDClassEnum
    
    issued_at: datetime
    effective_at: datetime
    expires_at: datetime
    
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    
    record_hash: str
    signature: str
    signature_algorithm: str
    signing_key_id: Optional[str] = None
    
    previous_record_id: Optional[UUID] = None
    
    notes: Optional[str] = None
    
    created_at: datetime


class VerificationRequest(BaseModel):
    record_id: Optional[str] = None
    record_hash: Optional[str] = None


class VerificationResponse(BaseModel):
    is_valid: bool
    record_number: Optional[str] = None
    certification_state: Optional[CertificationStateEnum] = None
    system_name: Optional[str] = None
    account_name: Optional[str] = None
    odd_class: Optional[ODDClassEnum] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_revoked: bool = False
    revocation_reason: Optional[str] = None
    verification_timestamp: datetime
    message: str


# ============================================================================
# TASK SCHEMAS
# ============================================================================

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    task_type: Optional[str] = Field(None, max_length=50)
    priority: str = Field("medium", pattern="^(low|medium|high|critical)$")
    
    system_id: Optional[UUID] = None
    conformance_record_id: Optional[UUID] = None
    
    assigned_to: Optional[UUID] = None
    due_at: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    status: Optional[str] = Field(None, pattern="^(open|in_progress|completed|cancelled)$")
    
    assigned_to: Optional[UUID] = None
    due_at: Optional[datetime] = None


class TaskResponse(BaseSchema):
    id: UUID
    account_id: UUID
    
    title: str
    description: Optional[str] = None
    
    task_type: Optional[str] = None
    priority: str
    
    system_id: Optional[UUID] = None
    conformance_record_id: Optional[UUID] = None
    
    assigned_to: Optional[UUID] = None
    
    status: str
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    created_at: datetime
    updated_at: datetime


# ============================================================================
# API KEY SCHEMAS
# ============================================================================

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: List[str] = Field(default=["read"])
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseSchema):
    id: UUID
    account_id: UUID
    key_prefix: str
    name: str
    scopes: List[str]
    is_active: bool
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime


class APIKeyCreated(APIKeyResponse):
    api_key: str


# ============================================================================
# PAGINATION & LIST RESPONSES
# ============================================================================

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int


# ============================================================================
# AUTH SCHEMAS
# ============================================================================

class TokenRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


# ============================================================================
# DASHBOARD SCHEMAS
# ============================================================================

class DashboardMetrics(BaseModel):
    total_accounts: int
    active_accounts: int
    total_systems: int
    certified_systems: int
    bounded_systems: int
    observe_systems: int
    active_cat72_tests: int
    passed_cat72_tests_30d: int
    failed_cat72_tests_30d: int
    expiring_certifications_30d: int


class RecentActivity(BaseModel):
    id: UUID
    event_type: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    timestamp: datetime
