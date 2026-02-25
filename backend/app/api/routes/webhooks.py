"""
Webhook Management
Customers register URLs to receive push notifications on application/certificate events.
"""

import hmac, hashlib, json, time, httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import APIKey

router = APIRouter()

# ── In-memory webhook store (replace with DB table in v2) ─────────────────────
# Structure: { user_id: [ {id, url, secret, events, active} ] }
_webhooks: dict = {}
_webhook_id = 0

VALID_EVENTS = {
    "application.submitted",
    "application.under_review",
    "application.approved",
    "application.pre_review_complete",
    "application.rejected",
    "application.suspended",
    "cat72.started",
    "cat72.passed",
    "cat72.failed",
    "certificate.issued",
    "certificate.expiring",
    "certificate.revoked",
    "envelo.violation",
    "envelo.session_started",
}

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

@router.post("", response_model=WebhookResponse)
async def create_webhook(body: WebhookCreate, user: dict = Depends(get_current_user)):
    global _webhook_id
    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(400, f"Invalid events: {invalid}. Valid: {sorted(VALID_EVENTS)}")
    if not body.url.startswith("https://"):
        raise HTTPException(400, "Webhook URL must use HTTPS")

    _webhook_id += 1
    wh = {
        "id": _webhook_id,
        "url": body.url,
        "events": body.events,
        "secret": body.secret or "",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user.get("id"),
    }
    uid = str(user.get("id"))
    _webhooks.setdefault(uid, []).append(wh)
    return WebhookResponse(**{k: v for k, v in wh.items() if k != "secret" and k != "user_id"})

@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(user: dict = Depends(get_current_user)):
    uid = str(user.get("id"))
    return [
        WebhookResponse(**{k: v for k, v in wh.items() if k != "secret" and k != "user_id"})
        for wh in _webhooks.get(uid, [])
    ]

@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: int, user: dict = Depends(get_current_user)):
    uid = str(user.get("id"))
    hooks = _webhooks.get(uid, [])
    _webhooks[uid] = [h for h in hooks if h["id"] != webhook_id]
    return {"message": "Webhook deleted"}

# ── Dispatch function (called internally on state changes) ────────────────────
async def fire_webhook(user_id: int, event: str, payload: dict):
    """Fire webhooks for a given user and event. Non-blocking — failures are logged not raised."""
    uid = str(user_id)
    hooks = [h for h in _webhooks.get(uid, []) if h["active"] and event in h["events"]]
    if not hooks:
        return

    body = json.dumps({
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    })

    async with httpx.AsyncClient(timeout=10) as client:
        for hook in hooks:
            try:
                headers = {"Content-Type": "application/json", "X-Sentinel-Event": event}
                if hook.get("secret"):
                    sig = hmac.new(hook["secret"].encode(), body.encode(), hashlib.sha256).hexdigest()
                    headers["X-Sentinel-Signature"] = f"sha256={sig}"
                await client.post(hook["url"], content=body, headers=headers)
            except Exception as e:
                print(f"Webhook delivery failed for {hook['url']}: {e}")
