"""
ENVELO Agent API - Receives telemetry from customer ENVELO agents
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.core.database import get_db

router = APIRouter()

# In-memory storage for MVP (replace with database tables later)
_sessions: Dict[str, dict] = {}
_telemetry: Dict[str, List[dict]] = {}


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


@router.post("/sessions")
async def register_session(data: SessionCreate, db: AsyncSession = Depends(get_db)):
    """Register a new ENVELO agent session"""
    session_data = {
        "certificate_id": data.certificate_id,
        "session_id": data.session_id,
        "started_at": data.started_at,
        "agent_version": data.agent_version,
        "boundaries": data.boundaries,
        "status": "active",
        "registered_at": datetime.now(timezone.utc).isoformat()
    }
    
    _sessions[data.session_id] = session_data
    _telemetry[data.session_id] = []
    
    print(f"[ENVELO] Session registered: {data.session_id} for cert {data.certificate_id}")
    
    return {"status": "registered", "session_id": data.session_id}


@router.post("/telemetry")
async def receive_telemetry(data: TelemetryBatch, db: AsyncSession = Depends(get_db)):
    """Receive telemetry batch from ENVELO agent"""
    
    if data.session_id not in _sessions:
        _sessions[data.session_id] = {
            "certificate_id": data.certificate_id,
            "session_id": data.session_id,
            "status": "active",
            "auto_registered": True
        }
        _telemetry[data.session_id] = []
    
    _telemetry[data.session_id].extend(data.records)
    
    _sessions[data.session_id]["last_telemetry"] = datetime.now(timezone.utc).isoformat()
    _sessions[data.session_id]["stats"] = data.stats
    _sessions[data.session_id]["record_count"] = len(_telemetry[data.session_id])
    
    violations = [r for r in data.records if r.get("result") == "BLOCK"]
    if violations:
        _sessions[data.session_id]["last_violation"] = violations[-1]
        print(f"[ENVELO] VIOLATION in session {data.session_id}: {violations[-1]}")
    
    return {
        "status": "received",
        "records_stored": len(data.records),
        "total_records": len(_telemetry[data.session_id])
    }


@router.post("/sessions/{session_id}/end")
async def end_session(session_id: str, data: SessionEnd, db: AsyncSession = Depends(get_db)):
    """End an ENVELO agent session"""
    
    if session_id in _sessions:
        _sessions[session_id]["status"] = "ended"
        _sessions[session_id]["ended_at"] = data.ended_at
        _sessions[session_id]["final_stats"] = data.final_stats
    
    return {"status": "ended", "session_id": session_id}


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List all ENVELO sessions"""
    return {"sessions": list(_sessions.values()), "total": len(_sessions)}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get session details"""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": _sessions[session_id], "telemetry_count": len(_telemetry.get(session_id, []))}


@router.get("/sessions/{session_id}/telemetry")
async def get_session_telemetry(session_id: str, limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """Get telemetry records for a session"""
    if session_id not in _telemetry:
        raise HTTPException(status_code=404, detail="Session not found")
    
    records = _telemetry[session_id]
    total = len(records)
    records = records[offset:offset + limit]
    
    return {"records": records, "total": total, "limit": limit, "offset": offset}


@router.get("/sessions/{session_id}/violations")
async def get_session_violations(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get all violations for a session"""
    if session_id not in _telemetry:
        raise HTTPException(status_code=404, detail="Session not found")
    
    violations = [r for r in _telemetry[session_id] if r.get("result") == "BLOCK"]
    return {"violations": violations, "total": len(violations)}


@router.get("/live")
async def get_live_sessions(db: AsyncSession = Depends(get_db)):
    """Get all currently active sessions"""
    active = [s for s in _sessions.values() if s.get("status") == "active"]
    return {"active_sessions": active, "total_active": len(active)}


@router.get("/stats")
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """Get global ENVELO statistics"""
    total_sessions = len(_sessions)
    active_sessions = len([s for s in _sessions.values() if s.get("status") == "active"])
    total_records = sum(len(t) for t in _telemetry.values())
    total_violations = sum(len([r for r in t if r.get("result") == "BLOCK"]) for t in _telemetry.values())
    
    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "total_telemetry_records": total_records,
        "total_violations": total_violations
    }
