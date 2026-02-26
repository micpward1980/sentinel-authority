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
        AlertType.CERTIFICATE_REINSTATED,
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
