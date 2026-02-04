"""Public Registry Search API - Search certificates by organization or system name"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.core.database import get_db
from app.models.models import Certificate, CertificationState
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(tags=["registry"])


@router.get("/search")
async def search_registry(
    q: str = Query(None, description="Search query (organization or system name)"),
    status: Optional[str] = Query(None, description="Filter by status: conformant, expired, suspended"),
    days: Optional[int] = Query(None, description="Certificates issued in last N days"),
    group: bool = Query(False, description="Group results by organization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public registry search - find certificates by organization or system name.
    """
    # Base query - conformant certificates only by default
    states = [CertificationState.CONFORMANT]
    if status:
        status_map = {
            "conformant": CertificationState.CONFORMANT,
            "expired": CertificationState.EXPIRED,
            "suspended": CertificationState.SUSPENDED,
            "revoked": CertificationState.REVOKED,
        }
        if status.lower() in status_map:
            states = [status_map[status.lower()]]
    
    query = select(Certificate).where(Certificate.state.in_(states))
    
    # Text search
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Certificate.organization_name.ilike(search_term),
                Certificate.system_name.ilike(search_term),
                Certificate.certificate_number.ilike(search_term)
            )
        )
    
    # Date filter
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(Certificate.issued_at >= cutoff)
    
    query = query.order_by(Certificate.organization_name, Certificate.issued_at.desc()).limit(100)
    
    result = await db.execute(query)
    certificates = result.scalars().all()
    
    # Format results
    cert_list = [
        {
            "certificate_number": cert.certificate_number,
            "organization_name": cert.organization_name,
            "system_name": cert.system_name,
            "system_version": cert.system_version,
            "state": cert.state.value if hasattr(cert.state, 'value') else str(cert.state),
            "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
        }
        for cert in certificates
    ]
    
    # Group by organization if requested
    if group and cert_list:
        grouped = {}
        for cert in cert_list:
            org = cert["organization_name"]
            if org not in grouped:
                grouped[org] = {"organization_name": org, "systems": []}
            grouped[org]["systems"].append({
                "system_name": cert["system_name"],
                "system_version": cert["system_version"],
                "certificate_number": cert["certificate_number"],
                "state": cert["state"],
                "issued_at": cert["issued_at"],
                "expires_at": cert["expires_at"],
            })
        return {
            "total": len(cert_list),
            "organizations": len(grouped),
            "results": list(grouped.values())
        }
    
    return {
        "total": len(cert_list),
        "results": cert_list
    }


@router.get("/stats")
async def registry_stats(db: AsyncSession = Depends(get_db)):
    """Get public registry statistics"""
    # Total active certificates
    result = await db.execute(
        select(func.count(Certificate.id)).where(
            Certificate.state.in_([CertificationState.CONFORMANT])
        )
    )
    active_count = result.scalar() or 0
    
    # Total organizations
    result = await db.execute(
        select(func.count(func.distinct(Certificate.organization_name))).where(
            Certificate.state.in_([CertificationState.CONFORMANT])
        )
    )
    org_count = result.scalar() or 0
    
    # Recently issued (last 30 days)
    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(func.count(Certificate.id)).where(
            Certificate.state.in_([CertificationState.CONFORMANT]),
            Certificate.issued_at >= cutoff
        )
    )
    recent_count = result.scalar() or 0
    
    return {
        "active_certificates": active_count,
        "certified_organizations": org_count,
        "issued_last_30_days": recent_count,
    }
