"""Public Registry Search API - Search certificates by organization or system name"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.database import get_db
from app.models import Certificate

router = APIRouter(prefix="/api/registry", tags=["registry"])


@router.get("/search")
async def search_registry(
    q: str = Query(None, description="Search query (organization or system name)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public registry search - find certificates by organization or system name.
    Only returns active/conformant certificates.
    """
    query = select(Certificate).where(
        Certificate.state.in_(['conformant', 'active'])
    )
    
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Certificate.organization_name.ilike(search_term),
                Certificate.system_name.ilike(search_term),
                Certificate.certificate_number.ilike(search_term)
            )
        )
    
    query = query.order_by(Certificate.issued_at.desc()).limit(50)
    
    result = await db.execute(query)
    certificates = result.scalars().all()
    
    return [
        {
            "certificate_number": cert.certificate_number,
            "organization_name": cert.organization_name,
            "system_name": cert.system_name,
            "state": cert.state,
            "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
        }
        for cert in certificates
    ]


@router.get("/stats")
async def registry_stats(db: AsyncSession = Depends(get_db)):
    """Get public registry statistics"""
    # Total active certificates
    result = await db.execute(
        select(func.count(Certificate.id)).where(
            Certificate.state.in_(['conformant', 'active'])
        )
    )
    active_count = result.scalar() or 0
    
    # Total organizations
    result = await db.execute(
        select(func.count(func.distinct(Certificate.organization_name))).where(
            Certificate.state.in_(['conformant', 'active'])
        )
    )
    org_count = result.scalar() or 0
    
    return {
        "active_certificates": active_count,
        "certified_organizations": org_count,
    }
