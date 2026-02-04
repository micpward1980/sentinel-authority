import hashlib, json
"""Audit log API endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import AuditLog

router = APIRouter(tags=["audit"])


@router.get("/logs", summary="Query audit logs")
async def get_audit_logs(
    action: str = Query(None),
    resource_type: str = Query(None),
    user_email: str = Query(None),
    date_from: str = Query(None, description="Start date ISO format"),
    date_to: str = Query(None, description="End date ISO format"),
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
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.where(AuditLog.timestamp >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            query = query.where(AuditLog.timestamp <= dt)
        except ValueError:
            pass
    
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


@router.get("/actions", summary="List distinct audit actions")
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


@router.get("/resource-types", summary="List distinct resource types")
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



@router.get("/my-logs", summary="Get own audit log entries")
async def get_my_audit_logs(
    action: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get audit log entries for the current user"""
    query = select(AuditLog).where(AuditLog.user_email == user.get("email"))
    
    if action:
        query = query.where(AuditLog.action == action)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details or {},
            }
            for log in logs
        ],
        "total": total,
    }

@router.get("/verify", summary="Verify audit log integrity")
async def verify_audit_integrity(
    limit: int = Query(1000, le=5000),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Recompute hashes for audit entries and check for tampering"""
    from datetime import datetime as dt
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    )
    logs = result.scalars().all()
    
    total = len(logs)
    valid = 0
    invalid = 0
    invalid_ids = []
    
    for log in logs:
        content = json.dumps({
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }, sort_keys=True)
        expected = hashlib.sha256(content.encode()).hexdigest()[:16]
        
        if expected == log.log_hash:
            valid += 1
        else:
            invalid += 1
            if len(invalid_ids) < 20:
                invalid_ids.append({"id": log.id, "expected": expected, "stored": log.log_hash})
    
    return {
        "total_checked": total,
        "valid": valid,
        "invalid": invalid,
        "integrity": "passed" if invalid == 0 else "failed",
        "invalid_entries": invalid_ids,
    }

