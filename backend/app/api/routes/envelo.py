"""
ENVELO Agent API - Receives telemetry from customer ENVELO agents
Now with database persistence
"""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.core.database import get_db
from app.models.models import EnveloSession, TelemetryRecord, Violation, APIKey, Certificate
from app.api.routes.apikeys import validate_api_key, hash_key
from app.core.security import get_current_user

router = APIRouter()


class SessionCreate(BaseModel):
    certificate_id: str
    session_id: str
    started_at: str
    agent_version: str
    boundaries: List[dict] = []


class TelemetryBatch(BaseModel):
    certificate_id: str
    session_id: str
    records: List[dict]
    stats: Dict[str, int] = {}


class SessionEnd(BaseModel):
    ended_at: str
    final_stats: Dict[str, int] = {}


async def get_api_key_from_header(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
) -> APIKey:
    """Extract and validate API key from Authorization header"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    # Format: "Bearer sa_live_xxxx..."
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    key = parts[1]
    api_key = await validate_api_key(key, db)
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    
    return api_key


@router.post("/sessions")
async def register_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Register a new ENVELO agent session"""
    
    # Parse certificate ID to get the certificate
    cert_result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == data.certificate_id)
    )
    certificate = cert_result.scalar_one_or_none()
    
    # Create session
    session = EnveloSession(
        session_id=data.session_id,
        certificate_id=certificate.id if certificate else None,
        api_key_id=api_key.id,
        started_at=datetime.fromisoformat(data.started_at.replace('Z', '').replace('+00:00', '')),
        agent_version=data.agent_version,
        status="active"
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    print(f"[ENVELO] Session registered: {data.session_id} for cert {data.certificate_id}")
    
    return {"status": "registered", "session_id": data.session_id}


@router.post("/telemetry")
async def receive_telemetry(
    data: TelemetryBatch,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Receive telemetry batch from ENVELO agent"""
    
    # Find session
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_id == data.session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        # Auto-create session if not found
        session = EnveloSession(
            session_id=data.session_id,
            api_key_id=api_key.id,
            status="active"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    
    # Store telemetry records
    for record in data.records:
        telemetry = TelemetryRecord(
            session_id=session.id,
            timestamp=datetime.fromisoformat(record['timestamp'].replace('Z', '').replace('+00:00', '')),
            action_id=record.get('action_id', ''),
            action_type=record.get('action_type', ''),
            result=record.get('result', ''),
            execution_time_ms=record.get('execution_time_ms', 0),
            parameters=json.dumps(record.get('parameters', {})),
            boundary_evaluations=json.dumps(record.get('boundary_evaluations', [])),
            system_state=json.dumps(record.get('system_state', {}))
        )
        db.add(telemetry)
        
        # If violation, also add to violations table
        if record.get('result') == 'BLOCK':
            for eval in record.get('boundary_evaluations', []):
                if not eval.get('passed', True):
                    violation = Violation(
                        session_id=session.id,
                        timestamp=telemetry.timestamp,
                        boundary_name=eval.get('boundary', ''),
                        violation_message=eval.get('message', ''),
                        parameters=json.dumps(record.get('parameters', {}))
                    )
                    db.add(violation)
    
    # Update session stats
    session.last_telemetry_at = datetime.utcnow()
    session.pass_count = (session.pass_count or 0) + data.stats.get('pass_count', 0)
    session.block_count = (session.block_count or 0) + data.stats.get('block_count', 0)
    
    await db.commit()
    
    return {
        "status": "received",
        "records_stored": len(data.records)
    }


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    data: SessionEnd,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """End an ENVELO agent session"""
    
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if session:
        session.status = "ended"
        session.ended_at = datetime.fromisoformat(data.ended_at.replace('Z', '').replace('+00:00', ''))
        session.pass_count = data.final_stats.get('pass_count', session.pass_count)
        session.block_count = data.final_stats.get('block_count', session.block_count)
        await db.commit()
    
    return {"status": "ended", "session_id": session_id}


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """List all ENVELO sessions for this API key's user"""
    
    result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.api_key_id == api_key.id
        ).order_by(EnveloSession.started_at.desc()).limit(100)
    )
    sessions = result.scalars().all()
    
    return {
        "sessions": [
            {
                "session_id": s.session_id,
                "certificate_id": s.certificate_id,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "last_telemetry_at": s.last_telemetry_at.isoformat() if s.last_telemetry_at else None,
                "pass_count": s.pass_count or 0,
                "block_count": s.block_count or 0
            }
            for s in sessions
        ],
        "total": len(sessions)
    }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Get session details"""
    
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Count telemetry records
    count_result = await db.execute(
        select(func.count(TelemetryRecord.id)).where(TelemetryRecord.session_id == session.id)
    )
    telemetry_count = count_result.scalar()
    
    return {
        "session": {
            "session_id": session.session_id,
            "certificate_id": session.certificate_id,
            "status": session.status,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "pass_count": session.pass_count or 0,
            "block_count": session.block_count or 0
        },
        "telemetry_count": telemetry_count
    }


@router.get("/sessions/{session_id}/telemetry")
async def get_session_telemetry(
    session_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Get telemetry records for a session"""
    
    # Find session
    sess_result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get telemetry
    result = await db.execute(
        select(TelemetryRecord).where(
            TelemetryRecord.session_id == session.id
        ).order_by(TelemetryRecord.timestamp.desc()).limit(limit).offset(offset)
    )
    records = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(TelemetryRecord.id)).where(TelemetryRecord.session_id == session.id)
    )
    total = count_result.scalar()
    
    return {
        "records": [
            {
                "timestamp": r.timestamp.isoformat(),
                "action_id": r.action_id,
                "action_type": r.action_type,
                "result": r.result,
                "execution_time_ms": r.execution_time_ms,
                "parameters": json.loads(r.parameters) if r.parameters else {},
                "boundary_evaluations": json.loads(r.boundary_evaluations) if r.boundary_evaluations else []
            }
            for r in records
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/sessions/{session_id}/violations")
async def get_session_violations(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Get all violations for a session"""
    
    # Find session
    sess_result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.execute(
        select(Violation).where(
            Violation.session_id == session.id
        ).order_by(Violation.timestamp.desc())
    )
    violations = result.scalars().all()
    
    return {
        "violations": [
            {
                "timestamp": v.timestamp.isoformat(),
                "boundary_name": v.boundary_name,
                "violation_message": v.violation_message,
                "parameters": json.loads(v.parameters) if v.parameters else {}
            }
            for v in violations
        ],
        "total": len(violations)
    }


@router.get("/live")
async def get_live_sessions(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Get all currently active sessions"""
    
    result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.api_key_id == api_key.id,
            EnveloSession.status == "active"
        )
    )
    sessions = result.scalars().all()
    
    return {
        "active_sessions": [
            {
                "session_id": s.session_id,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "last_telemetry_at": s.last_telemetry_at.isoformat() if s.last_telemetry_at else None,
                "pass_count": s.pass_count or 0,
                "block_count": s.block_count or 0
            }
            for s in sessions
        ],
        "total_active": len(sessions)
    }


@router.get("/stats")
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """Get global ENVELO statistics (public endpoint)"""
    
    # Total sessions
    total_sess = await db.execute(select(func.count(EnveloSession.id)))
    total_sessions = total_sess.scalar()
    
    # Active sessions
    active_sess = await db.execute(
        select(func.count(EnveloSession.id)).where(EnveloSession.status == "active")
    )
    active_sessions = active_sess.scalar()
    
    # Total telemetry
    total_tel = await db.execute(select(func.count(TelemetryRecord.id)))
    total_telemetry = total_tel.scalar()
    
    # Total violations
    total_viol = await db.execute(select(func.count(Violation.id)))
    total_violations = total_viol.scalar()
    
    return {
        "total_sessions": total_sessions or 0,
        "active_sessions": active_sessions or 0,
        "total_telemetry_records": total_telemetry or 0,
        "total_violations": total_violations or 0
    }


@router.get("/admin/sessions")
async def list_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all ENVELO sessions (admin view)"""
    
    # Only allow admin users
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(EnveloSession).order_by(EnveloSession.started_at.desc()).limit(100)
    )
    sessions = result.scalars().all()
    
    return {
        "sessions": [
            {
                "id": s.id,
                "session_id": s.session_id,
                "certificate_id": s.certificate_id,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "agent_version": s.agent_version,
                "status": s.status,
                "pass_count": s.pass_count,
                "block_count": s.block_count
            }
            for s in sessions
        ]
    }


@router.get("/admin/sessions/{session_id}/telemetry")
async def get_session_telemetry_admin(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get telemetry for a session (admin view)"""
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(TelemetryRecord).where(
            TelemetryRecord.session_id == session_id
        ).order_by(TelemetryRecord.timestamp.desc()).limit(1000)
    )
    records = result.scalars().all()
    
    return {
        "records": [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "action_id": r.action_id,
                "action_type": r.action_type,
                "result": r.result,
                "execution_time_ms": r.execution_time_ms,
                "parameters": r.parameters,
                "boundary_evaluations": r.boundary_evaluations
            }
            for r in records
        ]
    }


