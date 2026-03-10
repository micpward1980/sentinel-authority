"""
Webhook Management
Customers register URLs to receive push notifications on application/certificate events.
Persisted to DB — survives restarts.
"""

import hmac
import hashlib
import ipaddress
import json
import logging
import secrets
import socket
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Base

logger = logging.getLogger("sentinel.webhooks")
router = APIRouter()

# Strict event allowlist — customers can only subscribe to these
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
    "certificate.suspended",
    "certificate.reinstated",
    "certificate.withdrawn",
    "envelo.violation",
    "envelo.session_started",
    "invoice.paid",
}

MAX_URL_LENGTH = 2048
MAX_FAILURE_COUNT = 10


# ── DB Model ──────────────────────────────────────────────────────────────────

class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    url = Column(String(MAX_URL_LENGTH), nullable=False)
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


# ── SSRF Protection ───────────────────────────────────────────────────────────

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return True  # fail closed


def _validate_webhook_url(url: str) -> None:
    """Validate URL is safe to deliver to. Raises HTTPException on failure."""
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Webhook URL must use HTTPS")

    if len(url) > MAX_URL_LENGTH:
        raise HTTPException(status_code=400, detail=f"Webhook URL exceeds {MAX_URL_LENGTH} character limit")

    # SSRF: resolve hostname and check it's not a private/loopback address
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            raise HTTPException(status_code=400, detail="Invalid webhook URL (no hostname)")

        # Block localhost variants by name
        if hostname.lower() in ("localhost", "0.0.0.0", "[::]"):
            raise HTTPException(status_code=400, detail="Webhook URL cannot point to localhost")

        # Resolve and check all addresses
        addr_infos = socket.getaddrinfo(hostname, None)
        for info in addr_infos:
            ip = info[4][0]
            if _is_private_ip(ip):
                raise HTTPException(
                    status_code=400,
                    detail="Webhook URL cannot point to a private or internal IP address",
                )
    except HTTPException:
        raise
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Webhook URL hostname could not be resolved")
    except Exception as exc:
        logger.warning("Webhook URL validation error: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook URL")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=WebhookResponse)
async def create_webhook(
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid events: {invalid}")

    _validate_webhook_url(body.url)

    wh = Webhook(
        user_id=user.get("id") or int(user.get("sub", 0)),
        url=body.url,
        secret=body.secret or secrets.token_hex(16),
        events=body.events,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)

    return WebhookResponse(
        id=wh.id, url=wh.url, events=wh.events, active=wh.active,
        created_at=wh.created_at.isoformat(), failure_count=wh.failure_count,
    )


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user.get("id") or int(user.get("sub", 0))
    result = await db.execute(select(Webhook).where(Webhook.user_id == uid, Webhook.active == True))
    return [
        WebhookResponse(
            id=w.id, url=w.url, events=w.events, active=w.active,
            created_at=w.created_at.isoformat(), failure_count=w.failure_count,
        )
        for w in result.scalars().all()
    ]


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user.get("id") or int(user.get("sub", 0))
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id, Webhook.user_id == uid))
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    wh.active = False
    await db.commit()
    return {"message": "Webhook deleted"}


# ── Dispatch ──────────────────────────────────────────────────────────────────

async def fire_webhook(user_id: int, event: str, payload: dict):
    """Deliver event to all matching webhooks for a user."""
    # Only fire known events
    if event not in VALID_EVENTS:
        logger.warning("fire_webhook called with unknown event: %s", event)
        return

    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Webhook).where(Webhook.user_id == user_id, Webhook.active == True)
        )
        hooks = [w for w in result.scalars().all() if event in (w.events or [])]
        if not hooks:
            return

        # Deterministic compact JSON for signing
        body = json.dumps(
            {"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), "data": payload},
            sort_keys=True,
            separators=(",", ":"),
        )

        async with httpx.AsyncClient(timeout=10) as client:
            for hook in hooks:
                try:
                    headers = {
                        "Content-Type": "application/json",
                        "X-Sentinel-Event": event,
                    }
                    if hook.secret:
                        sig = hmac.new(
                            hook.secret.encode(),
                            body.encode(),
                            hashlib.sha256,
                        ).hexdigest()
                        headers["X-Sentinel-Signature"] = f"sha256={sig}"

                    await client.post(hook.url, content=body, headers=headers)
                    hook.last_fired_at = datetime.utcnow()
                    hook.failure_count = 0
                except Exception as exc:
                    hook.failure_count = (hook.failure_count or 0) + 1
                    logger.warning("Webhook delivery failed %s: %s", hook.url, exc)
                    if hook.failure_count >= MAX_FAILURE_COUNT:
                        hook.active = False
                        logger.warning(
                            "Webhook %s auto-disabled after %d consecutive failures",
                            hook.url, MAX_FAILURE_COUNT,
                        )

        await db.commit()
