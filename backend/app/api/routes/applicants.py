"""Applicant Portal routes."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Application, User, CertificationState
from app.services.email_service import notify_admin_new_application

router = APIRouter()


class ApplicationCreate(BaseModel):
    organization_name: str
    contact_name: Optional[str] = None
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    system_name: str
    system_description: str
    system_version: Optional[str] = None
    manufacturer: Optional[str] = None
    odd_specification: Optional[Any] = None
    envelope_definition: Optional[Dict[str, Any]] = None
    preferred_test_date: Optional[datetime] = None
    facility_location: Optional[str] = None
    notes: Optional[str] = None


async def generate_application_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(Application.id)).where(
            Application.application_number.like(f"APP-{year}-%")
        )
    )
    count = (result.scalar() or 0) + 1
    return f"APP-{year}-{count:05d}"


@router.post("/")
async def create_application(
    app_data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    app_number = await generate_application_number(db)
    
    # Handle odd_specification - convert string to dict if needed
    odd_spec = app_data.odd_specification
    if isinstance(odd_spec, str):
        odd_spec = {"description": odd_spec}
    elif odd_spec is None:
        odd_spec = {}
    
    application = Application(
        application_number=app_number,
        applicant_id=int(user["sub"]),
        organization_name=app_data.organization_name,
        contact_name=app_data.contact_name or user.get("full_name", ""),
        contact_email=app_data.contact_email,
        contact_phone=app_data.contact_phone,
        system_name=app_data.system_name,
        system_description=app_data.system_description,
        system_version=app_data.system_version or "1.0",
        manufacturer=app_data.manufacturer or app_data.organization_name,
        odd_specification=odd_spec,
        envelope_definition=app_data.envelope_definition or {},
        preferred_test_date=app_data.preferred_test_date,
        facility_location=app_data.facility_location,
        notes=app_data.notes,
        state=CertificationState.PENDING,
        submitted_at=datetime.utcnow(),
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    notify_admin_new_application(
        app_data.organization_name,
        app_data.system_name,
        app_data.contact_email
    )
    
    return {
        "id": application.id,
        "application_number": application.application_number,
        "state": application.state.value,
        "submitted_at": application.submitted_at.isoformat() + "Z",
        "message": "Application submitted successfully"
    }


@router.get("/")
async def list_applications(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    if user.get("role") in ["admin", "operator"]:
        result = await db.execute(select(Application).order_by(Application.created_at.desc()))
    else:
        result = await db.execute(
            select(Application)
            .where(Application.applicant_id == int(user["sub"]))
            .order_by(Application.created_at.desc())
        )
    
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "application_number": a.application_number,
            "organization_name": a.organization_name,
            "system_name": a.system_name,
            "system_version": a.system_version,
            "state": a.state.value,
            "submitted_at": a.submitted_at.isoformat() + "Z" if a.submitted_at else None,
        }
        for a in apps
    ]


@router.get("/{application_id}")
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if user.get("role") not in ["admin", "operator"] and app.applicant_id != int(user["sub"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": app.id,
        "application_number": app.application_number,
        "organization_name": app.organization_name,
        "contact_name": app.contact_name,
        "contact_email": app.contact_email,
        "contact_phone": app.contact_phone,
        "system_name": app.system_name,
        "system_description": app.system_description,
        "system_version": app.system_version,
        "manufacturer": app.manufacturer,
        "odd_specification": app.odd_specification,
        "envelope_definition": app.envelope_definition,
        "state": app.state.value,
        "submitted_at": app.submitted_at.isoformat() + "Z" if app.submitted_at else None,
        "preferred_test_date": app.preferred_test_date.isoformat() + "Z" if app.preferred_test_date else None,
        "facility_location": app.facility_location,
        "notes": app.notes,
    }


@router.patch("/{application_id}/state")
async def update_application_state(
    application_id: int,
    new_state: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    if user.get("role") not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Only operators can update state")
    
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    try:
        app.state = CertificationState(new_state)
        app.reviewed_at = datetime.utcnow()
        await db.commit()
        return {"message": f"State updated to {new_state}", "state": new_state}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {new_state}")
