"""
ENVELO Agent API - Receives telemetry from customer ENVELO agents
Now with database persistence
"""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
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
    session_type: str = "production"  # production or cat72_test
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


@router.post("/sessions", summary="Start new agent session")
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
        session_type=getattr(data, 'session_type', 'production'),
        status="active"
    )
    
    try:
        db.add(session)
        await db.commit()
    except Exception as e:
        await db.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            # Session already exists — return it
            result = await db.execute(
                select(EnveloSession).where(EnveloSession.session_id == data.session_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                return {"status": "already_registered", "session_id": data.session_id}
        raise HTTPException(status_code=500, detail=f"Session register failed: {str(e)}")

    return {"status": "registered", "session_id": data.session_id}


@router.post("/telemetry", summary="Submit agent telemetry")
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
        # Lookup org/system from API key's application
        _org_name = None
        _sys_name = None
        try:
            if hasattr(api_key, 'certificate_id') and api_key.certificate_id:
                cert_r = await db.execute(select(Certificate).where(Certificate.id == api_key.certificate_id))
                cert_obj = cert_r.scalar_one_or_none()
                if cert_obj:
                    _org_name = cert_obj.organization_name
                    _sys_name = cert_obj.system_name
        except Exception:
            pass

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
            action_id=record.get('action_id', record.get('action', '')),
            action_type=record.get('action_type', record.get('parameter', '')),
            result=record.get('result', record.get('decision', '')).upper(),
            execution_time_ms=record.get('execution_time_ms', 0),
            parameters=json.dumps(record.get('parameters', {k: record.get(k) for k in ('parameter','value','boundary') if record.get(k) is not None})),
            boundary_evaluations=json.dumps(record.get('boundary_evaluations', [])),
            system_state=json.dumps(record.get('system_state', {}))
        )
        db.add(telemetry)
        
        # If violation, also add to violations table
        result_val = record.get('result', record.get('decision', '')).upper()
        if result_val == 'BLOCK':
            evals = record.get('boundary_evaluations', [])
            if evals:
                for ev in evals:
                    if not ev.get('passed', True):
                        violation = Violation(
                            session_id=session.id,
                            timestamp=telemetry.timestamp,
                            boundary_name=ev.get('boundary', ev.get('parameter', '')),
                            violation_message=ev.get('message', f"{record.get('parameter','')}: {record.get('value','')} exceeded boundary"),
                            parameters=json.dumps(record.get('parameters', {}))
                        )
                        db.add(violation)
            else:
                # No boundary_evaluations but still a block — record it
                violation = Violation(
                    session_id=session.id,
                    timestamp=telemetry.timestamp,
                    boundary_name=record.get('parameter', record.get('action', '')),
                    violation_message=f"{record.get('parameter','')}: value={record.get('value','')} exceeded boundary={record.get('boundary','')}",
                    parameters=json.dumps({k: record.get(k) for k in ('parameter','value','boundary','action') if record.get(k) is not None})
                )
                db.add(violation)
    
    # Update session stats
    session.last_telemetry_at = datetime.utcnow()
    session.pass_count = (session.pass_count or 0) + data.stats.get('pass_count', 0)
    session.block_count = (session.block_count or 0) + data.stats.get('block_count', 0)
    
    await db.commit()

    # Check for high violations
    try:
        await check_and_notify_violations(session, api_key, db)
    except Exception:
        pass


    


@router.post("/sessions/{session_id}/end", summary="End agent session")
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
        session.pass_count = data.final_stats.get('pass', data.final_stats.get('pass_count', session.pass_count or 0))
        session.block_count = data.final_stats.get('block', data.final_stats.get('block_count', session.block_count or 0))
        await db.commit()

        try:
            await check_and_notify_violations(session, api_key, db)
        except Exception:
            pass

    return {"status": "ended", "session_id": session_id}


    
    return {"status": "ended", "session_id": session_id}


@router.get("/sessions", summary="List my sessions")
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
                "certificate_id": cert_map.get(s.certificate_id, s.certificate_id),
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "last_telemetry_at": s.last_telemetry_at.isoformat() if s.last_telemetry_at else None,
                "last_heartbeat_at": s.last_heartbeat_at.isoformat() if s.last_heartbeat_at else None,
                "offline_reason": getattr(s, "offline_reason", None),
                "pass_count": s.pass_count or 0,
                "block_count": s.block_count or 0,
                "is_online": s.is_online if hasattr(s, "is_online") else False,
                "organization_name": s.organization_name,
                "system_name": s.system_name,
                "session_type": s.session_type
            }
            for s in sessions
        ],
        "total": len(sessions)
    }


