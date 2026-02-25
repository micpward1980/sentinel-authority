"""
Webhook Management
Customers register URLs to receive push notifications on application/certificate events.
Persisted to DB — survives restarts.
"""

import hmac, hashlib, json, secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from typing import Optional, List
import httpx

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Base

router = APIRouter()

VALID_EVENTS = {
    "application.submitted", "application.under_review", "application.approved",
    "application.pre_review_complete", "application.rejected", "application.suspended",
    "cat72.started", "cat72.passed", "cat72.failed",
    "certificate.issued", "certificate.expiring", "certificate.revoked",
    "envelo.violation", "envelo.session_started",
}

# ── DB Model ──────────────────────────────────────────────────────────────────
class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(100), nullable=True)
    events = Column(JSON, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_fired_at = Column(DateTime, nullable=True)
    failure_count = Column(Integer, default=0)

# ── Schemas ───────────────────────────────────────────────────────────────────
class WebhookCreate(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None

class WebhookResponse(BaseModel):
    id: int
    url: str
    events: List[str]
    active: bool
    created_at: str
    failure_count: int

# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("", response_model=WebhookResponse)
async def create_webhook(body: WebhookCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(400, f"Invalid events: {invalid}")
    if not body.url.startswith("https://"):
        raise HTTPException(400, "Webhook URL must use HTTPS")
    wh = Webhook(
        user_id=user.get("id") or int(user.get("sub", 0)),
        url=body.url,
        secret=body.secret or secrets.token_hex(16),
        events=body.events,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return WebhookResponse(id=wh.id, url=wh.url, events=wh.events, active=wh.active,
                           created_at=wh.created_at.isoformat(), failure_count=wh.failure_count)

@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    uid = user.get("id") or int(user.get("sub", 0))
    result = await db.execute(select(Webhook).where(Webhook.user_id == uid, Webhook.active == True))
    return [WebhookResponse(id=w.id, url=w.url, events=w.events, active=w.active,
                            created_at=w.created_at.isoformat(), failure_count=w.failure_count)
            for w in result.scalars().all()]

@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    uid = user.get("id") or int(user.get("sub", 0))
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id, Webhook.user_id == uid))
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    wh.active = False
    await db.commit()
    return {"message": "Webhook deleted"}

# ── Dispatch ──────────────────────────────────────────────────────────────────
async def fire_webhook(user_id: int, event: str, payload: dict):
    from app.core.database import async_session_factory
    async with async_session_factory() as db:
        result = await db.execute(
            select(Webhook).where(Webhook.user_id == user_id, Webhook.active == True)
        )
        hooks = [w for w in result.scalars().all() if event in (w.events or [])]
        if not hooks:
            return
        body = json.dumps({"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), "data": payload})
        async with httpx.AsyncClient(timeout=10) as client:
            for hook in hooks:
                try:
                    headers = {"Content-Type": "application/json", "X-Sentinel-Event": event}
                    if hook.secret:
                        sig = hmac.new(hook.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                        headers["X-Sentinel-Signature"] = f"sha256={sig}"
                    await client.post(hook.url, content=body, headers=headers)
                    hook.last_fired_at = datetime.utcnow()
                    hook.failure_count = 0
                except Exception as e:
                    hook.failure_count = (hook.failure_count or 0) + 1
                    if hook.failure_count >= 10:
                        hook.active = False  # Auto-disable after 10 consecutive failures
                    print(f"Webhook delivery failed {hook.url}: {e}")
        await db.commit()
