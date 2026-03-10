# audit.py -- Sentinel Authority Audit Logging System
# Drop this file into your FastAPI backend directory.
#
# INTEGRATION STEPS:
# 1. Copy this file to your backend directory (alongside main.py)
# 2. In main.py, add:
#       from audit import router as audit_router, log_event, init_audit_table
#       app.include_router(audit_router)
#       # Call init_audit_table() after your DB connection is established
# 3. In your existing route handlers, call log_event() to record events.
#    See USAGE EXAMPLES at the bottom of this file.
#
# REQUIREMENTS: pip install fastapi sqlalchemy psycopg2-binary python-jose hashlib
#
# DATABASE: Uses the same PostgreSQL connection your app already has.
# Adds one table: audit_log
# No migrations needed -- table is created on startup via init_audit_table().

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import (
    create_engine, text, Column, Integer, String, DateTime,
    JSON, Index, inspect as sa_inspect
)
from sqlalchemy.orm import declarative_base, Session, sessionmaker

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Railway provides postgresql:// but SQLAlchemy 2.x needs postgresql+psycopg2://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

_engine = None
_SessionLocal = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    return _engine

def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base = declarative_base()

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

class AuditEvent(Base):
    __tablename__ = "audit_log"

    id            = Column(Integer, primary_key=True, index=True)
    timestamp     = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    user_id       = Column(Integer, nullable=True)
    user_email    = Column(String(255), nullable=True)
    user_role     = Column(String(64), nullable=True)
    action        = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id   = Column(String(128), nullable=True)
    details       = Column(JSON, nullable=True)
    ip_address    = Column(String(64), nullable=True)
    log_hash      = Column(String(64), nullable=True)  # SHA-256 chain hash

    __table_args__ = (
        Index("ix_audit_timestamp",     "timestamp"),
        Index("ix_audit_action",        "action"),
        Index("ix_audit_user_email",    "user_email"),
        Index("ix_audit_resource_type", "resource_type"),
    )


def init_audit_table():
    """Call once on app startup to create the audit_log table if it doesn't exist."""
    try:
        engine = get_engine()
        inspector = sa_inspect(engine)
        if "audit_log" not in inspector.get_table_names():
            Base.metadata.create_all(engine, tables=[AuditEvent.__table__])
            print("[audit] Created audit_log table")
        else:
            print("[audit] audit_log table already exists")
    except Exception as e:
        print(f"[audit] WARNING: Could not init audit table: {e}")


# ---------------------------------------------------------------------------
# Action taxonomy
# ---------------------------------------------------------------------------

ACTIONS = [
    # Applications
    "application.submitted",
    "application.approved",
    "application.rejected",
    "application.suspended",
    "application.revoked",
    "application.resubmitted",
    # Certificates
    "certificate.issued",
    "certificate.revoked",
    "certificate.suspended",
    "certificate.expired",
    # CAT-72
    "cat72.scheduled",
    "cat72.started",
    "cat72.stopped",
    "cat72.passed",
    "cat72.failed",
    # ENVELO boundaries
    "boundary.configured",
    "boundary.committed",
    "boundary.violated",
    "boundary.blocked",
    # Auth
    "user.login",
    "user.logout",
    "user.registered",
    "user.password_changed",
    "user.role_changed",
    "user.2fa_enabled",
    "user.2fa_disabled",
    # API keys
    "apikey.created",
    "apikey.revoked",
    # Admin
    "admin.user_created",
    "admin.settings_changed",
]

RESOURCE_TYPES = [
    "application",
    "certificate",
    "cat72_test",
    "boundary",
    "user",
    "apikey",
    "session",
]


# ---------------------------------------------------------------------------
# Core logging utility
# ---------------------------------------------------------------------------

def _compute_hash(event_id: int, timestamp: str, user_email: str, action: str,
                  resource_type: str, resource_id: str, details: Any) -> str:
    """SHA-256 hash of the event's critical fields for integrity chaining."""
    payload = f"{event_id}|{timestamp}|{user_email}|{action}|{resource_type}|{resource_id}|{json.dumps(details, sort_keys=True, default=str)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def log_event(
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    details: dict = None,
    user_id: int = None,
    user_email: str = None,
    user_role: str = None,
    ip_address: str = None,
    db: Session = None,
):
    """
    Record an audit event. Call this from any route handler.

    Usage:
        from audit import log_event

        log_event(
            action="application.approved",
            resource_type="application",
            resource_id=str(app.id),
            details={"new_state": "approved", "org": app.organization_name},
            user_email=current_user.email,
            user_role=current_user.role,
            db=db,
        )

    If db is None, a new session is opened and committed automatically.
    """
    _own_session = db is None
    if _own_session:
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(bind=get_engine())
        db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)
        event = AuditEvent(
            timestamp     = now,
            user_id       = user_id,
            user_email    = user_email or "system",
            user_role     = user_role,
            action        = action,
            resource_type = resource_type,
            resource_id   = str(resource_id) if resource_id else None,
            details       = details or {},
            ip_address    = ip_address,
        )
        db.add(event)
        db.flush()  # get the ID

        # Compute integrity hash
        event.log_hash = _compute_hash(
            event.id,
            now.isoformat(),
            event.user_email,
            event.action,
            event.resource_type or "",
            event.resource_id or "",
            event.details,
        )

        if _own_session:
            db.commit()
        else:
            db.flush()

    except Exception as e:
        print(f"[audit] Failed to log event '{action}': {e}")
        if _own_session:
            db.rollback()
    finally:
        if _own_session:
            db.close()


