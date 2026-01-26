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
        started_at=datetime.fromisoformat(data.started_at.replace('Z', '+00:00')),
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
            timestamp=datetime.fromisoformat(record['timestamp'].replace('Z', '+00:00')),
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
    session.last_telemetry_at = datetime.now(timezone.utc)
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
        session.ended_at = datetime.fromisoformat(data.ended_at.replace('Z', '+00:00'))
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
