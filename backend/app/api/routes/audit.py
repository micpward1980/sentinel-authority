"""Audit log API endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    action: str = Query(None),
    resource_type: str = Query(None),
    user_email: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Get audit log entries (admin only)"""
    query = select(AuditLog)
    
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "log_hash": log.log_hash,
            }
            for log in logs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/actions")
async def get_action_types(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Get distinct action types for filter dropdown"""
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    actions = [r[0] for r in result.all() if r[0]]
    return {"actions": actions}


@router.get("/resource-types")
async def get_resource_types(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Get distinct resource types for filter dropdown"""
    result = await db.execute(
        select(AuditLog.resource_type).distinct().order_by(AuditLog.resource_type)
    )
    types = [r[0] for r in result.all() if r[0]]
    return {"resource_types": types}
