"""
API Key Management
"""

import secrets
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.audit_service import write_audit_log
from app.models.models import APIKey, User, Certificate

router = APIRouter()


def generate_api_key():
    """Generate a new API key"""
    random_part = secrets.token_hex(20)
    key = f"sa_live_{random_part}"
    return key


def hash_key(key: str) -> str:
    """Hash an API key for storage"""
    return hashlib.sha256(key.encode()).hexdigest()


class APIKeyCreate(BaseModel):
    name: str
    certificate_id: Optional[int] = None
    scope: Optional[str] = "full"  # full, envelo_only, read_only


@router.post("/generate", summary="Generate new API key")
async def generate_new_key(
    data: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Generate a new API key for the user"""
    
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)
    
    # Generate the key
    raw_key = generate_api_key()
    key_hash = hash_key(raw_key)
    key_prefix = raw_key[:12]
    
    # If certificate_id provided, verify it exists
    if data.certificate_id:
        result = await db.execute(
            select(Certificate).where(Certificate.id == data.certificate_id)
        )
        cert = result.scalar_one_or_none()
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Create the key record
    api_key = APIKey(
        key_hash=key_hash,
        key_prefix=key_prefix,
        certificate_id=data.certificate_id,
        user_id=user_id,
        name=data.name,
        scope=data.scope,
        is_active=True
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    
    await write_audit_log(db, action="api_key_generated", resource_type="api_key",
        resource_id=api_key.id if hasattr(api_key, "id") else None,
        user_id=int(current_user["sub"]), user_email=current_user.get("email", ""),
        details={"key_prefix": raw_key[:12]})
    await db.commit()

    return {
        "id": api_key.id,
        "key": raw_key,
        "key_prefix": key_prefix,
        "name": data.name,
        "certificate_id": data.certificate_id,
        "message": "Save this key securely. It cannot be retrieved again."
    }


@router.get("/", summary="List my API keys")
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all API keys for the current user"""
    
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)
    
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == user_id,
            APIKey.revoked_at == None
        ).order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    
    return [
        {
            "id": k.id,
            "key_prefix": k.key_prefix,
            "name": k.name,
            "certificate_id": k.certificate_id,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "is_active": k.is_active
        }
        for k in keys
    ]


