"""
Envelopes router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import hashlib
import json
import logging

from database import get_db, Envelope, System
from schemas import EnvelopeCreate, EnvelopeResponse, PaginatedResponse
from routers.auth import get_current_user, require_role, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


def compute_specification_hash(specification: dict) -> str:
    """Compute SHA-256 hash of envelope specification."""
    spec_json = json.dumps(specification, sort_keys=True)
    return hashlib.sha256(spec_json.encode()).hexdigest()


def parse_version(version: str) -> tuple[int, int, int]:
    """Parse semantic version string."""
    parts = version.split("-")[0].split(".")
    return int(parts[0]), int(parts[1]), int(parts[2])


@router.get("", response_model=PaginatedResponse)
async def list_envelopes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    system_id: Optional[UUID] = None,
    is_approved: Optional[bool] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List envelopes with pagination and filters."""
    
    # Build query
    query = select(Envelope).join(System)
    
    # Filter by account access
    if current_user.role != "admin":
        query = query.where(System.account_id == current_user.account_id)
    
    if system_id:
        query = query.where(Envelope.system_id == system_id)
    
    if is_approved is not None:
        query = query.where(Envelope.is_approved == is_approved)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    # Apply pagination
    query = query.order_by(Envelope.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Execute
    result = await db.execute(query)
    envelopes = result.scalars().all()
    
    return PaginatedResponse(
        items=[EnvelopeResponse.model_validate(e) for e in envelopes],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=EnvelopeResponse, status_code=status.HTTP_201_CREATED)
async def create_envelope(
    system_id: UUID,
    envelope_data: EnvelopeCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new envelope version for a system."""
    
    # Get system
    result = await db.execute(
        select(System).where(System.id == system_id)
    )
    system = result.scalar_one_or_none()
    
    if not system:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="System not found"
        )
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != system.account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create envelopes for this system"
        )
    
    # Check version doesn't already exist
    result = await db.execute(
        select(Envelope).where(
            Envelope.system_id == system_id,
            Envelope.version == envelope_data.version
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Envelope version {envelope_data.version} already exists for this system"
        )
    
    # Parse version
    major, minor, patch = parse_version(envelope_data.version)
    
    # Compute specification hash
    spec_hash = compute_specification_hash(envelope_data.specification)
    
    # Create envelope
    envelope = Envelope(
        system_id=system_id,
        version=envelope_data.version,
        version_major=major,
        version_minor=minor,
        version_patch=patch,
        specification=envelope_data.specification,
        velocity_max_mps=envelope_data.velocity_max_mps,
        acceleration_max_mps2=envelope_data.acceleration_max_mps2,
        angular_velocity_max_radps=envelope_data.angular_velocity_max_radps,
        position_bounds=envelope_data.position_bounds,
        temperature_min_c=envelope_data.temperature_min_c,
        temperature_max_c=envelope_data.temperature_max_c,
        wind_speed_max_mps=envelope_data.wind_speed_max_mps,
        visibility_min_m=envelope_data.visibility_min_m,
        max_decisions_per_second=envelope_data.max_decisions_per_second,
        max_actuations_per_second=envelope_data.max_actuations_per_second,
        invariants=[inv.model_dump() for inv in envelope_data.invariants] if envelope_data.invariants else [],
        specification_hash=spec_hash,
        notes=envelope_data.notes,
        created_by=current_user.user_id
    )
    
    db.add(envelope)
    await db.commit()
    await db.refresh(envelope)
    
    logger.info(f"Created envelope {envelope.version} for system {system.system_number}")
    
    return envelope


@router.get("/{envelope_id}", response_model=EnvelopeResponse)
async def get_envelope(
    envelope_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get envelope by ID."""
    
    result = await db.execute(
        select(Envelope).join(System).where(Envelope.id == envelope_id)
    )
    envelope = result.scalar_one_or_none()
    
    if not envelope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Envelope not found"
        )
    
    # Get system for access check
    result = await db.execute(
        select(System).where(System.id == envelope.system_id)
    )
    system = result.scalar_one_or_none()
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != system.account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this envelope"
        )
    
    return envelope


@router.post("/{envelope_id}/approve", response_model=EnvelopeResponse)
async def approve_envelope(
    envelope_id: UUID,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Approve an envelope (admin only)."""
    
    result = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = result.scalar_one_or_none()
    
    if not envelope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Envelope not found"
        )
    
    if envelope.is_approved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Envelope is already approved"
        )
    
    # Approve
    envelope.is_approved = True
    envelope.approved_at = datetime.utcnow()
    envelope.approved_by = current_user.user_id
    
    await db.commit()
    await db.refresh(envelope)
    
    logger.info(f"Approved envelope {envelope.id}")
    
    return envelope


@router.post("/{envelope_id}/set-current", response_model=EnvelopeResponse)
async def set_current_envelope(
    envelope_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set an approved envelope as the current active envelope for its system."""
    
    result = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = result.scalar_one_or_none()
    
    if not envelope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Envelope not found"
        )
    
    # Get system
    result = await db.execute(
        select(System).where(System.id == envelope.system_id)
    )
    system = result.scalar_one_or_none()
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != system.account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this system"
        )
    
    # Envelope must be approved
    if not envelope.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envelope must be approved before it can be set as current"
        )
    
    # Update system's current envelope
    system.current_envelope_id = envelope_id
    
    await db.commit()
    await db.refresh(envelope)
    
    logger.info(f"Set envelope {envelope.version} as current for system {system.system_number}")
    
    return envelope


@router.get("/{envelope_id}/diff")
async def diff_envelopes(
    envelope_id: UUID,
    compare_to: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Compare two envelope versions."""
    
    # Get both envelopes
    result = await db.execute(
        select(Envelope).where(Envelope.id.in_([envelope_id, compare_to]))
    )
    envelopes = {e.id: e for e in result.scalars().all()}
    
    if len(envelopes) != 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both envelopes not found"
        )
    
    env1 = envelopes[envelope_id]
    env2 = envelopes[compare_to]
    
    # Verify same system
    if env1.system_id != env2.system_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envelopes must belong to the same system"
        )
    
    # Get system for access check
    result = await db.execute(
        select(System).where(System.id == env1.system_id)
    )
    system = result.scalar_one_or_none()
    
    if current_user.role != "admin" and current_user.account_id != system.account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access these envelopes"
        )
    
    # Generate diff
    changes = []
    
    # Compare scalar fields
    scalar_fields = [
        "velocity_max_mps", "acceleration_max_mps2", "angular_velocity_max_radps",
        "temperature_min_c", "temperature_max_c", "wind_speed_max_mps",
        "visibility_min_m", "max_decisions_per_second", "max_actuations_per_second"
    ]
    
    for field in scalar_fields:
        val1 = getattr(env1, field)
        val2 = getattr(env2, field)
        if val1 != val2:
            changes.append({
                "field": field,
                "from": val1,
                "to": val2
            })
    
    # Compare invariants
    if env1.invariants != env2.invariants:
        changes.append({
            "field": "invariants",
            "from": len(env1.invariants or []),
            "to": len(env2.invariants or []),
            "details": "Invariants changed"
        })
    
    return {
        "base_version": env1.version,
        "compare_version": env2.version,
        "specification_hash_changed": env1.specification_hash != env2.specification_hash,
        "changes": changes
    }
