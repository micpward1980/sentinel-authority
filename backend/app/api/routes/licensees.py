"""Licensee Portal routes - For ENVELO implementers."""

import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import Licensee, User, UserRole

router = APIRouter()


class LicenseeCreate(BaseModel):
    organization_name: str
    contact_name: str
    contact_email: EmailStr
    license_type: str = "implementer"  # implementer, integrator, reseller


async def generate_license_number(db: AsyncSession) -> str:
    """Generate unique license number."""
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(Licensee.id)).where(Licensee.license_number.like(f"LIC-{year}-%"))
    )
    count = (result.scalar() or 0) + 1
    return f"LIC-{year}-{count:05d}"


@router.post("/")
async def create_licensee(
    data: LicenseeCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Create a new licensee (admin only)."""
    license_number = await generate_license_number(db)
    api_key = f"env_{secrets.token_urlsafe(32)}"
    
    licensee = Licensee(
        license_number=license_number,
        organization_name=data.organization_name,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        license_type=data.license_type,
        licensed_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=365),
        is_active=True,
        api_key=api_key,
    )
    
    db.add(licensee)
    await db.commit()
    await db.refresh(licensee)
    
    return {
        "license_number": licensee.license_number,
        "organization_name": licensee.organization_name,
        "license_type": licensee.license_type,
        "licensed_at": licensee.licensed_at.isoformat(),
        "expires_at": licensee.expires_at.isoformat(),
        "api_key": api_key,  # Only shown once at creation
        "message": "Licensee created. Save the API key - it will not be shown again."
    }


@router.get("/")
async def list_licensees(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """List all licensees (admin only)."""
    result = await db.execute(select(Licensee).order_by(Licensee.licensed_at.desc()))
    licensees = result.scalars().all()
    
    return [
        {
            "id": l.id,
            "license_number": l.license_number,
            "organization_name": l.organization_name,
            "contact_name": l.contact_name,
            "contact_email": l.contact_email,
            "license_type": l.license_type,
            "licensed_at": l.licensed_at.isoformat() if l.licensed_at else None,
            "expires_at": l.expires_at.isoformat() if l.expires_at else None,
            "is_active": l.is_active,
        }
        for l in licensees
    ]


@router.get("/me")
async def get_my_license(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get current user's licensee info."""
    result = await db.execute(
        select(Licensee).where(Licensee.user_id == int(user["sub"]))
    )
    licensee = result.scalar_one_or_none()
    
    if not licensee:
        raise HTTPException(status_code=404, detail="No license found for this user")
    
    return {
        "license_number": licensee.license_number,
        "organization_name": licensee.organization_name,
        "license_type": licensee.license_type,
        "licensed_at": licensee.licensed_at.isoformat() if licensee.licensed_at else None,
        "expires_at": licensee.expires_at.isoformat() if licensee.expires_at else None,
        "is_active": licensee.is_active,
    }


@router.get("/docs")
async def get_documentation(
    user: dict = Depends(get_current_user)
):
    """Get ENVELO technical documentation (licensees only)."""
    if user.get("role") not in ["admin", "licensee"]:
        raise HTTPException(status_code=403, detail="Licensee access required")
    
    return {
        "title": "ENVELO Implementation Guide",
        "version": "1.0",
        "sections": [
            {
                "name": "Architecture Overview",
                "description": "Non-bypassable interlock architecture",
                "url": "/docs/architecture"
            },
            {
                "name": "Envelope Definition",
                "description": "How to define operational boundaries",
                "url": "/docs/envelope"
            },
            {
                "name": "Integration API",
                "description": "Runtime API for ENVELO enforcement",
                "url": "/docs/api"
            },
            {
                "name": "Certification Requirements",
                "description": "What you need for ODDC certification",
                "url": "/docs/certification"
            },
        ],
        "support": "licensee-support@sentinelauthority.org"
    }


@router.patch("/{license_number}/deactivate")
async def deactivate_licensee(
    license_number: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Deactivate a licensee."""
    result = await db.execute(
        select(Licensee).where(Licensee.license_number == license_number)
    )
    licensee = result.scalar_one_or_none()
    
    if not licensee:
        raise HTTPException(status_code=404, detail="Licensee not found")
    
    licensee.is_active = False
    await db.commit()
    
    return {"message": "Licensee deactivated", "license_number": license_number}


@router.post("/{license_number}/rotate-key")
async def rotate_api_key(
    license_number: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"]))
):
    """Rotate a licensee's API key."""
    result = await db.execute(
        select(Licensee).where(Licensee.license_number == license_number)
    )
    licensee = result.scalar_one_or_none()
    
    if not licensee:
        raise HTTPException(status_code=404, detail="Licensee not found")
    
    new_key = f"env_{secrets.token_urlsafe(32)}"
    licensee.api_key = new_key
    await db.commit()
    
    return {
        "message": "API key rotated",
        "license_number": license_number,
        "new_api_key": new_key,
        "warning": "Save this key - it will not be shown again"
    }