@router.delete("/{key_id}", summary="Revoke API key")
async def revoke_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Revoke an API key"""
    
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid user token")
    user_id = int(sub)
    
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == user_id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()

    await write_audit_log(db, action="api_key_revoked", resource_type="api_key",
        resource_id=api_key.id, user_id=int(current_user["sub"]), user_email=current_user.get("email", ""),
        details={"key_prefix": api_key.key_hash[:12] if api_key.key_hash else "unknown"})
    
    await db.commit()
    
    return {"message": "API key revoked"}


async def validate_api_key(key: str, db: AsyncSession) -> Optional[APIKey]:
    """Validate an API key and return the APIKey object if valid"""
    
    key_hash = hash_key(key)
    
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True,
            APIKey.revoked_at == None
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
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint: Generate API key for a customer and optionally email them the agent"""
    
    # Verify admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the customer user
    result = await db.execute(select(User).where(User.id == user_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get the certificate
    result = await db.execute(select(Certificate).where(Certificate.id == certificate_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Generate API key for the customer
    raw_key = generate_api_key()
    key_hash = hash_key(raw_key)
    key_prefix = raw_key[:12]
    
    api_key = APIKey(
        key_hash=key_hash,
        key_prefix=key_prefix,
        certificate_id=certificate_id,
        user_id=user_id,
        name=f"ENVELO Agent - {cert.system_name}",
        is_active=True
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    # Generate the agent code
    agent_code = generate_provisioned_agent(cert, raw_key)
    
    # Optionally send email to customer
    if send_email and customer.email:
        from app.services.email_service import send_provisioned_agent_email
        await send_provisioned_agent_email(
            to=customer.email,
            customer_name=customer.name or customer.email,
            system_name=cert.system_name,
            certificate_number=cert.certificate_number,
            agent_code=agent_code
        )
    
    return {
        "success": True,
        "api_key_id": api_key.id,
        "api_key_prefix": key_prefix,
        "certificate_number": cert.certificate_number,
        "customer_email": customer.email,
        "email_sent": send_email,
        "agent_code": agent_code  # Also return so admin can download directly
    }


def generate_provisioned_agent(cert, api_key: str) -> str:
    """Generate a fully configured ENVELO agent for a customer"""
    
    boundaries_code = ""
    if cert.envelope_definition:
        envelope = cert.envelope_definition if isinstance(cert.envelope_definition, dict) else {}
        for b in envelope.get("numeric_boundaries", []):
            boundaries_code += f'        self.add_boundary("{b.get("name", "")}", min_val={b.get("min_value", "None")}, max_val={b.get("max_value", "None")})\n'
        for b in envelope.get("rate_boundaries", []):
            boundaries_code += f'        self.add_rate_boundary("{b.get("name", "")}", max_per_second={b.get("max_per_second", "None")})\n'
    
    return f'''#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                         ENVELO AGENT - SENTINEL AUTHORITY                    ║
║                                                                              ║
║  System: {cert.system_name or "Unknown":<59} ║
║  Certificate: {cert.certificate_number:<54} ║
║  Organization: {cert.organization_name or "Unknown":<53} ║
║                                                                              ║
║  THIS AGENT IS PRE-CONFIGURED. JUST RUN IT.                                  ║
║  python envelo_agent.py                                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generated: {datetime.utcnow().isoformat()}Z
"""

import os
import sys
import time
import json
import uuid
import signal
import threading
from app.services.agent_generator import generate_provisioned_agent
from datetime import datetime

try:
    import requests
except ImportError:
    print("Installing required package: requests")
    os.system("pip install requests")
    import requests

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION - DO NOT MODIFY
# ═══════════════════════════════════════════════════════════════════════════════
API_ENDPOINT = "https://sentinel-authority-production.up.railway.app"
API_KEY = "{api_key}"
CERTIFICATE_NUMBER = "{cert.certificate_number}"
SYSTEM_NAME = "{cert.system_name or 'Unknown'}"
ORGANIZATION = "{cert.organization_name or 'Unknown'}"

# ═══════════════════════════════════════════════════════════════════════════════
# ENVELO AGENT
# ═══════════════════════════════════════════════════════════════════════════════

class EnveloAgent:
    def __init__(self):
        self.session_id = None
        self.boundaries = {{}}
        self.rate_limits = {{}}
        self.stats = {{"pass": 0, "block": 0}}
        self.running = False
        self._heartbeat_thread = None
        self._load_configured_boundaries()
    
    def _load_configured_boundaries(self):
        """Load pre-configured boundaries from Sentinel Authority"""
{boundaries_code if boundaries_code else '        pass  # Boundaries will be fetched from server'}
    
    def add_boundary(self, name, min_val=None, max_val=None, unit=""):
        self.boundaries[name] = {{"min": min_val, "max": max_val, "unit": unit}}
    
    def add_rate_boundary(self, name, max_per_second=None, max_per_minute=None):
        self.rate_limits[name] = {{"max_per_second": max_per_second, "max_per_minute": max_per_minute, "calls": []}}
    
    def start(self):
        """Start the ENVELO agent session"""
        print(f"[ENVELO] Starting agent for {{SYSTEM_NAME}}...")
        
        # Fetch latest boundaries from server
        try:
            res = requests.get(
                f"{{API_ENDPOINT}}/api/envelo/boundaries/config",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                timeout=10
            )
            if res.ok:
                config = res.json()
                for b in config.get("numeric_boundaries", []):
                    self.add_boundary(b["name"], b.get("min_value"), b.get("max_value"), b.get("unit", ""))
                for b in config.get("rate_boundaries", []):
                    self.add_rate_boundary(b["name"], b.get("max_per_second"))
                print(f"[ENVELO] Loaded {{len(self.boundaries)}} numeric + {{len(self.rate_limits)}} rate boundaries")
        except Exception as e:
            print(f"[ENVELO] Warning: Could not fetch boundaries from server: {{e}}")
        
        # Start session
        self.session_id = str(uuid.uuid4())
        try:
            res = requests.post(
                f"{{API_ENDPOINT}}/api/envelo/sessions",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "agent_version": "2.0.0",
                    "boundaries": list(self.boundaries.values())
                }},
                timeout=10
            )
            if res.ok:
                print(f"[ENVELO] Session started: {{self.session_id[:16]}}...")
                self.running = True
                self._start_heartbeat()
                return True
            else:
                print(f"[ENVELO] Failed to start session: {{res.text}}")
        except Exception as e:
            print(f"[ENVELO] Connection error: {{e}}")
        return False
    
    def _start_heartbeat(self):
        """Start background heartbeat thread"""
        def heartbeat_loop():
            while self.running:
                try:
                    requests.post(
                        f"{{API_ENDPOINT}}/api/envelo/heartbeat",
                        headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                        timeout=5
                    )
                except Exception:
                    pass
                time.sleep(60)
        
        self._heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()
    
    def check(self, parameter, value):
        """Check if a value is within boundaries. Returns True if allowed, False if blocked."""
        if parameter not in self.boundaries:
            return True
        
        b = self.boundaries[parameter]
        violation = None
        
        if b["min"] is not None and value < b["min"]:
            violation = f"{{parameter}}={{value}} below minimum {{b['min']}}"
        elif b["max"] is not None and value > b["max"]:
            violation = f"{{parameter}}={{value}} above maximum {{b['max']}}"
        
        if violation:
            self._report_violation(parameter, value, violation)
            return False
        
        self.stats["pass"] += 1
        return True
    
    def enforce(self, **params):
        """Check multiple parameters at once. Returns True only if ALL pass."""
        for param, value in params.items():
            if not self.check(param, value):
                return False
        return True
    
    def _report_violation(self, parameter, value, message):
        """Report a violation to Sentinel Authority"""
        self.stats["block"] += 1
        print(f"[ENVELO] ⛔ VIOLATION: {{message}}")
        
        try:
            requests.post(
                f"{{API_ENDPOINT}}/api/envelo/telemetry",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "records": [{{
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "action_type": "boundary_check",
                        "result": "BLOCK",
                        "parameters": {{parameter: value}},
                        "boundary_evaluations": [{{"boundary": parameter, "passed": False, "message": message}}]
                    }}],
                    "stats": {{"block_count": 1}}
                }},
                timeout=5
            )
        except Exception:
            pass
    
    def report_action(self, action_type, parameters, result="PASS"):
        """Report a successful action to telemetry"""
        try:
            requests.post(
                f"{{API_ENDPOINT}}/api/envelo/telemetry",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "records": [{{
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "action_type": action_type,
                        "result": result,
                        "parameters": parameters,
                        "boundary_evaluations": []
                    }}],
                    "stats": {{"pass_count": 1 if result == "PASS" else 0}}
                }},
                timeout=5
            )
        except Exception:
            pass
    
    def stop(self):
        """Stop the ENVELO agent session"""
        self.running = False
        print(f"[ENVELO] Stopping agent...")
        print(f"[ENVELO] Session stats: {{self.stats['pass']}} passed, {{self.stats['block']}} blocked")
        
        try:
            requests.post(
                f"{{API_ENDPOINT}}/api/envelo/sessions/{{self.session_id}}/end",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{
                    "ended_at": datetime.utcnow().isoformat() + "Z",
                    "final_stats": self.stats
                }},
                timeout=10
            )
            print("[ENVELO] Session ended successfully")
        except Exception as e:
            print(f"[ENVELO] Warning: Could not end session cleanly: {{e}}")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN - Run this agent
# ═══════════════════════════════════════════════════════════════════════════════

agent = EnveloAgent()

def signal_handler(sig, frame):
    print("\\n[ENVELO] Shutdown signal received...")
    agent.stop()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    print()
    print("=" * 70)
    print("  ENVELO Agent - Sentinel Authority")
    print(f"  System: {{SYSTEM_NAME}}")
    print(f"  Organization: {{ORGANIZATION}}")
    print(f"  Certificate: {{CERTIFICATE_NUMBER}}")
    print("=" * 70)
    print()
    
    if agent.start():
        print()
        print("[ENVELO] ✓ Agent is running. Press Ctrl+C to stop.")
        print()
        print("Usage in your code:")
        print("  from envelo_agent import agent")
        print("  ")
        print("  # Check before action")
        print("  if agent.check('speed', current_speed):")
        print("      execute_movement()")
        print("  ")
        print("  # Or check multiple parameters")
        print("  if agent.enforce(speed=50, temperature=25):")
        print("      execute_action()")
        print()
        
        # Keep running for CAT-72 testing
        while agent.running:
            time.sleep(1)
    else:
        print("[ENVELO] ✗ Failed to start agent. Check your connection and credentials.")
        sys.exit(1)
'''
