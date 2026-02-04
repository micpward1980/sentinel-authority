"""Session management — view active sessions, revoke tokens."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import UserSession

router = APIRouter()


@router.get("/sessions", summary="List active sessions for current user")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])
    current_sid = current_user.get("sid")
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_active == True)
        .order_by(UserSession.last_active_at.desc())
    )
    sessions = result.scalars().all()
    return {
        "sessions": [
            {
                "id": s.id, "session_id": s.session_id,
                "ip_address": s.ip_address, "user_agent": s.user_agent,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
                "is_current": s.session_id == current_sid,
            }
            for s in sessions
        ],
        "current_session_id": current_sid,
    }


@router.delete("/sessions/{session_id}", summary="Revoke a specific session")
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])
    if session_id == current_user.get("sid"):
        raise HTTPException(status_code=400, detail="Cannot revoke current session")
    result = await db.execute(
        select(UserSession).where(
            UserSession.session_id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    session.revoked_at = datetime.utcnow()
    await db.commit()
    return {"message": "Session revoked"}


@router.delete("/sessions", summary="Revoke all sessions except current")
async def revoke_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])
    current_sid = current_user.get("sid")
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_active == True, UserSession.session_id != current_sid)
        .values(is_active=False, revoked_at=datetime.utcnow())
    )
    await db.commit()
    return {"message": "All other sessions revoked"}
