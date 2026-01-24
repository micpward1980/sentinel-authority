"""
Public Verification router for Sentinel Authority API

This router provides PUBLIC endpoints for verifying conformance records.
No authentication is required - these are meant for third parties
(insurers, regulators, partners) to verify certifications.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
import hashlib
import json
import logging

from database import get_db, ConformanceRecord, System, Account, Envelope
from schemas import VerificationRequest, VerificationResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=VerificationResponse)
async def verify_conformance_record(
    request: VerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Publicly verify a conformance record.
    
    This endpoint is PUBLIC and requires no authentication.
    Third parties can verify that a conformance record is:
    - Authentic (issued by Sentinel Authority)
    - Valid (not expired or revoked)
    - Intact (not tampered with)
    """
    
    if not request.record_id and not request.record_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either record_id or record_hash must be provided"
        )
    
    # Find record
    record = None
    
    if request.record_id:
        # Search by record number (e.g., ODDC-2026-00001)
        result = await db.execute(
            select(ConformanceRecord).where(
                ConformanceRecord.record_number == request.record_id
            )
        )
        record = result.scalar_one_or_none()
    
    if not record and request.record_hash:
        # Search by hash
        result = await db.execute(
            select(ConformanceRecord).where(
                ConformanceRecord.record_hash == request.record_hash
            )
        )
        record = result.scalar_one_or_none()
    
    verification_timestamp = datetime.utcnow()
    
    if not record:
        return VerificationResponse(
            is_valid=False,
            verification_timestamp=verification_timestamp,
            message="No conformance record found with the provided identifier"
        )
    
    # Get related entities
    result = await db.execute(select(System).where(System.id == record.system_id))
    system = result.scalar_one_or_none()
    
    result = await db.execute(select(Account).where(Account.id == record.account_id))
    account = result.scalar_one_or_none()
    
    # Check if revoked
    if record.is_revoked:
        return VerificationResponse(
            is_valid=False,
            record_number=record.record_number,
            certification_state=record.certification_state,
            system_name=system.name if system else None,
            account_name=account.name if account else None,
            odd_class=record.odd_class,
            issued_at=record.issued_at,
            expires_at=record.expires_at,
            is_revoked=True,
            revocation_reason=record.revocation_reason,
            verification_timestamp=verification_timestamp,
            message=f"REVOKED: This conformance record was revoked on {record.revoked_at.strftime('%Y-%m-%d')}. Reason: {record.revocation_reason}"
        )
    
    # Check if expired
    if record.expires_at < datetime.utcnow():
        return VerificationResponse(
            is_valid=False,
            record_number=record.record_number,
            certification_state=record.certification_state,
            system_name=system.name if system else None,
            account_name=account.name if account else None,
            odd_class=record.odd_class,
            issued_at=record.issued_at,
            expires_at=record.expires_at,
            is_revoked=False,
            verification_timestamp=verification_timestamp,
            message=f"EXPIRED: This conformance record expired on {record.expires_at.strftime('%Y-%m-%d')}"
        )
    
    # Verify integrity (recompute hash)
    recomputed_hash = hashlib.sha256(
        json.dumps(record.record_content, sort_keys=True, default=str).encode()
    ).hexdigest()
    
    if recomputed_hash != record.record_hash:
        logger.error(f"Hash mismatch for record {record.record_number}!")
        return VerificationResponse(
            is_valid=False,
            record_number=record.record_number,
            verification_timestamp=verification_timestamp,
            message="INTEGRITY FAILURE: Record hash verification failed. This record may have been tampered with."
        )
    
    # Record is valid
    return VerificationResponse(
        is_valid=True,
        record_number=record.record_number,
        certification_state=record.certification_state,
        system_name=system.name if system else None,
        account_name=account.name if account else None,
        odd_class=record.odd_class,
        issued_at=record.issued_at,
        expires_at=record.expires_at,
        is_revoked=False,
        verification_timestamp=verification_timestamp,
        message=f"VALID: This conformance record is authentic, valid, and in good standing. Certification state: {record.certification_state.value.upper()}"
    )


@router.get("/{record_number}")
async def verify_by_record_number(
    record_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Quick verification by record number.
    
    This is a convenience endpoint for simple verification via GET request.
    Example: GET /verify/ODDC-2026-00001
    """
    
    result = await db.execute(
        select(ConformanceRecord).where(
            ConformanceRecord.record_number == record_number
        )
    )
    record = result.scalar_one_or_none()
    
    verification_timestamp = datetime.utcnow()
    
    if not record:
        return {
            "valid": False,
            "record_number": record_number,
            "timestamp": verification_timestamp.isoformat(),
            "message": "Record not found"
        }
    
    # Get system name
    result = await db.execute(select(System).where(System.id == record.system_id))
    system = result.scalar_one_or_none()
    
    is_valid = (
        not record.is_revoked and 
        record.expires_at > datetime.utcnow()
    )
    
    return {
        "valid": is_valid,
        "record_number": record.record_number,
        "certification_state": record.certification_state.value if hasattr(record.certification_state, 'value') else record.certification_state,
        "system_name": system.name if system else None,
        "odd_class": record.odd_class.value if hasattr(record.odd_class, 'value') else record.odd_class,
        "issued_at": record.issued_at.isoformat(),
        "expires_at": record.expires_at.isoformat(),
        "is_revoked": record.is_revoked,
        "timestamp": verification_timestamp.isoformat(),
        "message": "Valid and in good standing" if is_valid else ("Revoked" if record.is_revoked else "Expired")
    }


@router.get("/hash/{record_hash}")
async def verify_by_hash(
    record_hash: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify by record hash.
    
    This allows verification using only the cryptographic hash,
    which can be embedded in QR codes or other machine-readable formats.
    """
    
    result = await db.execute(
        select(ConformanceRecord).where(
            ConformanceRecord.record_hash == record_hash
        )
    )
    record = result.scalar_one_or_none()
    
    verification_timestamp = datetime.utcnow()
    
    if not record:
        return {
            "valid": False,
            "hash": record_hash,
            "timestamp": verification_timestamp.isoformat(),
            "message": "No record found with this hash"
        }
    
    result = await db.execute(select(System).where(System.id == record.system_id))
    system = result.scalar_one_or_none()
    
    is_valid = (
        not record.is_revoked and 
        record.expires_at > datetime.utcnow()
    )
    
    return {
        "valid": is_valid,
        "record_number": record.record_number,
        "hash": record_hash,
        "hash_verified": True,
        "certification_state": record.certification_state.value if hasattr(record.certification_state, 'value') else record.certification_state,
        "system_name": system.name if system else None,
        "issued_at": record.issued_at.isoformat(),
        "expires_at": record.expires_at.isoformat(),
        "is_revoked": record.is_revoked,
        "timestamp": verification_timestamp.isoformat()
    }
