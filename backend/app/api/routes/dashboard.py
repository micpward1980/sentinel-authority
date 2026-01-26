"""Dashboard routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Application, CAT72Test, Certificate, CertificationState, TestState

router = APIRouter()


class DashboardStats(BaseModel):
    total_applications: int
    pending_applications: int
    active_tests: int
    certificates_issued: int
    certificates_active: int


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    total_apps = await db.execute(select(func.count(Application.id)))
    pending_apps = await db.execute(
        select(func.count(Application.id)).where(Application.state == CertificationState.PENDING)
    )
    active_tests = await db.execute(
        select(func.count(CAT72Test.id)).where(CAT72Test.state == TestState.RUNNING)
    )
    total_certs = await db.execute(select(func.count(Certificate.id)))
    active_certs = await db.execute(
        select(func.count(Certificate.id)).where(Certificate.state == CertificationState.CONFORMANT)
    )
    
    return {
        "total_applications": total_apps.scalar() or 0,
        "pending_applications": pending_apps.scalar() or 0,
        "active_tests": active_tests.scalar() or 0,
        "certificates_issued": total_certs.scalar() or 0,
        "certificates_active": active_certs.scalar() or 0,
    }


@router.get("/recent-applications")
async def get_recent_applications(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("role") == "applicant":
        result = await db.execute(
            select(Application).where(Application.organization_name == user.get("organization")).order_by(Application.created_at.desc()).limit(10)
        )
    else:
        result = await db.execute(
            select(Application).order_by(Application.created_at.desc()).limit(10)
        )
    return [
        {
            "id": a.id,
            "application_number": a.application_number,
            "organization_name": a.organization_name,
            "system_name": a.system_name,
            "state": a.state.value,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        }
        for a in result.scalars().all()
    ]


@router.get("/active-tests")
async def get_active_tests(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(
        select(CAT72Test).where(CAT72Test.state == TestState.RUNNING).order_by(CAT72Test.started_at.desc())
    )
    tests = result.scalars().all()
    return [
        {
            "id": t.id,
            "test_id": t.test_id,
            "state": t.state.value,
            "elapsed_seconds": t.elapsed_seconds,
            "duration_hours": t.duration_hours,
            "convergence_score": t.convergence_score,
            "interlock_activations": t.interlock_activations,
        }
        for t in tests
    ]


@router.get("/recent-certificates")
async def get_recent_certificates(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("role") == "applicant":
        result = await db.execute(
            select(Certificate).where(Certificate.organization_name == user.get("organization")).order_by(Certificate.issued_at.desc()).limit(10)
        )
    else:
        result = await db.execute(
            select(Certificate).order_by(Certificate.issued_at.desc()).limit(10)
        )
    return [
        {
            "id": c.id,
            "certificate_number": c.certificate_number,
            "organization_name": c.organization_name,
            "system_name": c.system_name,
            "state": c.state.value,
            "issued_at": c.issued_at.isoformat() if c.issued_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        }
        for c in result.scalars().all()
    ]
