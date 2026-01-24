"""
Systems router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
import logging

from database import get_db, System, Account, Envelope
from schemas import (
    SystemCreate, SystemUpdate, SystemResponse, SystemSummary,
    PaginatedResponse, CertificationStateEnum
)
from routers.auth import get_current_user, require_role, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_systems(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    account_id: Optional[UUID] = None,
    certification_state: Optional[CertificationStateEnum] = None,
    odd_class: Optional[str] = None,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List systems with pagination and filters."""
    
    # Build query
    query = select(System)
    
    # Filter by account access
    if current_user.role != "admin":
        query = query.where(System.account_id == current_user.account_id)
    elif account_id:
        query = query.where(System.account_id == account_id)
    
    # Apply filters
    if certification_state:
        query = query.where(System.certification_state == certification_state)
    
    if odd_class:
        query = query.where(System.odd_class == odd_class)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (System.name.ilike(search_term)) |
            (System.system_number.ilike(search_term))
        )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    # Apply pagination
    query = query.order_by(System.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Execute
    result = await db.execute(query)
    systems = result.scalars().all()
    
    return PaginatedResponse(
        items=[SystemSummary.model_validate(s) for s in systems],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=SystemResponse, status_code=status.HTTP_201_CREATED)
async def create_system(
    system_data: SystemCreate,
    account_id: Optional[UUID] = Query(None, description="Account ID (admin only)"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new system."""
    
    # Determine account
    if current_user.role == "admin" and account_id:
        target_account_id = account_id
    elif current_user.account_id:
        target_account_id = current_user.account_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account ID is required"
        )
    
    # Verify account exists
    result = await db.execute(
        select(Account).where(Account.id == target_account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Create system
    system = System(
        account_id=target_account_id,
        name=system_data.name,
        description=system_data.description,
        version=system_data.version,
        odd_class=system_data.odd_class,
        odd_class_custom=system_data.odd_class_custom,
        manufacturer=system_data.manufacturer,
        model_number=system_data.model_number,
        serial_number=system_data.serial_number,
        metadata=system_data.metadata or {}
    )
    
    db.add(system)
    await db.commit()
    await db.refresh(system)
    
    logger.info(f"Created system {system.system_number} for account {target_account_id}")
    
    return system


@router.get("/{system_id}", response_model=SystemResponse)
async def get_system(
    system_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get system by ID."""
    
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
            detail="Not authorized to access this system"
        )
    
    return system


@router.patch("/{system_id}", response_model=SystemResponse)
async def update_system(
    system_id: UUID,
    system_data: SystemUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a system."""
    
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
            detail="Not authorized to modify this system"
        )
    
    # Update fields
    update_data = system_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(system, field, value)
    
    await db.commit()
    await db.refresh(system)
    
    logger.info(f"Updated system {system.system_number}")
    
    return system


@router.delete("/{system_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system(
    system_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a system."""
    
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
            detail="Not authorized to delete this system"
        )
    
    # Check if system has active certifications
    if system.certification_state in ["certified", "bounded"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete system with active certification"
        )
    
    await db.delete(system)
    await db.commit()
    
    logger.info(f"Deleted system {system.system_number}")


@router.post("/{system_id}/state", response_model=SystemResponse)
async def update_certification_state(
    system_id: UUID,
    new_state: CertificationStateEnum,
    reason: Optional[str] = None,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Update system certification state (admin only)."""
    
    result = await db.execute(
        select(System).where(System.id == system_id)
    )
    system = result.scalar_one_or_none()
    
    if not system:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="System not found"
        )
    
    # Validate state transition
    valid_transitions = {
        "observe": ["bounded", "suspended"],
        "bounded": ["certified", "observe", "suspended"],
        "certified": ["suspended", "revoked"],
        "suspended": ["observe", "bounded", "revoked"],
        "revoked": []  # Terminal state
    }
    
    current_state = system.certification_state.value if hasattr(system.certification_state, 'value') else system.certification_state
    
    if new_state.value not in valid_transitions.get(current_state, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state transition from {current_state} to {new_state.value}"
        )
    
    # Update state
    system.certification_state = new_state
    
    await db.commit()
    await db.refresh(system)
    
    logger.info(f"Changed system {system.system_number} state to {new_state.value}")
    
    return system


@router.get("/{system_id}/envelopes", response_model=List)
async def list_system_envelopes(
    system_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all envelope versions for a system."""
    
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
            detail="Not authorized to access this system"
        )
    
    result = await db.execute(
        select(Envelope)
        .where(Envelope.system_id == system_id)
        .order_by(Envelope.version_major.desc(), Envelope.version_minor.desc(), Envelope.version_patch.desc())
    )
    envelopes = result.scalars().all()
    
    return envelopes
