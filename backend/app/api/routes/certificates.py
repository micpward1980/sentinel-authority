"""Certificate Registry routes."""
from app.services.email_service import notify_certificate_issued
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.models.models import Certificate, CAT72Test, Application, CertificationState, TestState
from app.services.certificate_pdf import generate_certificate_pdf

router = APIRouter()

async def generate_certificate_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(select(func.count(Certificate.id)).where(Certificate.certificate_number.like(f"{settings.CERTIFICATE_PREFIX}-{year}-%")))
    count = (result.scalar() or 0) + 1
    return f"{settings.CERTIFICATE_PREFIX}-{year}-{count:05d}"

@router.post("/issue/{test_id}")
async def issue_certificate(test_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    if not test: raise HTTPException(status_code=404, detail="Test not found")
    if test.state != TestState.COMPLETED: raise HTTPException(status_code=400, detail="Test must be completed")
    if test.result != "PASS": raise HTTPException(status_code=400, detail="Cannot issue certificate for failed test")
    app_result = await db.execute(select(Application).where(Application.id == test.application_id))
    application = app_result.scalar_one_or_none()
    if not application: raise HTTPException(status_code=404, detail="Application not found")
    existing = await db.execute(select(Certificate).where(Certificate.application_id == application.id))
    if existing.scalar_one_or_none(): raise HTTPException(status_code=400, detail="Certificate already issued")
    cert_number = await generate_certificate_number(db)
    now = datetime.utcnow()
    # Generate signature and audit log reference
    sig_count = await db.execute(select(func.count(Certificate.id)))
    sig_num = (sig_count.scalar() or 0) + 1
    signature = f"SA-SIG-{sig_num}"
    audit_log_ref = f"SA-LOG-{now.year}-{sig_num:04d}"
    
    certificate = Certificate(certificate_number=cert_number, application_id=application.id, organization_name=application.organization_name, system_name=application.system_name, system_version=application.system_version, odd_specification=application.odd_specification, envelope_definition=application.envelope_definition, state=CertificationState.CONFORMANT, issued_at=now, expires_at=now + timedelta(days=365), issued_by=int(user["sub"]), test_id=test.id, convergence_score=test.convergence_score, evidence_hash=test.evidence_hash, signature=signature, audit_log_ref=audit_log_ref, verification_url=f"https://sentinelauthority.org/verify.html?cert={cert_number}", history=[{"action": "issued", "timestamp": now.isoformat(), "by": user["email"]}])
    db.add(certificate)
    application.state = CertificationState.CONFORMANT
    await db.commit()
    await db.refresh(certificate)
    # Send notification email
    await notify_certificate_issued(application.contact_email, certificate.system_name, certificate.certificate_number, certificate.organization_name)
    return {"certificate_number": certificate.certificate_number, "organization_name": certificate.organization_name, "system_name": certificate.system_name, "state": certificate.state.value, "issued_at": certificate.issued_at.isoformat(), "expires_at": certificate.expires_at.isoformat(), "verification_url": certificate.verification_url}

@router.get("/")
async def list_certificates(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    # Admins see all, applicants see only their organization's certificates
    if user.get("role") in ["admin", "operator"]:
        result = await db.execute(select(Certificate).order_by(Certificate.issued_at.desc()))
    else:
        # Get user's applications to find their organization
        app_result = await db.execute(
            select(Application).where(Application.applicant_id == int(user["sub"]))
        )
        user_apps = app_result.scalars().all()
        app_ids = [a.id for a in user_apps]
        
        if app_ids:
            result = await db.execute(
                select(Certificate)
                .where(Certificate.application_id.in_(app_ids))
                .order_by(Certificate.issued_at.desc())
            )
        else:
            return []
    
    return [{"id": c.id, "certificate_number": c.certificate_number, "organization_name": c.organization_name, "system_name": c.system_name, "state": c.state.value, "issued_at": c.issued_at.isoformat() if c.issued_at else None, "expires_at": c.expires_at.isoformat() if c.expires_at else None} for c in result.scalars().all()]

@router.get("/{certificate_number}")
async def get_certificate(certificate_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    return {"certificate_number": cert.certificate_number, "organization_name": cert.organization_name, "system_name": cert.system_name, "state": cert.state.value, "issued_at": cert.issued_at.isoformat() if cert.issued_at else None, "expires_at": cert.expires_at.isoformat() if cert.expires_at else None, "convergence_score": cert.convergence_score, "evidence_hash": cert.evidence_hash}

@router.get("/{certificate_number}/pdf")
async def download_pdf(certificate_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.state == CertificationState.REVOKED: raise HTTPException(status_code=400, detail="Cannot download revoked certificate")
    test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
    test = test_result.scalar_one_or_none()
    odd_spec = cert.odd_specification or {}
    odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
    pdf_bytes = generate_certificate_pdf(cert.certificate_number, cert.organization_name, cert.system_name, odd_string, cert.issued_at, cert.expires_at, test.test_id if test else "N/A", cert.convergence_score or 0.95, test.stability_index if test else 0.95, test.drift_rate if test else 0.01, cert.evidence_hash or "N/A")
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=ODDC-{cert.certificate_number}.pdf"})

@router.patch("/{certificate_number}/suspend")
async def suspend_certificate(certificate_number: str, reason: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    cert.state = CertificationState.SUSPENDED
    cert.history = (cert.history or []) + [{"action": "suspended", "timestamp": datetime.utcnow().isoformat(), "by": user["email"], "reason": reason}]
    await db.commit()
    return {"message": "Certificate suspended", "state": cert.state.value}

@router.patch("/{certificate_number}/revoke")
async def revoke_certificate(certificate_number: str, reason: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    cert.state = CertificationState.REVOKED
    cert.history = (cert.history or []) + [{"action": "revoked", "timestamp": datetime.utcnow().isoformat(), "by": user["email"], "reason": reason}]
    await db.commit()
    return {"message": "Certificate revoked", "state": cert.state.value}

@router.patch("/{certificate_number}/reinstate")
async def reinstate_certificate(certificate_number: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.state != CertificationState.SUSPENDED: raise HTTPException(status_code=400, detail="Only suspended certificates can be reinstated")
    cert.state = CertificationState.CONFORMANT
    cert.history = (cert.history or []) + [{"action": "reinstated", "timestamp": datetime.utcnow().isoformat(), "by": user["email"]}]
    await db.commit()
    return {"message": "Certificate reinstated", "state": cert.state.value}
