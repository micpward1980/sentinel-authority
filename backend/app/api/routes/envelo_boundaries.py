"""
ENVELO Boundaries API
Serves approved boundary configurations to agents at startup
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.models import Certificate, Application, APIKey, CertificationState
from app.api.routes.envelo import get_api_key_from_header

router = APIRouter()


# ============================================
# BOUNDARY SCHEMA DEFINITIONS
# ============================================

class NumericBoundary(BaseModel):
    """Numeric range boundary (speed, temperature, etc.)"""
    type: str = "numeric"
    name: str
    parameter: str  # The parameter name to check
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: str = ""
    tolerance: float = 0.0  # Allowed deviation before violation
    violation_action: str = "block"  # block, warn, log


class GeoBoundary(BaseModel):
    """Geographic boundary (geofence)"""
    type: str = "geo"
    name: str
    boundary_type: str = "polygon"  # polygon, circle, rectangle
    coordinates: List[Dict[str, float]] = []  # List of {lat, lon} points
    center: Optional[Dict[str, float]] = None  # For circle: {lat, lon}
    radius_meters: Optional[float] = None  # For circle
    violation_action: str = "block"


class TimeBoundary(BaseModel):
    """Time-based boundary (operating hours)"""
    type: str = "time"
    name: str
    allowed_hours_start: int = 0  # 0-23
    allowed_hours_end: int = 23
    allowed_days: List[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Monday
    timezone: str = "UTC"
    violation_action: str = "block"


class StateBoundary(BaseModel):
    """State-based boundary (allowed operational states)"""
    type: str = "state"
    name: str
    parameter: str
    allowed_values: List[str] = []
    forbidden_values: List[str] = []
    violation_action: str = "block"


class RateBoundary(BaseModel):
    """Rate limit boundary"""
    type: str = "rate"
    name: str
    parameter: str
    max_per_second: Optional[float] = None
    max_per_minute: Optional[float] = None
    max_per_hour: Optional[float] = None
    violation_action: str = "block"


class BoundaryConfig(BaseModel):
    """Complete boundary configuration for a certified system"""
    certificate_id: str
    certificate_number: str
    organization_name: str
    system_name: str
    system_version: str
    approved_at: str
    expires_at: str
    
    # ODD Definition
    odd_description: str = ""
    environment_type: str = ""  # indoor, outdoor, mixed
    operational_context: str = ""
    
    # Boundaries
    numeric_boundaries: List[Dict[str, Any]] = []
    geo_boundaries: List[Dict[str, Any]] = []
    time_boundaries: List[Dict[str, Any]] = []
    state_boundaries: List[Dict[str, Any]] = []
    rate_boundaries: List[Dict[str, Any]] = []
    
    # Safe state configuration
    safe_state: Dict[str, Any] = {}
    
    # Enforcement settings
    fail_closed: bool = True  # If enforcement fails, block action
    telemetry_interval_seconds: float = 1.0
    heartbeat_interval_seconds: float = 60.0


# ============================================
# API ENDPOINTS
# ============================================

@router.get("/config")
async def get_boundary_config(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """
    Agent calls this on startup to get approved boundary configuration.
    Boundaries are defined during application review and stored with certificate.
    Agent enforces these exactly - no local override allowed.
    """
    
    # Get certificates associated with this API key's user
    # First, find any active sessions or certificates linked to this key
    from app.models.models import EnveloSession
    
    # Check for active session with this API key
    session_result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.api_key_id == api_key.id,
            EnveloSession.status == "active"
        ).order_by(EnveloSession.started_at.desc())
    )
    session = session_result.scalars().first()
    
    cert = None
    
    if session and session.certificate_id:
        # Get certificate from session
        cert_result = await db.execute(
            select(Certificate).where(Certificate.id == session.certificate_id)
        )
        cert = cert_result.scalar_one_or_none()
    
    if not cert and api_key.certificate_id:
        # Direct lookup from API key certificate link
        cert_result = await db.execute(
            select(Certificate).where(Certificate.id == api_key.certificate_id)
        )
        cert = cert_result.scalar_one_or_none()

    if not cert:
        # Try to find certificate by user's applications
        from app.models.models import User
        user_result = await db.execute(
            select(User).where(User.id == api_key.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if user:
            # Get the user's most recent valid certificate
            cert_result = await db.execute(
                select(Certificate).join(Application).where(
                    Application.applicant_id == user.id,
                    Certificate.state.in_(["active", 
                        "conformant",
                        "observe",
                        "bounded"
                    ])
                ).order_by(Certificate.issued_at.desc())
            )
            cert = cert_result.scalar_one_or_none()
    
    if not cert:
        raise HTTPException(
            status_code=404, 
            detail="No active certificate found for this API key. Complete CAT-72 certification first."
        )
    
    # Get the application for full ODD details
    app_result = await db.execute(
        select(Application).where(Application.id == cert.application_id)
    )
    application = app_result.scalar_one_or_none()
    
    # Build boundary config from stored data
    odd_spec = cert.odd_specification or (application.odd_specification if application else None) or {}
    envelope_def = cert.envelope_definition or (application.envelope_definition if application else None) or {}
    
    # Parse boundaries from envelope definition
    # The envelope_definition JSON should have structured boundary data
    boundaries = envelope_def if isinstance(envelope_def, dict) else {}

    return BoundaryConfig(
        certificate_id=str(cert.id),
        certificate_number=cert.certificate_number,
        organization_name=cert.organization_name,
        system_name=cert.system_name,
        system_version=cert.system_version or "",
        approved_at=cert.issued_at.isoformat() if cert.issued_at else "",
        expires_at=cert.expires_at.isoformat() if cert.expires_at else "",
        odd_description=odd_spec.get("description", "") if isinstance(odd_spec, dict) else str(odd_spec),
        environment_type=odd_spec.get("environment_type", "") if isinstance(odd_spec, dict) else "",
        operational_context=odd_spec.get("operational_context", "") if isinstance(odd_spec, dict) else "",
        numeric_boundaries=boundaries.get("numeric_boundaries", []),
        geo_boundaries=boundaries.get("geo_boundaries", []),
        time_boundaries=boundaries.get("time_boundaries", []),
        state_boundaries=boundaries.get("state_boundaries", []),
        rate_boundaries=boundaries.get("rate_boundaries", []),
        safe_state=boundaries.get("safe_state", {"action": "stop", "notify": True, "log": True}),
        fail_closed=boundaries.get("fail_closed", True),
        telemetry_interval_seconds=boundaries.get("telemetry_interval", 1.0),
        heartbeat_interval_seconds=boundaries.get("heartbeat_interval", 60.0),
    )


@router.get("/config/test")
async def get_test_boundary_config(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """
    For CAT-72 testing - returns boundaries from approved application
    even before certificate is issued.
    """
    
    # Get the user's approved (but not yet certified) application
    from app.models.models import User
    
    user_result = await db.execute(
        select(User).where(User.id == api_key.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find approved application pending CAT-72
    app_result = await db.execute(
        select(Application).where(
            Application.applicant_id == user.id,
            Application.state.in_([
                "observe",
                "bounded",
                "approved"  # Add if you have this state
            ])
        ).order_by(Application.submitted_at.desc())
    )
    application = app_result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=404,
            detail="No approved application found. Application must be approved before CAT-72 testing."
        )
    
    odd_spec = application.odd_specification or {}
    envelope_def = application.envelope_definition or {}
    boundaries = envelope_def if isinstance(envelope_def, dict) else {}
    
    return {
        "mode": "test",
        "application_id": application.id,
        "application_number": application.application_number,
        "organization_name": application.organization_name,
        "system_name": application.system_name,
        "system_version": application.system_version or "",
        
        "odd_description": odd_spec.get("description", "") if isinstance(odd_spec, dict) else str(odd_spec),
        "environment_type": odd_spec.get("environment_type", "") if isinstance(odd_spec, dict) else "",
        
        "numeric_boundaries": boundaries.get("numeric_boundaries", []),
        "geo_boundaries": boundaries.get("geo_boundaries", []),
        "time_boundaries": boundaries.get("time_boundaries", []),
        "state_boundaries": boundaries.get("state_boundaries", []),
        "rate_boundaries": boundaries.get("rate_boundaries", []),
        
        "safe_state": boundaries.get("safe_state", {"action": "stop"}),
        "fail_closed": boundaries.get("fail_closed", True),
    }


@router.put("/config/boundaries")
async def update_boundary_config(
    boundaries: Dict[str, Any],
    certificate_number: str,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """
    Admin endpoint to update boundary configuration for a certificate.
    Used during application review to set structured boundaries.
    """
    
    # Verify admin
    from app.models.models import User
    user_result = await db.execute(
        select(User).where(User.id == api_key.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get certificate
    cert_result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == certificate_number)
    )
    cert = cert_result.scalar_one_or_none()
    
    if not cert and api_key.certificate_id:
        # Direct lookup from API key certificate link
        cert_result = await db.execute(
            select(Certificate).where(Certificate.id == api_key.certificate_id)
        )
        cert = cert_result.scalar_one_or_none()

    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Update envelope definition with structured boundaries
    cert.envelope_definition = boundaries
    
    # Log the change
    history = cert.history or []
    history.append({
        "action": "boundaries_updated",
        "timestamp": datetime.utcnow().isoformat(),
        "by": user.email,
        "summary": f"Updated {len(boundaries.get('numeric_boundaries', []))} numeric, "
                   f"{len(boundaries.get('geo_boundaries', []))} geo, "
                   f"{len(boundaries.get('time_boundaries', []))} time boundaries"
    })
    cert.history = history
    
    await db.commit()
    
    return {"message": "Boundary configuration updated", "certificate_number": certificate_number}


# ============================================
# DISCOVERED BOUNDARIES (auto-discovery upload)
# ============================================

class DiscoveredEnvelope(BaseModel):
    session_id: str
    envelope_definition: Dict[str, Any]


@router.post("/discovered", summary="Upload auto-discovered envelope")
async def upload_discovered_boundaries(
    data: DiscoveredEnvelope,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """
    Receives the auto-discovered envelope definition from an ENVELO agent.
    Stores it on the session record for audit and review.
    """
    from app.models.models import EnveloSession

    result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.session_id == data.session_id,
            EnveloSession.api_key_id == api_key.id,
            EnveloSession.status == "active"
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    # Store envelope on session metadata
    if not session.metadata_json:
        session.metadata_json = {}
    session.metadata_json["discovered_envelope"] = data.envelope_definition
    session.metadata_json["envelope_discovered_at"] = datetime.utcnow().isoformat()
    flag_modified(session, "metadata_json")

    await db.commit()

    return {
        "status": "received",
        "session_id": data.session_id,
        "boundaries_count": len(data.envelope_definition.get("boundaries", {}).get("numeric", []))
            + len(data.envelope_definition.get("boundaries", {}).get("categorical", []))
            + len(data.envelope_definition.get("boundaries", {}).get("geographic", []))
            + len(data.envelope_definition.get("boundaries", {}).get("temporal", []))
    }


@router.get("/debug")
async def debug_boundary_config(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Debug: show raw cert data"""
    cert = None
    if api_key.certificate_id:
        cert_result = await db.execute(
            select(Certificate).where(Certificate.id == api_key.certificate_id)
        )
        cert = cert_result.scalar_one_or_none()
    
    if not cert:
        return {"error": "no cert found", "api_key_id": api_key.id, "cert_id": api_key.certificate_id}
    
    return {
        "cert_id": cert.id,
        "cert_number": cert.certificate_number,
        "state": cert.state,
        "system_version": cert.system_version,
        "application_id": cert.application_id,
        "odd_spec_type": str(type(cert.odd_specification)),
        "odd_spec": cert.odd_specification,
        "envelope_type": str(type(cert.envelope_definition)),
        "envelope": cert.envelope_definition,
    }
