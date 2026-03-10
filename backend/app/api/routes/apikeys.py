"""API Key Management"""

import hashlib
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import APIKey, Certificate, User
from app.services.audit_service import write_audit_log

router = APIRouter()

ALLOWED_SCOPES = {"full", "envelo_only", "read_only"}


def generate_api_key() -> str:
    return f"sa_live_{secrets.token_hex(20)}"


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


class APIKeyCreate(BaseModel):
    name: str
    certificate_id: Optional[int] = None
    scope: Optional[str] = "full"


@router.post("/generate", summary="Generate new API key")
async def generate_new_key(
    data: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)

    # Validate scope
    scope = (data.scope or "full").strip()
    if scope not in ALLOWED_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scope '{scope}'. Allowed: {sorted(ALLOWED_SCOPES)}",
        )

    # If certificate_id provided, verify ownership
    if data.certificate_id:
        result = await db.execute(
            select(Certificate).where(Certificate.id == data.certificate_id)
        )
        cert = result.scalar_one_or_none()
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")

        # Non-admins can only bind keys to their own org's certificates
        if current_user.get("role") != "admin":
            org_id = current_user.get("organization_id")
            cert_org = getattr(cert, "organization_id", None)
            cert_applicant = getattr(cert, "applicant_id", None)
            if org_id and cert_org and org_id != cert_org:
                raise HTTPException(status_code=403, detail="Certificate belongs to a different organization")
            elif not org_id and cert_applicant and cert_applicant != user_id:
                raise HTTPException(status_code=403, detail="Certificate belongs to a different user")

    raw_key = generate_api_key()
    key_hash = hash_key(raw_key)
    key_prefix = raw_key[:12]

    api_key = APIKey(
        key_hash=key_hash,
        key_prefix=key_prefix,
        certificate_id=data.certificate_id,
        user_id=user_id,
        name=data.name,
        scope=scope,
        is_active=True,
    )

    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    await write_audit_log(
        db,
        action="api_key_generated",
        resource_type="api_key",
        resource_id=api_key.id if hasattr(api_key, "id") else None,
        user_id=user_id,
        user_email=current_user.get("email", ""),
        details={"key_prefix": key_prefix, "scope": scope},
    )
    await db.commit()

    return {
        "id": api_key.id,
        "key": raw_key,
        "key_prefix": key_prefix,
        "name": data.name,
        "scope": scope,
        "certificate_id": data.certificate_id,
        "message": "Save this key securely. It cannot be retrieved again.",
    }


@router.get("/", summary="List my API keys")
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)

    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == user_id, APIKey.revoked_at == None)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        {
            "id": k.id,
            "key_prefix": k.key_prefix,
            "name": k.name,
            "scope": getattr(k, "scope", "full"),
            "certificate_id": k.certificate_id,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "is_active": k.is_active,
        }
        for k in keys
    ]


@router.delete("/{key_id}", summary="Revoke API key")
async def revoke_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()

    # Use key_prefix (not key_hash slice) in audit log
    await write_audit_log(
        db,
        action="api_key_revoked",
        resource_type="api_key",
        resource_id=api_key.id,
        user_id=user_id,
        user_email=current_user.get("email", ""),
        details={"key_prefix": api_key.key_prefix or "unknown"},
    )
    await db.commit()

    return {"message": "API key revoked"}


async def validate_api_key(key: str, db: AsyncSession) -> Optional[APIKey]:
    """Validate an API key and return the APIKey object if valid."""
    key_hash = hash_key(key)
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True,
            APIKey.revoked_at == None,
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key:
        api_key.last_used_at = datetime.utcnow()
        await db.commit()
    return api_key


