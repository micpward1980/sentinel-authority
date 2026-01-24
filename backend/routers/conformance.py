"""
Conformance Records router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
import hashlib
import json
import logging

from database import get_db, ConformanceRecord, System, Envelope, CAT72Test, Account
from schemas import (
    ConformanceRecordCreate, ConformanceRecordResponse,
    PaginatedResponse, CertificationStateEnum
)
from routers.auth import get_current_user, require_role, CurrentUser
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def generate_record_hash(record_content: dict) -> str:
    """Generate SHA-256 hash of record content."""
    content_json = json.dumps(record_content, sort_keys=True, default=str)
    return hashlib.sha256(content_json.encode()).hexdigest()


def sign_record(record_hash: str) -> str:
    """
    Sign a record hash.
    
    In production, this would use actual ECDSA signing with a private key.
    For demo purposes, we create a deterministic signature.
    """
    # In production: Use cryptography library with actual private key
    # from cryptography.hazmat.primitives import hashes
    # from cryptography.hazmat.primitives.asymmetric import ec
    
    # Demo signature
    signature_input = f"{record_hash}:{settings.SECRET_KEY}"
    signature = hashlib.sha512(signature_input.encode()).hexdigest()
    return f"SA-SIG-{signature[:64]}"


@router.get("", response_model=PaginatedResponse)
async def list_conformance_records(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    account_id: Optional[UUID] = None,
    system_id: Optional[UUID] = None,
    certification_state: Optional[CertificationStateEnum] = None,
    include_revoked: bool = False,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List conformance records with pagination and filters."""
    
    query = select(ConformanceRecord)
    
    if current_user.role != "admin":
        query = query.where(ConformanceRecord.account_id == current_user.account_id)
    elif account_id:
        query = query.where(ConformanceRecord.account_id == account_id)
    
    if system_id:
        query = query.where(ConformanceRecord.system_id == system_id)
    
    if certification_state:
        query = query.where(ConformanceRecord.certification_state == certification_state)
    
    if not include_revoked:
        query = query.where(ConformanceRecord.is_revoked == False)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    query = query.order_by(ConformanceRecord.issued_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    return PaginatedResponse(
        items=[ConformanceRecordResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=ConformanceRecordResponse, status_code=status.HTTP_201_CREATED)
async def issue_conformance_record(
    record_data: ConformanceRecordCreate,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Issue a new conformance record (admin only)."""
    
    # Get system
    result = await db.execute(select(System).where(System.id == record_data.system_id))
    system = result.scalar_one_or_none()
    
    if not system:
        raise HTTPException(status_code=404, detail="System not found")
    
    # Get envelope
    result = await db.execute(
        select(Envelope).where(
            Envelope.id == record_data.envelope_id,
            Envelope.system_id == record_data.system_id
        )
    )
    envelope = result.scalar_one_or_none()
    
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if not envelope.is_approved:
        raise HTTPException(status_code=400, detail="Envelope must be approved")
    
    # If CAT-72 test specified, validate it passed
    cat72_test = None
    if record_data.cat72_test_id:
        result = await db.execute(
            select(CAT72Test).where(CAT72Test.id == record_data.cat72_test_id)
        )
        cat72_test = result.scalar_one_or_none()
        
        if not cat72_test:
            raise HTTPException(status_code=404, detail="CAT-72 test not found")
        
        if cat72_test.status != "passed":
            raise HTTPException(status_code=400, detail="CAT-72 test must have passed status")
    
    # Get previous record for this system (chain of custody)
    result = await db.execute(
        select(ConformanceRecord)
        .where(
            ConformanceRecord.system_id == record_data.system_id,
            ConformanceRecord.is_revoked == False
        )
        .order_by(ConformanceRecord.issued_at.desc())
        .limit(1)
    )
    previous_record = result.scalar_one_or_none()
    
    # Build record content
    record_content = {
        "system_id": str(system.id),
        "system_number": system.system_number,
        "system_name": system.name,
        "envelope_id": str(envelope.id),
        "envelope_version": envelope.version,
        "envelope_hash": envelope.specification_hash,
        "certification_state": record_data.certification_state.value,
        "odd_class": system.odd_class.value if hasattr(system.odd_class, 'value') else system.odd_class,
        "cat72_test_id": str(record_data.cat72_test_id) if record_data.cat72_test_id else None,
        "cat72_test_number": cat72_test.test_number if cat72_test else None,
        "effective_at": (record_data.effective_at or datetime.utcnow()).isoformat(),
        "expires_at": record_data.expires_at.isoformat(),
        "issued_at": datetime.utcnow().isoformat(),
        "issued_by": str(current_user.user_id),
        "previous_record_id": str(previous_record.id) if previous_record else None
    }
    
    # Generate hash and signature
    record_hash = generate_record_hash(record_content)
    signature = sign_record(record_hash)
    
    # Create record
    record = ConformanceRecord(
        system_id=record_data.system_id,
        envelope_id=record_data.envelope_id,
        account_id=system.account_id,
        cat72_test_id=record_data.cat72_test_id,
        certification_state=record_data.certification_state,
        odd_class=system.odd_class,
        effective_at=record_data.effective_at or datetime.utcnow(),
        expires_at=record_data.expires_at,
        record_hash=record_hash,
        signature=signature,
        signature_algorithm="ECDSA-P256-SHA256",
        signing_key_id=settings.SIGNING_KEY_ID,
        previous_record_id=previous_record.id if previous_record else None,
        record_content=record_content,
        issued_by=current_user.user_id,
        notes=record_data.notes
    )
    
    db.add(record)
    
    # Update system certification state
    system.certification_state = record_data.certification_state
    
    await db.commit()
    await db.refresh(record)
    
    logger.info(f"Issued conformance record {record.record_number} for system {system.system_number}")
    
    return record


@router.get("/{record_id}", response_model=ConformanceRecordResponse)
async def get_conformance_record(
    record_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get conformance record by ID."""
    
    result = await db.execute(
        select(ConformanceRecord).where(ConformanceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if current_user.role != "admin" and current_user.account_id != record.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return record


@router.post("/{record_id}/revoke", response_model=ConformanceRecordResponse)
async def revoke_conformance_record(
    record_id: UUID,
    reason: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a conformance record (admin only)."""
    
    result = await db.execute(
        select(ConformanceRecord).where(ConformanceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if record.is_revoked:
        raise HTTPException(status_code=409, detail="Record is already revoked")
    
    # Revoke
    record.is_revoked = True
    record.revoked_at = datetime.utcnow()
    record.revoked_by = current_user.user_id
    record.revocation_reason = reason
    
    # Update system state
    result = await db.execute(
        select(System).where(System.id == record.system_id)
    )
    system = result.scalar_one_or_none()
    if system:
        system.certification_state = CertificationStateEnum.revoked
    
    await db.commit()
    await db.refresh(record)
    
    logger.info(f"Revoked conformance record {record.record_number}")
    
    return record


@router.get("/expiring/soon", response_model=List[ConformanceRecordResponse])
async def list_expiring_records(
    days: int = Query(30, ge=1, le=90),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List conformance records expiring within specified days."""
    
    cutoff = datetime.utcnow() + timedelta(days=days)
    
    query = select(ConformanceRecord).where(
        ConformanceRecord.is_revoked == False,
        ConformanceRecord.expires_at <= cutoff,
        ConformanceRecord.expires_at > datetime.utcnow()
    )
    
    if current_user.role != "admin":
        query = query.where(ConformanceRecord.account_id == current_user.account_id)
    
    query = query.order_by(ConformanceRecord.expires_at)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    return records
