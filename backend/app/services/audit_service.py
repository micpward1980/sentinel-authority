"""Audit log service — write and query audit entries"""
import hashlib, json
from datetime import datetime
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AuditLog


async def write_audit_log(
    db: AsyncSession,
    action: str,
    resource_type: str = None,
    resource_id: int = None,
    user_id: int = None,
    user_email: str = None,
    details: dict = None,
):
    """Write an entry to the audit log with tamper-evident hash."""
    # Build hash chain — hash of this entry's content
    content = json.dumps({
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "user_id": user_id,
        "user_email": user_email,
        "details": details,
        "timestamp": datetime.utcnow().isoformat(),
    }, sort_keys=True)
    log_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

    entry = AuditLog(
        timestamp=datetime.utcnow(),
        user_id=user_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        log_hash=log_hash,
    )
    db.add(entry)
    # Don't commit here — let the caller's transaction handle it
    return entry


async def query_audit_logs(
    db: AsyncSession,
    action: str = None,
    resource_type: str = None,
    resource_id: int = None,
    user_email: str = None,
    limit: int = 100,
    offset: int = 0,
):
    """Query audit logs with optional filters."""
    query = select(AuditLog)
    
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.where(AuditLog.resource_id == resource_id)
    if user_email:
        query = query.where(AuditLog.user_email == user_email)
    
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