@router.post("/admin/provision", summary="Admin: provision API key for user")
async def provision_customer_agent(
    user_id: int,
    certificate_id: int,
    name: str = "ENVELO Agent",
    send_email: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(User).where(User.id == user_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    result = await db.execute(select(Certificate).where(Certificate.id == certificate_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    raw_key = generate_api_key()
    key_hash_val = hash_key(raw_key)
    key_prefix = raw_key[:12]

    api_key = APIKey(
        key_hash=key_hash_val,
        key_prefix=key_prefix,
        certificate_id=certificate_id,
        user_id=user_id,
        name=f"ENVELO Interlock - {cert.system_name}",
        scope="envelo_only",
        is_active=True,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    agent_code = _generate_provisioned_agent(cert, raw_key)

    if send_email and customer.email:
        try:
            from app.services.email_service import send_provisioned_agent_email
            await send_provisioned_agent_email(
                to=customer.email,
                customer_name=getattr(customer, "full_name", None) or customer.email,
                system_name=cert.system_name,
                certificate_number=cert.certificate_number,
                agent_code=agent_code,
            )
        except Exception:
            pass  # Non-fatal

    await write_audit_log(
        db, action="api_key_provisioned", resource_type="api_key",
        resource_id=api_key.id, user_id=int(current_user["sub"]),
        user_email=current_user.get("email", ""),
        details={"key_prefix": key_prefix, "for_user_id": user_id, "certificate_id": certificate_id},
    )
    await db.commit()

    return {
        "success": True,
        "api_key_id": api_key.id,
        "api_key_prefix": key_prefix,
        "certificate_number": cert.certificate_number,
        "customer_email": customer.email,
        "email_sent": send_email,
        "agent_code": agent_code,
    }


def _generate_provisioned_agent(cert, api_key: str) -> str:
    """Generate a fully configured ENVELO agent for a customer."""
    boundaries_code = ""
    if cert.envelope_definition:
        envelope = cert.envelope_definition if isinstance(cert.envelope_definition, dict) else {}
        for b in envelope.get("numeric_boundaries", []):
            boundaries_code += (
                f'        self.add_boundary("{b.get("name", "")}", '
                f'min_val={b.get("min_value", "None")}, '
                f'max_val={b.get("max_value", "None")})\n'
            )

    return f'''#!/usr/bin/env python3
"""
ENVELO AGENT - SENTINEL AUTHORITY
System: {cert.system_name or "Unknown"}
Certificate: {cert.certificate_number}
Organization: {cert.organization_name or "Unknown"}
Generated: {datetime.utcnow().isoformat()}Z

Run with: python envelo_agent.py
"""

import os
import sys
import time
import json
import uuid
import signal
import subprocess
import threading
from datetime import datetime

try:
    import httpx
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "-q"])
    import httpx

API_ENDPOINT = "https://sentinel-authority-production.up.railway.app"
API_KEY = "{api_key}"
CERTIFICATE_NUMBER = "{cert.certificate_number}"
SYSTEM_NAME = "{cert.system_name or 'Unknown'}"


class EnveloAgent:
    def __init__(self):
        self.session_id = None
        self.boundaries = {{}}
        self.stats = {{"pass": 0, "block": 0}}
        self.running = False
        self._load_configured_boundaries()

    def _load_configured_boundaries(self):
{boundaries_code if boundaries_code else "        pass  # Boundaries fetched from server at start()"}

    def add_boundary(self, name, min_val=None, max_val=None, unit=""):
        self.boundaries[name] = {{"min": min_val, "max": max_val, "unit": unit}}

    def start(self):
        print(f"[ENVELO] Starting for {{SYSTEM_NAME}}...")
        self.session_id = uuid.uuid4().hex
        try:
            with httpx.Client(headers={{"Authorization": f"Bearer {{API_KEY}}"}}, timeout=10) as c:
                res = c.get(f"{{API_ENDPOINT}}/api/envelo/boundaries/config")
                if res.is_success:
                    for b in res.json().get("numeric_boundaries", []):
                        self.add_boundary(b["name"], b.get("min_value"), b.get("max_value"), b.get("unit", ""))
                c.post(f"{{API_ENDPOINT}}/api/envelo/sessions", json={{
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "agent_version": "2.0.0",
                }})
        except Exception as e:
            print(f"[ENVELO] Warning: {{e}}")
        self.running = True
        threading.Thread(target=self._heartbeat, daemon=True).start()
        print(f"[ENVELO] Running. {{len(self.boundaries)}} boundaries active.")
        return self

    def _heartbeat(self):
        while self.running:
            time.sleep(60)
            try:
                with httpx.Client(headers={{"Authorization": f"Bearer {{API_KEY}}"}}, timeout=5) as c:
                    c.post(f"{{API_ENDPOINT}}/api/envelo/heartbeat")
            except Exception:
                pass

    def check(self, parameter, value):
        if parameter not in self.boundaries:
            return True
        b = self.boundaries[parameter]
        if b["min"] is not None and value < b["min"]:
            self._block(parameter, value, f"below min {{b['min']}}")
            return False
        if b["max"] is not None and value > b["max"]:
            self._block(parameter, value, f"above max {{b['max']}}")
            return False
        self.stats["pass"] += 1
        return True

    def enforce(self, **params):
        return all(self.check(p, v) for p, v in params.items())

    def _block(self, parameter, value, msg):
        self.stats["block"] += 1
        print(f"[ENVELO] VIOLATION: {{parameter}}={{value}} — {{msg}}")

    def stop(self):
        self.running = False
        print(f"[ENVELO] Stopped. {{self.stats}}")


agent = EnveloAgent()

def _shutdown(sig, frame):
    agent.stop()
    sys.exit(0)

signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)

if __name__ == "__main__":
    agent.start()
    while agent.running:
        time.sleep(1)
'''
