"""Dashboard routes."""

from datetime import datetime
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


@router.get("/stats", summary="Dashboard statistics")
async def get_stats(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("role") == "applicant":
        org = user.get("organization")
        total_apps = await db.execute(select(func.count(Application.id)).where(Application.organization_name == org))
        pending_apps = await db.execute(select(func.count(Application.id)).where(Application.state == "pending", Application.organization_name == org))
        active_tests = await db.execute(select(func.count(CAT72Test.id)).where(CAT72Test.state == "running"))
        total_certs = await db.execute(select(func.count(Certificate.id)).where(Certificate.organization_name == org))
        active_certs = await db.execute(select(func.count(Certificate.id)).where(Certificate.state == "conformant", Certificate.organization_name == org))
    else:
        total_apps = await db.execute(select(func.count(Application.id)))
        pending_apps = await db.execute(select(func.count(Application.id)).where(Application.state == "pending"))
        active_tests = await db.execute(select(func.count(CAT72Test.id)).where(CAT72Test.state == "running"))
        total_certs = await db.execute(select(func.count(Certificate.id)))
        active_certs = await db.execute(select(func.count(Certificate.id)).where(Certificate.state == "conformant"))
    
    return {
        "total_applications": total_apps.scalar() or 0,
        "pending_applications": pending_apps.scalar() or 0,
        "active_tests": active_tests.scalar() or 0,
        "certificates_issued": total_certs.scalar() or 0,
        "certificates_active": active_certs.scalar() or 0,
    }


@router.get("/recent-applications", summary="Recent applications list")
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
            "state": a.state,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        }
        for a in result.scalars().all()
    ]


@router.get("/active-tests", summary="Currently running CAT-72 tests")
async def get_active_tests(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    q = select(CAT72Test, Application).join(Application, CAT72Test.application_id == Application.id).where(CAT72Test.state == "running")
    if user.get("role") == "applicant":
        q = q.where(Application.organization_name == user.get("organization"))
    result = await db.execute(q.order_by(CAT72Test.started_at.desc()))
    rows = result.all()
    return [
        {
            "id": t.id,
            "test_id": t.test_id,
            "organization_name": a.organization_name if hasattr(a, "organization_name") else "",
            "system_name": a.system_name if hasattr(a, "system_name") else "",
            "state": t.state,
            "elapsed_seconds": t.elapsed_seconds,
            "duration_hours": t.duration_hours,
            "convergence_score": t.convergence_score,
            "interlock_activations": t.interlock_activations,
        }
        for t, a in rows
    ]


@router.get("/recent-certificates", summary="Recently issued certificates")
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
            "state": c.state,
            "issued_at": c.issued_at.isoformat() if c.issued_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        }
        for c in result.scalars().all()
    ]


@router.get("/pipeline", summary="Application pipeline by state")
async def get_pipeline(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    states = [s.value for s in CertificationState]
    pipeline = {}
    for state in states:
        q = select(func.count(Application.id)).where(Application.state == state)
        if user.get("role") == "applicant":
            q = q.where(Application.organization_name == user.get("organization"))
        result = await db.execute(q)
        pipeline[state] = result.scalar() or 0
    return {"pipeline": pipeline}


@router.get("/approval-rates", summary="Monthly approval rates")
async def get_approval_rates(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    from datetime import timedelta
    months = []
    now = datetime.utcnow()
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0)
        if i > 0:
            month_end = (now.replace(day=1) - timedelta(days=30*(i-1))).replace(day=1, hour=0, minute=0, second=0)
        else:
            month_end = now
        issued = await db.execute(
            select(func.count(Certificate.id)).where(Certificate.issued_at >= month_start, Certificate.issued_at < month_end)
        )
        apps = await db.execute(
            select(func.count(Application.id)).where(Application.submitted_at >= month_start, Application.submitted_at < month_end)
        )
        months.append({"month": month_start.strftime("%b %Y"), "certificates_issued": issued.scalar() or 0, "applications_submitted": apps.scalar() or 0})
    return {"months": months}


@router.get("/state-distribution", summary="Certificate state distribution")
async def get_state_distribution(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    states = [s.value for s in CertificationState]
    dist = {}
    for state in states:
        q = select(func.count(Certificate.id)).where(Certificate.state == state)
        if user.get("role") == "applicant":
            q = q.where(Certificate.organization_name == user.get("organization"))
        result = await db.execute(q)
        count = result.scalar() or 0
        if count > 0:
            dist[state] = count
    return {"distribution": dist}
