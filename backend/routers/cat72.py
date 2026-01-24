"""
CAT-72 Tests router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from database import get_db, CAT72Test, CAT72Event, System, Envelope
from schemas import (
    CAT72Create, CAT72Update, CAT72Response,
    CAT72EventCreate, CAT72EventResponse,
    PaginatedResponse, CAT72StatusEnum, EventSeverityEnum
)
from routers.auth import get_current_user, require_role, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_cat72_tests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    account_id: Optional[UUID] = None,
    system_id: Optional[UUID] = None,
    status_filter: Optional[CAT72StatusEnum] = Query(None, alias="status"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List CAT-72 tests with pagination and filters."""
    
    query = select(CAT72Test)
    
    if current_user.role != "admin":
        query = query.where(CAT72Test.account_id == current_user.account_id)
    elif account_id:
        query = query.where(CAT72Test.account_id == account_id)
    
    if system_id:
        query = query.where(CAT72Test.system_id == system_id)
    
    if status_filter:
        query = query.where(CAT72Test.status == status_filter)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    query = query.order_by(CAT72Test.scheduled_start_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    tests = result.scalars().all()
    
    return PaginatedResponse(
        items=[CAT72Response.model_validate(t) for t in tests],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=CAT72Response, status_code=status.HTTP_201_CREATED)
async def schedule_cat72_test(
    test_data: CAT72Create,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Schedule a new CAT-72 test."""
    
    result = await db.execute(select(System).where(System.id == test_data.system_id))
    system = result.scalar_one_or_none()
    
    if not system:
        raise HTTPException(status_code=404, detail="System not found")
    
    if current_user.role != "admin" and current_user.account_id != system.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.execute(
        select(Envelope).where(
            Envelope.id == test_data.envelope_id,
            Envelope.system_id == test_data.system_id
        )
    )
    envelope = result.scalar_one_or_none()
    
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if not envelope.is_approved:
        raise HTTPException(status_code=400, detail="Envelope must be approved")
    
    test = CAT72Test(
        system_id=test_data.system_id,
        envelope_id=test_data.envelope_id,
        account_id=system.account_id,
        scheduled_start_at=test_data.scheduled_start_at,
        required_duration_hours=test_data.required_duration_hours,
        max_violations_allowed=test_data.max_violations_allowed,
        max_interventions_allowed=test_data.max_interventions_allowed,
        max_breaches_allowed=test_data.max_breaches_allowed,
        environment=test_data.environment,
        test_location=test_data.test_location,
        test_conditions=test_data.test_conditions or {},
        notes=test_data.notes
    )
    
    db.add(test)
    await db.commit()
    await db.refresh(test)
    
    return test


@router.get("/{test_id}", response_model=CAT72Response)
async def get_cat72_test(
    test_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get CAT-72 test by ID."""
    
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if current_user.role != "admin" and current_user.account_id != test.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return test


@router.post("/{test_id}/start", response_model=CAT72Response)
async def start_cat72_test(
    test_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a CAT-72 test."""
    
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if current_user.role != "admin" and current_user.account_id != test.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    test.status = CAT72StatusEnum.in_progress
    test.actual_start_at = datetime.utcnow()
    test.test_operator_id = current_user.user_id
    
    await db.commit()
    await db.refresh(test)
    
    return test


@router.post("/{test_id}/complete", response_model=CAT72Response)
async def complete_cat72_test(
    test_id: UUID,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Complete a CAT-72 test and determine pass/fail."""
    
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    passed = (
        test.violation_count <= test.max_violations_allowed and
        test.intervention_count <= test.max_interventions_allowed and
        test.envelope_breach_count <= test.max_breaches_allowed
    )
    
    test.status = CAT72StatusEnum.passed if passed else CAT72StatusEnum.failed
    test.actual_end_at = datetime.utcnow()
    test.reviewer_id = current_user.user_id
    test.reviewed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(test)
    
    return test


@router.post("/{test_id}/events", response_model=CAT72EventResponse, status_code=status.HTTP_201_CREATED)
async def ingest_event(
    test_id: UUID,
    event_data: CAT72EventCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Ingest a telemetry event."""
    
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if current_user.role != "admin" and current_user.account_id != test.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    event = CAT72Event(
        test_id=test_id,
        event_time=event_data.event_time,
        event_type=event_data.event_type,
        severity=event_data.severity,
        message=event_data.message,
        data=event_data.data,
        position_lat=event_data.position_lat,
        position_lon=event_data.position_lon,
        position_alt_m=event_data.position_alt_m,
        velocity_mps=event_data.velocity_mps,
        heading_deg=event_data.heading_deg,
        envelope_evaluation=event_data.envelope_evaluation,
        constraint_violated=event_data.constraint_violated,
        interlock_triggered=event_data.interlock_triggered,
        interlock_action=event_data.interlock_action
    )
    
    db.add(event)
    
    test.total_events += 1
    if event_data.severity == EventSeverityEnum.violation:
        test.violation_count += 1
    elif event_data.severity == EventSeverityEnum.breach:
        test.envelope_breach_count += 1
    if event_data.interlock_triggered:
        test.intervention_count += 1
    
    if test.actual_start_at:
        test.elapsed_hours = (event_data.event_time - test.actual_start_at).total_seconds() / 3600
    
    await db.commit()
    await db.refresh(event)
    
    return event


@router.get("/{test_id}/events", response_model=List[CAT72EventResponse])
async def list_events(
    test_id: UUID,
    severity: Optional[EventSeverityEnum] = None,
    limit: int = Query(100, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List events for a test."""
    
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if current_user.role != "admin" and current_user.account_id != test.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = select(CAT72Event).where(CAT72Event.test_id == test_id)
    if severity:
        query = query.where(CAT72Event.severity == severity)
    query = query.order_by(CAT72Event.event_time.desc()).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()
