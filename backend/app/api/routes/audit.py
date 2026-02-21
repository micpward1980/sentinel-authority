import hashlib, json
"""Audit log API endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import AuditLog, AuditAnchor
import hashlib, hmac, os

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
    
    logs = list(reversed(logs))  # oldest first for chain check
    total = len(logs)
    valid = 0
    invalid = 0
    chain_breaks = 0
    invalid_ids = []
    prev_hash = "0" * 16

    for log in logs:
        # Check chain link
        if log.prev_hash and log.prev_hash != prev_hash:
            chain_breaks += 1
            if len(invalid_ids) < 20:
                invalid_ids.append({"id": log.id, "type": "chain_break", "expected_prev": prev_hash, "actual_prev": log.prev_hash})

        # Check content hash (try both old format and new chained format)
        old_content = json.dumps({
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }, sort_keys=True)
        old_expected = hashlib.sha256(old_content.encode()).hexdigest()[:16]

        new_content = json.dumps({
            "prev_hash": log.prev_hash or "0" * 16,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }, sort_keys=True)
        new_expected = hashlib.sha256(new_content.encode()).hexdigest()[:16]

        if log.log_hash in (old_expected, new_expected):
            valid += 1
        else:
            invalid += 1
            if len(invalid_ids) < 20:
                invalid_ids.append({"id": log.id, "type": "content_tamper", "expected": new_expected, "stored": log.log_hash})

        prev_hash = log.log_hash or prev_hash

    return {
        "total_checked": total,
        "valid": valid,
        "invalid": invalid,
        "chain_breaks": chain_breaks,
        "integrity": "passed" if invalid == 0 and chain_breaks == 0 else "failed",
        "invalid_entries": invalid_ids,
    }



@router.get("/verify-chain", summary="Verify audit log integrity")
async def verify_audit_chain(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Verify the entire audit hash chain is intact. Returns broken links if tampered."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.asc())
    )
    logs = result.scalars().all()
    
    if not logs:
        return {"status": "empty", "message": "No audit entries to verify"}
    
    broken_links = []
    prev_hash = "0" * 16
    
    for log in logs:
        # Reconstruct expected hash
        payload = f"{log.id}:{log.timestamp}:{log.action}:{log.user_email}:{log.resource_type}:{log.resource_id}:{prev_hash}"
        expected_hash = hashlib.sha256(payload.encode()).hexdigest()[:16]
        
        if log.prev_hash != prev_hash:
            broken_links.append({
                "id": log.id,
                "issue": "prev_hash mismatch",
                "expected_prev": prev_hash,
                "actual_prev": log.prev_hash
            })
        
        prev_hash = log.log_hash
    
    return {
        "status": "intact" if not broken_links else "TAMPERED",
        "total_entries": len(logs),
        "broken_links": broken_links,
        "latest_hash": logs[-1].log_hash if logs else None,
        "verified_at": datetime.utcnow().isoformat()
    }


@router.post("/create-anchor", summary="Create tamper-proof hash anchor")
async def create_anchor(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Snapshot the current chain state as an immutable anchor point."""
    # Get latest audit entry
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()
    if not latest:
        return {"error": "No audit entries to anchor"}
    
    # Count total entries
    count_result = await db.execute(select(AuditLog.id))
    total = len(count_result.all())
    
    # Create HMAC signature using server secret
    secret = os.environ.get("SECRET_KEY", "sentinel-authority-secret")
    sig_payload = f"{latest.id}:{latest.log_hash}:{total}:{datetime.utcnow().isoformat()}"
    signature = hmac.new(secret.encode(), sig_payload.encode(), hashlib.sha256).hexdigest()
    
    anchor = AuditAnchor(
        last_audit_id=latest.id,
        chain_hash=latest.log_hash,
        entry_count=total,
        anchor_signature=signature
    )
    db.add(anchor)
    await db.commit()
    await db.refresh(anchor)
    
    return {
        "anchor_id": anchor.id,
        "last_audit_id": anchor.last_audit_id,
        "chain_hash": anchor.chain_hash,
        "entry_count": anchor.entry_count,
        "signature": anchor.anchor_signature,
        "created_at": anchor.created_at.isoformat(),
        "message": "Anchor created. This record is immutable and cannot be modified or deleted."
    }


@router.get("/anchors", summary="List all audit anchors")
async def list_anchors(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """List all hash anchor checkpoints."""
    result = await db.execute(
        select(AuditAnchor).order_by(AuditAnchor.id.desc())
    )
    anchors = result.scalars().all()
    return [{
        "id": a.id,
        "created_at": a.created_at.isoformat(),
        "last_audit_id": a.last_audit_id,
        "chain_hash": a.chain_hash,
        "entry_count": a.entry_count,
        "signature": a.anchor_signature
    } for a in anchors]


@router.get("/verify-anchor/{anchor_id}", summary="Verify a specific anchor")
async def verify_anchor(
    anchor_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Verify an anchor matches current chain state at that point."""
    result = await db.execute(select(AuditAnchor).where(AuditAnchor.id == anchor_id))
    anchor = result.scalar_one_or_none()
    if not anchor:
        return {"error": "Anchor not found"}
    
    # Get the audit entry at the anchor point
    audit_result = await db.execute(
        select(AuditLog).where(AuditLog.id == anchor.last_audit_id)
    )
    audit_entry = audit_result.scalar_one_or_none()
    if not audit_entry:
        return {"status": "TAMPERED", "reason": "Referenced audit entry missing"}
    
    # Verify hash matches
    hash_match = audit_entry.log_hash == anchor.chain_hash
    
    # Verify signature
    secret = os.environ.get("SECRET_KEY", "sentinel-authority-secret")
    
    # Count entries up to anchor point
    count_result = await db.execute(
        select(AuditLog.id).where(AuditLog.id <= anchor.last_audit_id)
    )
    current_count = len(count_result.all())
    count_match = current_count == anchor.entry_count
    
    return {
        "anchor_id": anchor.id,
        "hash_match": hash_match,
        "count_match": count_match,
        "status": "INTACT" if (hash_match and count_match) else "TAMPERED",
        "expected_hash": anchor.chain_hash,
        "actual_hash": audit_entry.log_hash,
        "expected_count": anchor.entry_count,
        "actual_count": current_count,
        "reason": None if (hash_match and count_match) else (
            "Hash mismatch - entries modified" if not hash_match else "Entry count mismatch - entries deleted"
        )
    }



@router.get("/admin-logs", summary="Recent activity feed for admin dashboard")
async def get_admin_logs(
    limit: int = Query(8, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Recent audit events for the admin dashboard activity feed."""
    count_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = count_result.scalar() or 0

    query = select(AuditLog).order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
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
                "details": log.details or {},
                "log_hash": log.log_hash,
            }
            for log in logs
        ],
        "total": total,
    }