def log_event_from_request(
    request: Request,
    action: str,
    current_user=None,
    resource_type: str = None,
    resource_id: str = None,
    details: dict = None,
    db: Session = None,
):
    """Convenience wrapper that extracts IP and user info from request/current_user."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    log_event(
        action        = action,
        resource_type = resource_type,
        resource_id   = resource_id,
        details       = details,
        user_id       = getattr(current_user, "id", None),
        user_email    = getattr(current_user, "email", None),
        user_role     = getattr(current_user, "role", None),
        ip_address    = ip,
        db            = db,
    )


# ---------------------------------------------------------------------------
# Auth dependency (reuse your existing pattern)
# ---------------------------------------------------------------------------

# This imports your existing get_current_user dependency.
# Adjust the import path to match your project structure.
try:
    from auth import get_current_user, get_current_admin_user as get_current_admin
except ImportError:
    try:
        from routers.auth import get_current_user, get_current_admin_user as get_current_admin
    except ImportError:
        # Fallback stubs -- replace with your actual auth dependencies
        async def get_current_user():
            raise HTTPException(status_code=401, detail="Auth not configured")
        async def get_current_admin():
            raise HTTPException(status_code=401, detail="Auth not configured")


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/audit", tags=["audit"])


# GET /api/audit/logs
@router.get("/logs")
def get_audit_logs(
    action:        Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    user_email:    Optional[str] = Query(None),
    date_from:     Optional[str] = Query(None),
    date_to:       Optional[str] = Query(None),
    limit:         int           = Query(50, ge=1, le=10000),
    offset:        int           = Query(0, ge=0),
    db:            Session       = Depends(get_session),
    current_user                 = Depends(get_current_user),
):
    """Full paginated audit log. Admins see all events; regular users see only their own."""
    conditions = []
    params = {}

    # Role gate: non-admins only see their own events
    if getattr(current_user, "role", None) not in ("admin", "auditor"):
        conditions.append("user_email = :email_gate")
        params["email_gate"] = current_user.email

    if action:
        conditions.append("action = :action")
        params["action"] = action

    if resource_type:
        conditions.append("resource_type = :resource_type")
        params["resource_type"] = resource_type

    if user_email and getattr(current_user, "role", None) in ("admin", "auditor"):
        conditions.append("user_email ILIKE :user_email")
        params["user_email"] = f"%{user_email}%"

    if date_from:
        conditions.append("timestamp >= :date_from")
        params["date_from"] = date_from

    if date_to:
        conditions.append("timestamp <= :date_to")
        params["date_to"] = date_to

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_sql = text(f"SELECT COUNT(*) FROM audit_log {where}")
    total = db.execute(count_sql, params).scalar() or 0

    logs_sql = text(f"""
        SELECT id, timestamp, user_email, user_role, action,
               resource_type, resource_id, details, ip_address, log_hash
        FROM audit_log
        {where}
        ORDER BY timestamp DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = db.execute(logs_sql, {**params, "limit": limit, "offset": offset}).fetchall()

    return {
        "logs":  [_row_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# GET /api/audit/admin-logs  (Dashboard admin activity feed)
@router.get("/admin-logs")
def get_admin_logs(
    limit:       int     = Query(8, ge=1, le=100),
    offset:      int     = Query(0, ge=0),
    db:          Session = Depends(get_session),
    current_user         = Depends(get_current_user),
):
    """Recent activity feed for the admin dashboard."""
    if getattr(current_user, "role", None) not in ("admin", "auditor"):
        raise HTTPException(status_code=403, detail="Admin access required")

    rows = db.execute(text("""
        SELECT id, timestamp, user_email, user_role, action,
               resource_type, resource_id, details, ip_address, log_hash
        FROM audit_log
        ORDER BY timestamp DESC
        LIMIT :limit OFFSET :offset
    """), {"limit": limit, "offset": offset}).fetchall()

    total = db.execute(text("SELECT COUNT(*) FROM audit_log")).scalar() or 0

    return {
        "logs":  [_row_to_dict(r) for r in rows],
        "total": total,
    }


# GET /api/audit/my-logs  (Dashboard user's own activity)
@router.get("/my-logs")
def get_my_logs(
    limit:       int     = Query(5, ge=1, le=100),
    offset:      int     = Query(0, ge=0),
    db:          Session = Depends(get_session),
    current_user         = Depends(get_current_user),
):
    """The current user's own audit events."""
    rows = db.execute(text("""
        SELECT id, timestamp, user_email, user_role, action,
               resource_type, resource_id, details, ip_address, log_hash
        FROM audit_log
        WHERE user_email = :email
        ORDER BY timestamp DESC
        LIMIT :limit OFFSET :offset
    """), {"email": current_user.email, "limit": limit, "offset": offset}).fetchall()

    total = db.execute(text("""
        SELECT COUNT(*) FROM audit_log WHERE user_email = :email
    """), {"email": current_user.email}).scalar() or 0

    return {
        "logs":  [_row_to_dict(r) for r in rows],
        "total": total,
    }


# GET /api/audit/actions  (filter dropdown options)
@router.get("/actions")
def get_audit_actions(current_user = Depends(get_current_user)):
    return {"actions": ACTIONS}


# GET /api/audit/resource-types  (filter dropdown options)
@router.get("/resource-types")
def get_resource_types(current_user = Depends(get_current_user)):
    return {"resource_types": RESOURCE_TYPES}


# GET /api/audit/verify  (integrity chain verification)
@router.get("/verify")
def verify_audit_integrity(
    limit:       int     = Query(5000, ge=1, le=50000),
    db:          Session = Depends(get_session),
    current_user         = Depends(get_current_user),
):
    """
    Re-computes the hash for each audit event and compares it to the stored hash.
    Returns a summary of valid/invalid entries.
    Used by ActivityPage to display chain integrity status.
    """
    if getattr(current_user, "role", None) not in ("admin", "auditor"):
        raise HTTPException(status_code=403, detail="Admin access required")

    rows = db.execute(text("""
        SELECT id, timestamp, user_email, action, resource_type, resource_id, details, log_hash
        FROM audit_log
        ORDER BY id ASC
        LIMIT :limit
    """), {"limit": limit}).fetchall()

    valid = 0
    invalid = 0
    tampered = []

    for row in rows:
        expected = _compute_hash(
            row.id,
            row.timestamp.isoformat() if hasattr(row.timestamp, 'isoformat') else str(row.timestamp),
            row.user_email or "",
            row.action,
            row.resource_type or "",
            row.resource_id or "",
            row.details or {},
        )
        if row.log_hash and row.log_hash == expected:
            valid += 1
        else:
            invalid += 1
            tampered.append({"id": row.id, "action": row.action})

    return {
        "integrity": "passed" if invalid == 0 else "failed",
        "checked":   len(rows),
        "valid":     valid,
        "invalid":   invalid,
        "tampered":  tampered[:20],  # cap to avoid huge responses
    }


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _row_to_dict(row) -> dict:
    ts = row.timestamp
    return {
        "id":            row.id,
        "timestamp":     ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
        "user_email":    row.user_email,
        "user_role":     row.user_role,
        "action":        row.action,
        "resource_type": row.resource_type,
        "resource_id":   row.resource_id,
        "details":       row.details or {},
        "ip_address":    row.ip_address,
        "log_hash":      row.log_hash,
    }


# ===========================================================================
# USAGE EXAMPLES -- paste these into your existing route handlers
# ===========================================================================
#
# 1. LOGIN
#    In your /api/auth/login handler, after successful auth:
#
#    log_event(
#        action="user.login",
#        resource_type="session",
#        user_email=user.email,
#        user_role=user.role,
#        details={"method": "password"},
#        db=db,
#    )
#
# 2. APPLICATION APPROVED
#    In your application approval handler:
#
#    log_event_from_request(
#        request=request,
#        action="application.approved",
#        current_user=current_user,
#        resource_type="application",
#        resource_id=str(app.id),
#        details={"org": app.organization_name, "system": app.system_name, "new_state": "approved"},
#        db=db,
#    )
#
# 3. CERTIFICATE ISSUED
#    In your certificate issuance handler:
#
#    log_event(
#        action="certificate.issued",
#        resource_type="certificate",
#        resource_id=cert.certificate_number,
#        details={"org": app.organization_name, "system": app.system_name},
#        user_email=current_user.email,
#        user_role=current_user.role,
#        db=db,
#    )
#
# 4. CAT-72 STARTED
#    In your cat72 start handler:
#
#    log_event(
#        action="cat72.started",
#        resource_type="cat72_test",
#        resource_id=test.test_id,
#        details={"system": test.system_name, "duration_hours": test.duration_hours},
#        user_email=current_user.email,
#        user_role=current_user.role,
#        db=db,
#    )
#
# 5. BOUNDARY COMMITTED (from PolicyEngine)
#    In your /api/envelo/boundaries/configure handler:
#
#    log_event(
#        action="boundary.committed",
#        resource_type="boundary",
#        resource_id=str(system_id),
#        details={"domain": domain, "violation_action": violation_action, "boundaries": boundaries},
#        user_email=current_user.email,
#        db=db,
#    )
#
# 6. ROLE CHANGED (UserManagement)
#
#    log_event(
#        action="user.role_changed",
#        resource_type="user",
#        resource_id=str(target_user.id),
#        details={"target_email": target_user.email, "old_role": old_role, "new_role": new_role},
#        user_email=current_user.email,
#        user_role=current_user.role,
#        db=db,
#    )