@router.get("/admin/sessions/{session_id}/violations")
async def get_session_violations_admin(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get violations for a session (admin view)"""
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(Violation).where(
            Violation.session_id == session_id
        ).order_by(Violation.timestamp.desc())
    )
    violations = result.scalars().all()
    
    return {
        "violations": [
            {
                "id": v.id,
                "timestamp": v.timestamp.isoformat() if v.timestamp else None,
                "boundary_name": v.boundary_name,
                "violation_message": v.violation_message,
                "parameters": v.parameters
            }
            for v in violations
        ]
    }


@router.get("/admin/sessions/{session_id}/report")
async def download_session_report(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download CAT-72 report PDF for a session"""
    from fastapi.responses import Response
    from app.services.cat72_report_generator import generate_cat72_report
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get session
    result = await db.execute(select(EnveloSession).where(EnveloSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get violations
    result = await db.execute(
        select(Violation).where(Violation.session_id == session_id).order_by(Violation.timestamp)
    )
    violations = result.scalars().all()
    
    violation_list = [
        {"timestamp": v.timestamp.isoformat() if v.timestamp else None, 
         "boundary_name": v.boundary_name, 
         "violation_message": v.violation_message}
        for v in violations
    ]
    
    # Generate PDF
    pdf_bytes = generate_cat72_report(
        test_id=session.session_id,
        system_name=session.certificate_id or "Unknown System",
        organization="Customer",
        started_at=session.started_at,
        ended_at=session.ended_at or datetime.utcnow(),
        total_actions=(session.pass_count or 0) + (session.block_count or 0),
        pass_count=session.pass_count or 0,
        block_count=session.block_count or 0,
        pass_rate=((session.pass_count or 0) / max((session.pass_count or 0) + (session.block_count or 0), 1)) * 100,
        result="PASS" if session.status == "passed" else "IN PROGRESS",
        violations=violation_list
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CAT72-Report-{session.session_id}.pdf"}
    )


@router.get("/admin/sessions/{session_id}/report")
async def download_session_report(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download CAT-72 report PDF for a session"""
    from fastapi.responses import Response
    from app.services.cat72_report_generator import generate_cat72_report
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get session
    result = await db.execute(select(EnveloSession).where(EnveloSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get violations
    result = await db.execute(
        select(Violation).where(Violation.session_id == session_id).order_by(Violation.timestamp)
    )
    violations = result.scalars().all()
    
    violation_list = [
        {"timestamp": v.timestamp.isoformat() if v.timestamp else None, 
         "boundary_name": v.boundary_name, 
         "violation_message": v.violation_message}
        for v in violations
    ]
    
    # Generate PDF
    pdf_bytes = generate_cat72_report(
        test_id=session.session_id,
        system_name=session.certificate_id or "Unknown System",
        organization="Customer",
        started_at=session.started_at,
        ended_at=session.ended_at or datetime.utcnow(),
        total_actions=(session.pass_count or 0) + (session.block_count or 0),
        pass_count=session.pass_count or 0,
        block_count=session.block_count or 0,
        pass_rate=((session.pass_count or 0) / max((session.pass_count or 0) + (session.block_count or 0), 1)) * 100,
        result="PASS" if session.status == "passed" else "IN PROGRESS",
        violations=violation_list
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CAT72-Report-{session.session_id}.pdf"}
    )


@router.post("/heartbeat")
async def receive_heartbeat(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """Receive heartbeat from ENVELO agent - lightweight ping to confirm agent is alive"""
    from pydantic import BaseModel
    
    # Update all active sessions for this API key
    result = await db.execute(
        select(EnveloSession).where(
            EnveloSession.api_key_id == api_key.id,
            EnveloSession.status == "active"
        )
    )
    sessions = result.scalars().all()
    
    now = datetime.utcnow()
    for session in sessions:
        session.last_heartbeat_at = now
    
    await db.commit()
    
    return {"status": "ok", "timestamp": now.isoformat(), "sessions_updated": len(sessions)}


@router.get("/monitoring/overview")
async def get_monitoring_overview(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get monitoring overview for dashboard"""
    
    from datetime import timedelta
    now = datetime.utcnow()
    
    # Get all sessions for this user's certificates
    if current_user.get("role") == "admin":
        sessions_result = await db.execute(
            select(EnveloSession).order_by(EnveloSession.started_at.desc()).limit(100)
        )
    else:
        # Get user's API keys
        keys_result = await db.execute(
            select(APIKey).where(APIKey.user_id == int(current_user["sub"]))
        )
        user_keys = keys_result.scalars().all()
        key_ids = [k.id for k in user_keys]
        
        if not key_ids:
            return {"sessions": [], "summary": {"total": 0, "active": 0, "offline": 0}}
        
        sessions_result = await db.execute(
            select(EnveloSession).where(
                EnveloSession.api_key_id.in_(key_ids)
            ).order_by(EnveloSession.started_at.desc()).limit(100)
        )
    
    sessions = sessions_result.scalars().all()
    
    # Categorize sessions
    active_count = 0
    offline_count = 0
    total_pass = 0
    total_block = 0
    
    session_data = []
    for s in sessions:
        # Check if session is online (heartbeat within last 2 minutes)
        last_activity = s.last_heartbeat_at or s.last_telemetry_at or s.started_at
        is_online = False
        if s.status == "active" and last_activity:
            is_online = (now - last_activity).total_seconds() < 120
        
        if s.status == "active":
            if is_online:
                active_count += 1
            else:
                offline_count += 1
        
        total_pass += s.pass_count or 0
        total_block += s.block_count or 0
        
        session_data.append({
            "id": s.id,
            "session_id": s.session_id,
            "certificate_id": s.certificate_id,
            "status": s.status,
            "is_online": is_online,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "last_activity": last_activity.isoformat() if last_activity else None,
            "pass_count": s.pass_count or 0,
            "block_count": s.block_count or 0,
            "uptime_hours": round((now - s.started_at).total_seconds() / 3600, 1) if s.started_at else 0
        })
    
    return {
        "sessions": session_data,
        "summary": {
            "total": len(sessions),
            "active": active_count,
            "offline": offline_count,
            "ended": len([s for s in sessions if s.status == "ended"]),
            "total_actions": total_pass + total_block,
            "total_pass": total_pass,
            "total_block": total_block,
            "pass_rate": round((total_pass / max(total_pass + total_block, 1)) * 100, 2)
        }
    }


@router.get("/monitoring/session/{session_id}/timeline")
async def get_session_timeline(
    session_id: int,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get hourly aggregated data for a session"""
    from datetime import timedelta
    from sqlalchemy import and_
    
    # Get session
    result = await db.execute(select(EnveloSession).where(EnveloSession.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.utcnow()
    start_time = now - timedelta(hours=hours)
    
    # Get telemetry records in time range
    result = await db.execute(
        select(TelemetryRecord).where(
            and_(
                TelemetryRecord.session_id == session_id,
                TelemetryRecord.timestamp >= start_time
            )
        ).order_by(TelemetryRecord.timestamp)
    )
    records = result.scalars().all()
    
    # Aggregate by hour
    hourly_data = {}
    for r in records:
        hour_key = r.timestamp.replace(minute=0, second=0, microsecond=0).isoformat()
        if hour_key not in hourly_data:
            hourly_data[hour_key] = {"pass": 0, "block": 0, "total": 0}
        hourly_data[hour_key]["total"] += 1
        if r.result == "PASS":
            hourly_data[hour_key]["pass"] += 1
        else:
            hourly_data[hour_key]["block"] += 1
    
    return {
        "session_id": session_id,
        "hours": hours,
        "timeline": [
            {"hour": k, "pass": v["pass"], "block": v["block"], "total": v["total"]}
            for k, v in sorted(hourly_data.items())
        ]
    }


@router.get("/monitoring/alerts")
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current alerts for monitoring"""
    from datetime import timedelta
    
    now = datetime.utcnow()
    alerts = []
    
    # Get sessions that should be monitored
    if current_user.get("role") == "admin":
        sessions_result = await db.execute(
            select(EnveloSession).where(EnveloSession.status == "active")
        )
    else:
        keys_result = await db.execute(
            select(APIKey).where(APIKey.user_id == int(current_user["sub"]))
        )
        user_keys = keys_result.scalars().all()
        key_ids = [k.id for k in user_keys]
        
        if not key_ids:
            return {"alerts": []}
        
        sessions_result = await db.execute(
            select(EnveloSession).where(
                EnveloSession.api_key_id.in_(key_ids),
                EnveloSession.status == "active"
            )
        )
    
    sessions = sessions_result.scalars().all()
    
    for s in sessions:
        last_activity = s.last_heartbeat_at or s.last_telemetry_at
        
        # Alert if no activity for 2+ minutes
        if last_activity and (now - last_activity).total_seconds() > 120:
            minutes_offline = int((now - last_activity).total_seconds() / 60)
            alerts.append({
                "type": "offline",
                "severity": "critical" if minutes_offline > 10 else "warning",
                "session_id": s.session_id,
                "message": f"Agent offline for {minutes_offline} minutes",
                "since": last_activity.isoformat()
            })
        
        # Alert if high violation rate
        total = (s.pass_count or 0) + (s.block_count or 0)
        if total > 100:
            block_rate = (s.block_count or 0) / total * 100
            if block_rate > 10:
                alerts.append({
                    "type": "high_violations",
                    "severity": "warning",
                    "session_id": s.session_id,
                    "message": f"High violation rate: {block_rate:.1f}%",
                    "block_count": s.block_count
                })
    
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/check-offline")
async def check_offline_agents(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check for offline agents and send notifications (admin only)"""
    from app.services.email_service import notify_agent_offline, notify_admin_agent_offline
    from app.models.models import User, Certificate
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.utcnow()
    notifications_sent = 0
    
    # Get all active sessions
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.status == "active")
    )
    sessions = result.scalars().all()
    
    for session in sessions:
        last_activity = session.last_heartbeat_at or session.last_telemetry_at
        if not last_activity:
            continue
            
        minutes_offline = int((now - last_activity).total_seconds() / 60)
        
        # Only alert if offline for more than 5 minutes and hasn't been notified recently
        if minutes_offline >= 5:
            # Get the API key owner
            api_key_result = await db.execute(
                select(APIKey).where(APIKey.id == session.api_key_id)
            )
            api_key = api_key_result.scalar_one_or_none()
            
            if api_key:
                user_result = await db.execute(
                    select(User).where(User.id == api_key.user_id)
                )
                user = user_result.scalar_one_or_none()
                
                if user:
                    # Get certificate info for system name
                    cert_result = await db.execute(
                        select(Certificate).where(Certificate.id == session.certificate_id)
                    )
                    cert = cert_result.scalar_one_or_none()
                    
                    system_name = cert.system_name if cert else "Unknown System"
                    org_name = cert.organization_name if cert else user.organization or "Unknown"
                    
                    try:
                        await notify_agent_offline(
                            user.email, system_name, session.session_id, org_name, minutes_offline
                        )
                        await notify_admin_agent_offline(
                            system_name, org_name, session.session_id, minutes_offline, user.email
                        )
                        notifications_sent += 1
                    except Exception as e:
                        print(f"Failed to send offline notification: {e}")
    
    # Also check for high violation rates
    for session in sessions:
        total = (session.pass_count or 0) + (session.block_count or 0)
        if total > 100:
            block_rate = (session.block_count or 0) / total * 100
            if block_rate > 10:  # More than 10% violations
                api_key_result = await db.execute(select(APIKey).where(APIKey.id == session.api_key_id))
                api_key = api_key_result.scalar_one_or_none()
                if api_key:
                    user_result = await db.execute(select(User).where(User.id == api_key.user_id))
                    user = user_result.scalar_one_or_none()
                    if user:
                        cert_result = await db.execute(select(Certificate).where(Certificate.id == session.certificate_id))
                        cert = cert_result.scalar_one_or_none()
                        system_name = cert.system_name if cert else "Unknown"
                        org_name = cert.organization_name if cert else user.organization or "Unknown"
                        try:
                            from app.services.email_service import notify_high_violation_rate, notify_admin_high_violations
                            await notify_high_violation_rate(user.email, system_name, org_name, session.block_count, block_rate)
                            await notify_admin_high_violations(system_name, org_name, session.block_count, block_rate, user.email)
                            notifications_sent += 1
                        except Exception as e:
                            print(f"Failed to send violation notification: {e}")

    return {"notifications_sent": notifications_sent}


@router.post("/check-violations")
async def check_violation_rates(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check for high violation rates and send notifications (admin only)"""
    from app.services.email_service import notify_high_violation_rate, notify_admin_high_violations
    from app.models.models import User, Certificate
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    notifications_sent = 0
    
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.status == "active")
    )
    sessions = result.scalars().all()
    
    for session in sessions:
        total = (session.pass_count or 0) + (session.block_count or 0)
        if total > 100:
            block_rate = (session.block_count or 0) / total * 100
            if block_rate > 10:
                api_key_result = await db.execute(
                    select(APIKey).where(APIKey.id == session.api_key_id)
                )
                api_key = api_key_result.scalar_one_or_none()
                
                if api_key:
                    user_result = await db.execute(
                        select(User).where(User.id == api_key.user_id)
                    )
                    user = user_result.scalar_one_or_none()
                    
                    if user:
                        cert_result = await db.execute(
                            select(Certificate).where(Certificate.id == session.certificate_id)
                        )
                        cert = cert_result.scalar_one_or_none()
                        
                        system_name = cert.system_name if cert else "Unknown"
                        org_name = cert.organization_name if cert else user.organization or "Unknown"
                        
                        try:
                            await notify_high_violation_rate(
                                user.email, system_name, org_name, session.block_count, block_rate
                            )
                            await notify_admin_high_violations(
                                system_name, org_name, session.block_count, block_rate, user.email
                            )
                            notifications_sent += 1
                        except Exception as e:
                            print(f"Failed to send violation notification: {e}")
    
    return {"notifications_sent": notifications_sent}
