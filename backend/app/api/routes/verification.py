from datetime import datetime
"""Public Verification API - No authentication required."""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from fastapi import Depends
from app.models.models import Certificate, EnveloSession, CertificationState

router = APIRouter()


class VerificationResponse(BaseModel):
    valid: bool
    certificate_number: str
    status: str
    organization_name: str = None
    system_name: str = None
    system_version: str = None
    issued_at: str = None
    expires_at: str = None
    convergence_score: float = None
    evidence_hash: str = None
    signature: str = None
    audit_log_ref: str = None
    message: str


@router.get("/{certificate_number}", response_model=VerificationResponse)
async def verify_certificate(
    certificate_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint to verify a certificate.
    No authentication required - anyone can check certification status.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == certificate_number)
    )
    cert = result.scalar_one_or_none()
    
    if not cert:
        return VerificationResponse(
            valid=False,
            certificate_number=certificate_number,
            status="NOT_FOUND",
            message="No certificate found with this number"
        )
    
    # Check expiration
    now = datetime.utcnow()
    is_expired = cert.expires_at and cert.expires_at < now
    
    if is_expired and cert.state == CertificationState.CONFORMANT:
        cert.state = CertificationState.EXPIRED
    
    # Determine validity
    is_valid = cert.state == CertificationState.CONFORMANT and not is_expired
    
    # Status messages
    status_messages = {
        CertificationState.CONFORMANT: "Certificate is valid and active",
        CertificationState.SUSPENDED: "Certificate has been suspended - contact issuer for details",
        CertificationState.REVOKED: "Certificate has been permanently revoked",
        CertificationState.EXPIRED: "Certificate has expired",
    }
    
    return VerificationResponse(
        valid=is_valid,
        certificate_number=cert.certificate_number,
        status=cert.state.value.upper(),
        organization_name=cert.organization_name,
        system_name=cert.system_name,
        system_version=cert.system_version,
        issued_at=cert.issued_at.isoformat() if cert.issued_at else None,
        expires_at=cert.expires_at.isoformat() if cert.expires_at else None,
        convergence_score=cert.convergence_score,
        evidence_hash=cert.evidence_hash,
        signature=cert.signature,
        audit_log_ref=cert.audit_log_ref,
        message=status_messages.get(cert.state, "Unknown status")
    )


@router.get("/{certificate_number}/evidence")
async def get_public_evidence(
    certificate_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get public evidence summary for a certificate.
    Returns only non-sensitive evidence data.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == certificate_number)
    )
    cert = result.scalar_one_or_none()
    
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    return {
        "certificate_number": cert.certificate_number,
        "evidence_hash": cert.evidence_hash,
        "convergence_score": cert.convergence_score,
        "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
        "odd_scope": {
            "environment_type": cert.odd_specification.get("environment_type") if cert.odd_specification else None,
        },
        "verification_instructions": (
            "To verify the integrity of this certificate:\n"
            "1. Compare the evidence_hash with your records\n"
            "2. The hash is a SHA-256 digest of the complete CAT-72 evidence chain\n"
            "3. Contact Sentinel Authority for full evidence audit"
        )
    }


@router.get("/")
async def verification_info():
    """Information about the verification API."""
    return {
        "service": "Sentinel Authority Public Verification API",
        "version": "1.0",
        "description": "Verify ODDC certificates for autonomous systems",
        "usage": {
            "verify": "GET /api/verify/{certificate_number}",
            "evidence": "GET /api/verify/{certificate_number}/evidence",
        },
        "contact": "https://sentinelauthority.org",
    }


@router.get("/status/{certificate_id}")
async def get_test_status(
    certificate_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Public endpoint for customers to check their test status"""
    
    # Find sessions with this certificate ID
    result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.certificate_id == certificate_id
        ).order_by(EnveloSession.started_at.desc())
    )
    sessions = result.scalars().all()
    
    if not sessions:
        # Check if certificate exists
        result = await db.execute(
            select(Certificate).where(Certificate.certificate_number == certificate_id)
        )
        cert = result.scalar_one_or_none()
        
        if cert:
            return {
                "status": "certified",
                "certificate_number": cert.certificate_number,
                "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
                "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
            }
        
        return {
            "status": "not_found",
            "message": "No test data found for this certificate ID. Make sure your ENVELO Agent is configured and running."
        }
    
    # Calculate totals
    total_pass = sum(s.pass_count or 0 for s in sessions)
    total_block = sum(s.block_count or 0 for s in sessions)
    total_actions = total_pass + total_block
    pass_rate = (total_pass / total_actions * 100) if total_actions > 0 else 0
    
    # Get earliest start time
    earliest_start = min(s.started_at for s in sessions if s.started_at)
    hours_elapsed = (datetime.utcnow() - earliest_start).total_seconds() / 3600 if earliest_start else 0
    hours_remaining = max(0, 72 - hours_elapsed)
    
    # Determine status
    active_sessions = [s for s in sessions if s.status == 'active']
    
    return {
        "status": "running" if active_sessions else "waiting",
        "certificate_id": certificate_id,
        "started_at": earliest_start.isoformat() if earliest_start else None,
        "hours_elapsed": round(hours_elapsed, 1),
        "hours_remaining": round(hours_remaining, 1),
        "total_actions": total_actions,
        "pass_count": total_pass,
        "block_count": total_block,
        "pass_rate": round(pass_rate, 1),
        "active_sessions": len(active_sessions),
        "criteria": {
            "duration_met": hours_elapsed >= 72,
            "actions_met": total_actions >= 100,
            "pass_rate_met": pass_rate >= 95,
            "blocking_verified": total_block > 0
        }
    }