@router.get("/sessions/{session_id}", summary="Get session details")
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


@router.get("/sessions/{session_id}/telemetry", summary="Get session telemetry history")
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


@router.get("/sessions/{session_id}/violations", summary="Get session violations")
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


@router.get("/live", summary="Live telemetry feed")
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


@router.get("/stats", summary="Agent statistics summary")
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


@router.patch("/admin/sessions/{session_id}/type")
async def update_session_type(
    session_id: str, session_type: str = "cat72_test",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    s = result.scalar_one_or_none()
    if not s: raise HTTPException(status_code=404)
    s.session_type = session_type
    await db.commit()
    return {"ok": True, "session_id": session_id, "session_type": session_type}

@router.patch("/admin/sessions/{session_id}/meta")
async def update_session_meta(
    session_id: str, org: str = "", sys_name: str = "", demo: bool = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    s = result.scalar_one_or_none()
    if not s: raise HTTPException(status_code=404)
    if org: s.organization_name = org
    if sys_name: s.system_name = sys_name
    if demo is not None: s.is_demo = demo
    await db.commit()
    return {"ok": True}

@router.patch("/admin/sessions/bulk-type")
async def bulk_update_session_type(
    max_id: int = 18, session_type: str = "cat72_test",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    from sqlalchemy import update
    result = await db.execute(update(EnveloSession).where(EnveloSession.id <= max_id).values(session_type=session_type))
    await db.commit()
    return {"ok": True, "updated": result.rowcount}

@router.get("/admin/sessions", summary="Admin: list all sessions")
async def list_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all ENVELO sessions (admin view)"""
    
    # Only allow admin users
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(EnveloSession).where(EnveloSession.session_type != "deleted").order_by(EnveloSession.started_at.desc()).limit(100)
    )
    sessions = result.scalars().all()
    
    return {
        "sessions": [
            {
                "id": s.id,
                "session_id": s.session_id,
                "certificate_id": cert_map.get(s.certificate_id, s.certificate_id),
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "agent_version": s.agent_version,
                "status": s.status,
                "pass_count": s.pass_count,
                "block_count": s.block_count,
                "session_type": getattr(s, 'session_type', 'production') or 'production'
            }
            for s in sessions
        ]
    }


@router.get("/admin/sessions/{session_id}/telemetry")
async def get_session_telemetry_admin(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get telemetry for a session (admin view)"""
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Look up session by string ID
    sess_result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    sess = sess_result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.execute(
        select(TelemetryRecord).where(
            TelemetryRecord.session_id == sess.id
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
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get violations for a session (admin view)"""
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Look up session by string UUID
    sess_result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    sess = sess_result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.execute(
        select(Violation).where(
            Violation.session_id == sess.id
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
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download CAT-72 report PDF for a session"""
    from fastapi.responses import Response
    from app.services.cat72_report_generator import generate_cat72_report
    
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get session
    result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get violations
    result = await db.execute(
        select(Violation).where(Violation.session_id == session.id).order_by(Violation.timestamp)
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




@router.get("/my/sessions/{session_id}/telemetry")
async def get_my_session_telemetry(
    session_id: str,
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get telemetry for own session"""
    # Verify ownership
    key_result = await db.execute(
        select(APIKey).where(
            (APIKey.organization_id == current_user.get("organization_id")) if current_user.get("organization_id") else (APIKey.user_id == int(current_user["sub"]))
        )
    )
    my_keys = [k.id for k in key_result.scalars().all()]
    
    sess_result = await db.execute(
        select(EnveloSession).where(EnveloSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.api_key_id not in my_keys:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.execute(
        select(TelemetryRecord).where(
            TelemetryRecord.session_id == session_id
        ).order_by(TelemetryRecord.timestamp.desc()).limit(limit)
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


@router.get("/my/sessions/{session_id}/violations")
async def get_my_session_violations(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get violations for own session"""
    key_result = await db.execute(
        select(APIKey).where(
            (APIKey.organization_id == current_user.get("organization_id")) if current_user.get("organization_id") else (APIKey.user_id == int(current_user["sub"]))
        )
    )
    my_keys = [k.id for k in key_result.scalars().all()]
    
    sess_result = await db.execute(
        select(EnveloSession).where(EnveloSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.api_key_id not in my_keys:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Look up session by string UUID
    sess_result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    sess = sess_result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.execute(
        select(Violation).where(
            Violation.session_id == sess.id
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


@router.get("/my/sessions/{session_id}/report")
async def download_my_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download CAT-72 report PDF for own session"""
    from fastapi.responses import Response
    from app.services.cat72_report_generator import generate_cat72_report
    
    key_result = await db.execute(
        select(APIKey).where(
            (APIKey.organization_id == current_user.get("organization_id")) if current_user.get("organization_id") else (APIKey.user_id == int(current_user["sub"]))
        )
    )
    my_keys = [k.id for k in key_result.scalars().all()]
    
    result = await db.execute(select(EnveloSession).where(EnveloSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.api_key_id not in my_keys:
        raise HTTPException(status_code=404, detail="Session not found")
    
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
    
    pdf_bytes = generate_cat72_report(
        test_id=session.session_id,
        system_name=session.certificate_id or "Unknown System",
        organization="Customer",
        started_at=session.started_at,
        ended_at=session.ended_at or __import__('datetime').datetime.utcnow(),
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




class SpecReport(BaseModel):
    """Specs discovered by the ENVELO Interlock from the autonomous system."""
    odd_specification: Optional[Dict[str, Any]] = None
    boundaries: Optional[List[dict]] = None
    system_version: Optional[str] = None
    manufacturer: Optional[str] = None
    capabilities: Optional[Dict[str, Any]] = None


@router.post("/report-specs", summary="Interlock reports discovered system specs")
async def report_specs(
    data: SpecReport,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(get_api_key_from_header)
):
    """
    Called by the ENVELO Interlock after connecting to an autonomous system.
    The Interlock discovers the system's ODD, boundaries, version, and capabilities
    and reports them back to Sentinel Authority.
    
    This updates:
    1. The Application record with discovered specs
    2. Any CAT-72 test in scheduled/spec_review state with the real envelope
    """
    from app.models.models import Application, CAT72Test
    
    # Find the application linked to this API key
    app_result = await db.execute(
        select(Application).where(
            Application.applicant_id == api_key.user_id,
            Application.state.in_(["approved", "bounded", "testing"])
        ).order_by(Application.created_at.desc())
    )
    application = app_result.scalars().first()
    
    if not application:
        raise HTTPException(status_code=404, detail="No active application found for this API key")
    
    updated_fields = []
    
    # Update application with discovered specs
    if data.odd_specification:
        application.odd_specification = data.odd_specification
        updated_fields.append("odd_specification")
    
    if data.boundaries:
        env = dict(application.envelope_definition or {})
        if isinstance(env, str):
            try:
                env = json.loads(env)
            except:
                env = {}
        env["boundaries"] = data.boundaries
        application.envelope_definition = env
        flag_modified(application, "envelope_definition")
        updated_fields.append("boundaries")
    
    if data.system_version:
        application.system_version = data.system_version
        updated_fields.append("system_version")
    
    if data.manufacturer:
        application.manufacturer = data.manufacturer
        updated_fields.append("manufacturer")
    
    # Update any CAT-72 test in scheduled or spec_review state
    test_result = await db.execute(
        select(CAT72Test).where(
            CAT72Test.application_id == application.id,
            CAT72Test.state.in_(["scheduled", "spec_review"])
        )
    )
    tests = test_result.scalars().all()
    
    for test in tests:
        if data.boundaries:
            env = dict(test.envelope_definition or {})
            if isinstance(env, str):
                try:
                    env = json.loads(env)
                except:
                    env = {}
            env["boundaries"] = data.boundaries
            test.envelope_definition = env
            flag_modified(test, "envelope_definition")
        
        if data.odd_specification:
            env = dict(test.envelope_definition or {})
            if isinstance(env, str):
                try:
                    env = json.loads(env)
                except:
                    env = {}
            env["odd_specification"] = data.odd_specification
            test.envelope_definition = env
            flag_modified(test, "envelope_definition")
    
    await db.commit()
    
    import logging
    logging.getLogger("main").info(
        f"Interlock reported specs for {application.organization_name}/{application.system_name}: {updated_fields}"
    )
    
    return {
        "status": "ok",
        "application_id": application.id,
        "application_number": application.application_number,
        "updated_fields": updated_fields,
        "tests_updated": len(tests),
        "message": "Specs received and applied to application and pending tests"
    }


@router.post("/heartbeat", summary="Agent heartbeat ping")
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
    
        session.offline_reason = None

    await db.commit()

    # Auto-start any scheduled CAT-72 test when interlock first connects
    if sessions:
        try:
            from app.models.models import CAT72Test, Application
            import hashlib, json
            def compute_hash(data, prev_hash=""):
                raw = json.dumps(data, sort_keys=True, default=str) + prev_hash
                return hashlib.sha256(raw.encode()).hexdigest()
            for session in sessions:
                cat_result = await db.execute(
                    select(CAT72Test).join(Application, CAT72Test.application_id == Application.id).where(
                        CAT72Test.state == "scheduled",
                        Application.organization_name == session.organization_name,
                        Application.system_name == session.system_name
                    )
                )
                pending_test = cat_result.scalar_one_or_none()
                if pending_test:
                    pending_test.state = "running"
                    pending_test.started_at = now
                    genesis = {
                        "type": "genesis",
                        "test_id": pending_test.test_id,
                        "started_at": now.isoformat(),
                        "operator_id": 0,
                        "auto_started": True,
                        
                        "trigger": "interlock_heartbeat",
                        "envelope_definition": pending_test.envelope_definition,
                    }
                    genesis_hash = compute_hash(genesis)
                    pending_test.evidence_chain = [{"block": 0, "hash": genesis_hash, "data": genesis}]
                    pending_test.evidence_hash = genesis_hash
                    await db.commit()
                    import logging
                    logging.getLogger("main").info(f"CAT-72 test {pending_test.test_id} AUTO-STARTED — interlock connected for {session.organization_name} / {session.system_name}")
        except Exception as e:
            import logging
            logging.getLogger("main").warning(f"Auto-start CAT-72 check failed: {e}")

    # Check for high violations on most recent session
    if sessions:
        try:
            await check_and_notify_violations(sessions[-1], api_key, db)
        except Exception:
            pass

    return {"status": "ok", "timestamp": now.isoformat(), "sessions_updated": len(sessions)}


@router.get("/monitoring/overview", summary="Monitoring dashboard overview")
async def get_monitoring_overview(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = 1,
    per_page: int = 25,
    search: str = "",
    sort: str = "last_activity",
    order: str = "desc",
    status: str = "",
    session_type: str = "",
):
    """Get monitoring overview for dashboard with pagination and search"""
    
    from datetime import timedelta
    from sqlalchemy import or_, case
    now = datetime.utcnow()
    
    # Base query - exclude deleted
    base_q = select(EnveloSession).where(EnveloSession.session_type != "deleted")
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        base_q = base_q.where(or_(
            EnveloSession.session_id.ilike(search_term),
            EnveloSession.certificate_id.ilike(search_term),
        ))
    
    # Session type filter
    if session_type:
        base_q = base_q.where(EnveloSession.session_type == session_type)
    
    # Status filter
    if status == "online":
        base_q = base_q.where(EnveloSession.status == "active").where(
            EnveloSession.last_heartbeat_at > (now.replace(tzinfo=None) - timedelta(seconds=120))
        )
    elif status == "offline":
        base_q = base_q.where(EnveloSession.status == "active")
    elif status == "ended":
        base_q = base_q.where(EnveloSession.status == "ended")
    
    # Sort
    from sqlalchemy import case, cast, Float
    pass_rate_expr = case(
        (EnveloSession.pass_count + EnveloSession.block_count > 0,
         cast(EnveloSession.pass_count, Float) / (EnveloSession.pass_count + EnveloSession.block_count)),
        else_=1.0
    )
    sort_map = {
        "last_activity": EnveloSession.last_heartbeat_at,
        "started_at": EnveloSession.started_at,
        "pass_count": EnveloSession.pass_count,
        "block_count": EnveloSession.block_count,
        "uptime": EnveloSession.started_at,
        "organization_name": EnveloSession.organization_name,
        "system_name": EnveloSession.system_name,
        "session_id": EnveloSession.session_id,
        "status": EnveloSession.last_heartbeat_at,
        "pass_rate": pass_rate_expr,
    }
    sort_col = sort_map.get(sort, EnveloSession.last_heartbeat_at)
    if sort_col is not None:
        base_q = base_q.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    else:
        base_q = base_q.order_by(EnveloSession.started_at.desc())
    
    # Get all sessions for this user's certificates
    if current_user.get("role") == "admin":
        # Count total for pagination
        from sqlalchemy import func as sqlfunc
        count_q = select(sqlfunc.count(EnveloSession.id)).where(EnveloSession.session_type != "deleted")
        if search:
            count_q = count_q.where(or_(
                EnveloSession.session_id.ilike(f"%{search}%"),
                EnveloSession.certificate_id.ilike(f"%{search}%"),
            ))
        if session_type:
            count_q = count_q.where(EnveloSession.session_type == session_type)
        total_count = (await db.execute(count_q)).scalar() or 0
        
        # Paginate
        offset = (page - 1) * per_page
        sessions_result = await db.execute(base_q.limit(per_page).offset(offset))
    else:
        # Get user's API keys
        keys_result = await db.execute(
            select(APIKey).where(
            (APIKey.organization_id == current_user.get("organization_id")) if current_user.get("organization_id") else (APIKey.user_id == int(current_user["sub"]))
        )
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
    
    # Build certificate number lookup
    cert_ids = [s.certificate_id for s in sessions if s.certificate_id]
    cert_map = {}
    if cert_ids:
        from app.models.models import Certificate
        cert_result = await db.execute(select(Certificate).where(Certificate.id.in_(cert_ids)))
        for c in cert_result.scalars().all():
            cert_map[c.id] = c.certificate_number

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
        if getattr(s, "is_demo", False):
            is_online = True
        elif s.status == "active" and last_activity:
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
            "certificate_id": cert_map.get(s.certificate_id, s.certificate_id),
            "status": s.status,
            "is_online": is_online,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "last_activity": last_activity.isoformat() if last_activity else None,
            "pass_count": s.pass_count or 0,
            "block_count": s.block_count or 0,
            "uptime_hours": round((now - s.started_at).total_seconds() / 3600, 1) if s.started_at else 0,
            "session_type": getattr(s, "session_type", "production") or "production",
            "is_demo": getattr(s, "is_demo", False),
            "last_heartbeat_at": s.last_heartbeat_at.isoformat() if s.last_heartbeat_at else None,
                "offline_reason": getattr(s, "offline_reason", None),
            "organization_name": getattr(s, "organization_name", None),
            "system_name": getattr(s, "system_name", None)
        })
    
    total_for_pagination = total_count if current_user.get("role") == "admin" else len(session_data)
    return {
        "sessions": session_data,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total_for_pagination,
            "pages": max(1, -(-total_for_pagination // per_page)),
        },
        "summary": {
            "total": total_for_pagination,
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
    session_id: str,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get hourly aggregated data for a session"""
    from datetime import timedelta
    from sqlalchemy import and_
    
    # Get session
    result = await db.execute(select(EnveloSession).where(EnveloSession.session_id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.utcnow()
    start_time = now - timedelta(hours=hours)
    
    # Get telemetry records in time range
    result = await db.execute(
        select(TelemetryRecord).where(
            and_(
                TelemetryRecord.session_id == session.id,
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


@router.get("/monitoring/alerts", summary="Active monitoring alerts")
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
            select(EnveloSession).where(EnveloSession.status == "active", EnveloSession.session_type != "deleted", EnveloSession.is_demo != True)
        )
    else:
        keys_result = await db.execute(
            select(APIKey).where(
            (APIKey.organization_id == current_user.get("organization_id")) if current_user.get("organization_id") else (APIKey.user_id == int(current_user["sub"]))
        )
        )
        user_keys = keys_result.scalars().all()
        key_ids = [k.id for k in user_keys]
        
        if not key_ids:
            return {"alerts": []}
        
        sessions_result = await db.execute(
            select(EnveloSession).where(
                EnveloSession.api_key_id.in_(key_ids),
                EnveloSession.status == "active",
                EnveloSession.session_type != "deleted",
                EnveloSession.is_demo != True
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
                "message": f"Interlock offline for {minutes_offline} minutes",
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


@router.post("/check-offline", summary="Check for offline agents")
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


@router.post("/check-violations", summary="Check violation thresholds")
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


async def check_and_notify_violations(session: EnveloSession, api_key: APIKey, db: AsyncSession):
    """Check violation rate and send notifications if needed"""
    from app.services.email_service import notify_high_violation_rate, notify_admin_high_violations
    from app.models.models import User, Certificate
    
    total = (session.pass_count or 0) + (session.block_count or 0)
    if total < 100:
        return
    
    block_rate = (session.block_count or 0) / total * 100
    if block_rate <= 10:
        return
    
    # Only alert if haven't alerted in last hour
    last_alert = getattr(session, 'last_violation_alert_at', None)
    if last_alert and (datetime.utcnow() - last_alert).total_seconds() < 3600:
        return
    
    try:
        user_result = await db.execute(select(User).where(User.id == api_key.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            return
        
        cert_result = await db.execute(select(Certificate).where(Certificate.id == session.certificate_id))
        cert = cert_result.scalar_one_or_none()
        
        system_name = cert.system_name if cert else "Unknown"
        org_name = cert.organization_name if cert else user.organization or "Unknown"
        
        await notify_high_violation_rate(user.email, system_name, org_name, session.block_count, block_rate)
        await notify_admin_high_violations(system_name, org_name, session.block_count, block_rate, user.email)
        
        session.last_violation_alert_at = datetime.utcnow()
        await db.commit()

        print(f"[ENVELO] Sent violation alert for {org_name} - {system_name}")
    except Exception as e:
        print(f"[ENVELO] Failed to send violation alert: {e}")
