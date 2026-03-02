"""
SENTINEL AUTHORITY — Surveillance API Routes
=============================================
Exposes the surveillance engine's data to the dashboard.

Drop into: backend/app/api/routes/surveillance.py
Mount in main.py:
    from app.api.routes.surveillance import router as surveillance_router
    app.include_router(surveillance_router, prefix="/api/surveillance", tags=["Surveillance"])
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.audit_service import write_audit_log
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone

from app.surveillance import (
    get_surveillance_state,
    get_surveillance_config,
    _reinstate_certificate_in_db,
)
# You'll need to wire in your actual DB session factory
# from app.database import get_db_session

router = APIRouter()


# ── Conformance Scores ────────────────────────────────────────

@router.get("/scores", summary="Get all conformance scores")
async def get_all_scores():
    """
    Returns real-time conformance scores for all monitored sessions.
    Each score includes: score (0-100), status, block rate, last heartbeat.
    """
    state = get_surveillance_state()
    scores = state.get_all_scores()
    return {
        "scores": scores,
        "total": len(scores),
        "engine_status": "running",
        "config": {
            "scan_interval": get_surveillance_config().SCAN_INTERVAL_SECONDS,
            "heartbeat_suspend_threshold": get_surveillance_config().HEARTBEAT_SUSPEND_SECONDS,
            "violation_suspend_threshold": get_surveillance_config().VIOLATION_SUSPEND_RATE,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/scores/{session_id}", summary="Get conformance score for a session")
async def get_session_score(session_id: str):
    """Get detailed conformance score for a specific session."""
    state = get_surveillance_state()
    score = state.get_score(session_id)
    if not score:
        raise HTTPException(status_code=404, detail=f"No score data for session {session_id}")
    return score


@router.get("/scores/certificate/{certificate_id}", summary="Get scores by certificate")
async def get_certificate_scores(certificate_id: str):
    """Get all session scores for a given certificate."""
    state = get_surveillance_state()
    scores = [s for s in state.get_all_scores() if s["certificate_id"] == certificate_id]
    return {
        "certificate_id": certificate_id,
        "sessions": scores,
        "total": len(scores),
    }


# ── Alerts ────────────────────────────────────────────────────

@router.get("/alerts", summary="Get surveillance alerts")
async def get_alerts(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None, description="Filter: info|warn|critical|suspension|revocation"),
    certificate_id: Optional[str] = Query(None, description="Filter by certificate"),
    unacknowledged_only: bool = Query(False, description="Only show unacknowledged alerts"),
):
    """
    Returns recent surveillance alerts.
    Alerts are generated automatically by the engine for:
    - Heartbeat staleness/loss
    - Violation threshold breaches
    - Auto-suspensions
    - Score degradation
    """
    state = get_surveillance_state()
    alerts = state.get_alerts(limit=limit, severity=severity, certificate_id=certificate_id)

    if unacknowledged_only:
        alerts = [a for a in alerts if not a.get("acknowledged")]

    # Enrich alerts with org/system names from certificates
    cert_ids = list(set(a.get("certificate_id") for a in alerts if a.get("certificate_id")))
    cert_lookup = {}
    if cert_ids:
        try:
            from app.core.database import async_session_maker
            from app.models.models import Certificate
            from sqlalchemy import select
            async with async_session_maker() as db:
                result = await db.execute(select(Certificate).where(Certificate.certificate_number.in_(cert_ids)))
                for c in result.scalars().all():
                    cert_lookup[c.certificate_number] = {"organization": c.organization_name, "system": c.system_name}
        except Exception:
            pass
    for a in alerts:
        cid = a.get("certificate_id")
        if cid and cid in cert_lookup:
            a["organization"] = cert_lookup[cid]["organization"]
            a["system_name"] = cert_lookup[cid]["system"]

    return {
        "alerts": alerts,
        "total": len(alerts),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge an alert")
async def acknowledge_alert(alert_id: str, acknowledged_by: str = "admin"):
    """Mark an alert as acknowledged."""
    state = get_surveillance_state()
    success = state.acknowledge_alert(alert_id, acknowledged_by)
    if not success:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return {"status": "acknowledged", "alert_id": alert_id}


# ── Suspension Management ─────────────────────────────────────

@router.get("/suspensions", summary="List auto-suspended certificates")
async def get_suspensions():
    """List all certificates currently suspended by the surveillance engine."""
    state = get_surveillance_state()
    return {
        "suspended_certificates": list(state.suspended_certs),
        "total": len(state.suspended_certs),
    }


@router.post("/reinstate/{certificate_id}", summary="Reinstate a suspended certificate")
async def reinstate_certificate(certificate_id: str, reason: str = "Manual reinstatement by admin"):
    """
    Reinstate a certificate that was auto-suspended by the surveillance engine.
    This is an ADMIN action — auto-reinstatement is intentionally not supported.
    A human must review and decide to reinstate.
    """
    state = get_surveillance_state()
    if certificate_id not in state.suspended_certs:
        raise HTTPException(
            status_code=400,
            detail=f"Certificate {certificate_id} is not currently suspended by surveillance"
        )

    # Remove from in-memory suspended set
    state.suspended_certs.discard(certificate_id)

    # Fire reinstatement alert
    from app.surveillance import AlertType, AlertSeverity
    state._fire_alert(
        AlertType.CERTIFICATE_CONFORMANT_RESTORED,
        AlertSeverity.INFO,
        certificate_id, None,
        f"Certificate {certificate_id} reinstated: {reason}",
    )

    # TODO: Wire up DB persistence when integrating:
    #   from app.database import async_session_factory
    #   await _reinstate_certificate_in_db(certificate_id, async_session_factory, reason)

    # Audit: reinstatement
    try:
        from app.core.database import async_session_factory
        async with async_session_factory() as audit_db:
            await write_audit_log(audit_db, action="certificate_reinstated",
                resource_type="certificate", user_email="admin",
                details={"certificate_id": certificate_id, "reason": reason})
            await audit_db.commit()
    except Exception as e:
        print(f"[SURVEILLANCE] Audit log error (non-fatal): {e}")

    return {"status": "reinstated", "certificate_id": certificate_id, "reason": reason}


# ── Engine Status ─────────────────────────────────────────────

@router.get("/status", summary="Surveillance engine status")
async def engine_status():
    """Health check and summary stats for the surveillance engine."""
    state = get_surveillance_state()
    config = get_surveillance_config()

    total_sessions = len(state.scores)
    healthy = sum(1 for s in state.scores.values() if s.status == "healthy")
    degraded = sum(1 for s in state.scores.values() if s.status == "degraded")
    critical = sum(1 for s in state.scores.values() if s.status in ("critical", "failing"))
    offline = sum(1 for s in state.scores.values() if s.status == "offline")
    suspended = len(state.suspended_certs)

    unacked_alerts = sum(1 for a in state.alerts if not a.acknowledged)

    return {
        "engine": "running",
        "scan_interval_seconds": config.SCAN_INTERVAL_SECONDS,
        "monitored_sessions": total_sessions,
        "status_breakdown": {
            "healthy": healthy,
            "degraded": degraded,
            "critical": critical,
            "offline": offline,
            "suspended": suspended,
        },
        "unacknowledged_alerts": unacked_alerts,
        "total_alerts": len(state.alerts),
        "thresholds": {
            "heartbeat_stale": f"{config.HEARTBEAT_STALE_SECONDS}s",
            "heartbeat_offline": f"{config.HEARTBEAT_OFFLINE_SECONDS}s",
            "heartbeat_suspend": f"{config.HEARTBEAT_SUSPEND_SECONDS}s",
            "violation_warn": f"{config.VIOLATION_WARN_RATE:.0%}",
            "violation_critical": f"{config.VIOLATION_CRITICAL_RATE:.0%}",
            "violation_suspend": f"{config.VIOLATION_SUSPEND_RATE:.0%}",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Configuration (admin) ────────────────────────────────────

@router.put("/config", summary="Update surveillance thresholds")
async def update_config(
    heartbeat_suspend_seconds: Optional[int] = None,
    violation_warn_rate: Optional[float] = None,
    violation_critical_rate: Optional[float] = None,
    violation_suspend_rate: Optional[float] = None,
    scan_interval_seconds: Optional[int] = None,
):
    """Update surveillance engine thresholds. Changes take effect on next scan."""
    config = get_surveillance_config()

    if heartbeat_suspend_seconds is not None:
        if heartbeat_suspend_seconds < 60:
            raise HTTPException(status_code=400, detail="Suspend threshold must be >= 60s")
        config.HEARTBEAT_SUSPEND_SECONDS = heartbeat_suspend_seconds

    if violation_warn_rate is not None:
        config.VIOLATION_WARN_RATE = violation_warn_rate
    if violation_critical_rate is not None:
        config.VIOLATION_CRITICAL_RATE = violation_critical_rate
    if violation_suspend_rate is not None:
        config.VIOLATION_SUSPEND_RATE = violation_suspend_rate

    if scan_interval_seconds is not None:
        if scan_interval_seconds < 10:
            raise HTTPException(status_code=400, detail="Scan interval must be >= 10s")
        config.SCAN_INTERVAL_SECONDS = scan_interval_seconds

    # Audit: config change
    try:
        from app.core.database import async_session_factory
        async with async_session_factory() as audit_db:
            await write_audit_log(audit_db, action="surveillance_config_changed",
                resource_type="surveillance", user_email="admin",
                details={"heartbeat_suspend": config.HEARTBEAT_SUSPEND_SECONDS,
                         "violation_warn": config.VIOLATION_WARN_RATE,
                         "violation_critical": config.VIOLATION_CRITICAL_RATE,
                         "violation_suspend": config.VIOLATION_SUSPEND_RATE,
                         "scan_interval": config.SCAN_INTERVAL_SECONDS})
            await audit_db.commit()
    except Exception as e:
        print(f"[SURVEILLANCE] Audit log error (non-fatal): {e}")

    return {
        "status": "updated",
        "config": {
            "heartbeat_suspend_seconds": config.HEARTBEAT_SUSPEND_SECONDS,
            "violation_warn_rate": config.VIOLATION_WARN_RATE,
            "violation_critical_rate": config.VIOLATION_CRITICAL_RATE,
            "violation_suspend_rate": config.VIOLATION_SUSPEND_RATE,
            "scan_interval_seconds": config.SCAN_INTERVAL_SECONDS,
        },
    }


# ── Paginated systems list ────────────────────────────────────

@router.get("/systems")
async def list_monitored_systems(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("system_name"),
    sort_order: str = Query("asc"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Paginated list of monitored systems with conformance data."""
    from sqlalchemy import func, or_
    from app.models.models import EnveloSession, Certificate
    from datetime import timezone as tz

    base = (
        select(
            EnveloSession.session_id,
            EnveloSession.system_name.label("session_system"),
            EnveloSession.organization_name.label("session_org"),
            EnveloSession.status.label("session_status"),
            EnveloSession.pass_count,
            EnveloSession.block_count,
            EnveloSession.last_heartbeat_at,
            EnveloSession.last_telemetry_at,
            EnveloSession.created_at.label("session_created"),
            EnveloSession.certificate_id,
            EnveloSession.is_demo,
            Certificate.certificate_number,
            Certificate.system_name,
            Certificate.organization_name,
            Certificate.state.label("cert_state"),
            Certificate.expires_at,
            Certificate.application_id,
        )
        .outerjoin(Certificate, EnveloSession.certificate_id == Certificate.id)
        .where(EnveloSession.status.in_(["active", "healthy", "degraded"]))
    )

    if status == "conformant":
        base = base.where(EnveloSession.status == "healthy")
    elif status == "non_conformant":
        base = base.where(EnveloSession.status.in_(["degraded", "critical", "offline"]))

    if search:
        term = f"%{search}%"
        base = base.where(or_(
            Certificate.system_name.ilike(term),
            Certificate.organization_name.ilike(term),
            Certificate.certificate_number.ilike(term),
            EnveloSession.system_name.ilike(term),
            EnveloSession.organization_name.ilike(term),
        ))

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    sort_map = {
        "system_name": Certificate.system_name,
        "organization_name": Certificate.organization_name,
        "certificate_number": Certificate.certificate_number,
        "status": EnveloSession.status,
        "score": EnveloSession.pass_count,
        "block_rate": EnveloSession.block_count,
        "last_seen": EnveloSession.last_heartbeat_at,
    }
    sort_col = sort_map.get(sort_by, Certificate.system_name)
    base = base.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    base = base.limit(limit).offset(offset)

    result = await db.execute(base)
    rows = result.all()

    now = datetime.now(tz.utc)
    systems = []
    for r in rows:
        pc = r.pass_count or 0
        bc = r.block_count or 0
        ta = pc + bc
        block_rate = (bc / ta * 100) if ta > 0 else 0.0
        score = (pc / ta * 100) if ta > 0 else 100.0

        last_seen = r.last_heartbeat_at or r.last_telemetry_at
        last_seen_seconds = None
        if last_seen:
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=tz.utc)
            last_seen_seconds = int((now - last_seen).total_seconds())

        ss = r.session_status or "unknown"
        conformance = "conformant" if ss in ("healthy", "active") else "degraded" if ss == "degraded" else "non_conformant"

        systems.append({
            "session_id": r.session_id,
            "certificate_number": r.certificate_number or "N/A",
            "system_name": r.system_name or r.session_system or "Unknown",
            "organization_name": r.organization_name or r.session_org or "Unknown",
            "status": conformance,
            "score": round(score, 1),
            "total_actions": ta,
            "block_rate": round(block_rate, 2),
            "last_seen_seconds": last_seen_seconds,
            "application_id": r.application_id,
            "cert_state": r.cert_state,
        })

    return {"systems": systems, "total": total, "limit": limit, "offset": offset}
