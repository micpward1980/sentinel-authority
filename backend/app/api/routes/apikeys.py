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


@router.post("/generate")
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
        is_active=True
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return {
        "id": api_key.id,
        "key": raw_key,
        "key_prefix": key_prefix,
        "name": data.name,
        "certificate_id": data.certificate_id,
        "message": "Save this key securely. It cannot be retrieved again."
    }


@router.get("/")
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


@router.delete("/{key_id}")
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
