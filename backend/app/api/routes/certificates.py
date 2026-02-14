"""Certificate Registry routes."""
from app.services.audit_service import write_audit_log
from app.services.email_service import notify_certificate_issued
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.models.models import Certificate, CAT72Test, Application, CertificationState, TestState, EnveloSession, APIKey
from app.services.certificate_pdf import generate_certificate_pdf

router = APIRouter()

async def generate_certificate_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(select(func.count(Certificate.id)).where(Certificate.certificate_number.like(f"{settings.CERTIFICATE_PREFIX}-{year}-%")))
    count = (result.scalar() or 0) + 1
    return f"{settings.CERTIFICATE_PREFIX}-{year}-{count:05d}"

@router.post("/issue/{test_id}", summary="Issue certificate for passed test")
async def issue_certificate(test_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    if not test: raise HTTPException(status_code=404, detail="Test not found")
    if test.state != "completed": raise HTTPException(status_code=400, detail="Test must be completed")
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
    
    certificate = Certificate(certificate_number=cert_number, application_id=application.id, organization_name=application.organization_name, system_name=application.system_name, system_version=application.system_version, odd_specification=application.odd_specification, envelope_definition=test.envelope_definition or application.envelope_definition, state="conformant", issued_at=now, expires_at=now + timedelta(days=365), issued_by=int(user["sub"]), test_id=test.id, convergence_score=test.convergence_score, evidence_hash=test.evidence_hash, signature=signature, audit_log_ref=audit_log_ref, verification_url=f"https://sentinelauthority.org/verify.html?cert={cert_number}", history=[{"action": "issued", "timestamp": now.isoformat(), "by": user["email"]}])
    db.add(certificate)
    application.state = "conformant"
    # Promote cat72_test sessions to production for this application
    try:
        from sqlalchemy import update
        key_ids = (await db.execute(select(APIKey.id).where(APIKey.application_id == application.id))).scalars().all()
        if key_ids:
            await db.execute(update(EnveloSession).where(EnveloSession.api_key_id.in_(key_ids)).values(session_type="production", certificate_id=certificate.id))
    except Exception as e:
        print(f"Session promotion note: {e}")
    await db.commit()
    await db.refresh(certificate)
    # Generate and store PDF
    try:
        odd_spec = certificate.odd_specification or {}
        odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
        pdf_bytes = generate_certificate_pdf({
            "certificate_number": certificate.certificate_number,
            "organization_name": certificate.organization_name,
            "system_name": certificate.system_name,
            "system_version": getattr(certificate, "system_version", ""),
            "odd_specification": certificate.odd_specification,
            "issued_at": certificate.issued_at,
            "expires_at": certificate.expires_at,
            "convergence_score": certificate.convergence_score or 0.95,
            "evidence_hash": certificate.evidence_hash or "N/A",
            "signature": certificate.evidence_hash[:16] if certificate.evidence_hash else "N/A",
            "audit_log_ref": test.test_id if test else "N/A",
            "verification_url": f"https://app.sentinelauthority.org/verify?cert={certificate.certificate_number}"
        })
        certificate.certificate_pdf = pdf_bytes
        await db.commit()
        await db.refresh(certificate)
    except Exception as e:
        print(f"[CERT] PDF generation failed for {certificate.certificate_number}: {e}")
    # Send notification email
    await notify_certificate_issued(application.contact_email, certificate.system_name, certificate.certificate_number, certificate.organization_name)
    return {"certificate_number": certificate.certificate_number, "organization_name": certificate.organization_name, "system_name": certificate.system_name, "state": certificate.state, "issued_at": certificate.issued_at.isoformat(), "expires_at": certificate.expires_at.isoformat(), "verification_url": certificate.verification_url}

@router.get("/", summary="List all certificates")
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
    
    return [{"id": c.id, "certificate_number": c.certificate_number, "organization_name": c.organization_name, "system_name": c.system_name, "state": c.state, "issued_at": c.issued_at.isoformat() if c.issued_at else None, "expires_at": c.expires_at.isoformat() if c.expires_at else None, "application_id": c.application_id, "envelope_definition": c.envelope_definition, "applicant_id": getattr(c, "issued_by", None)} for c in result.scalars().all()]

@router.get("/{certificate_number}", summary="Get certificate details")
async def get_certificate(certificate_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    return {"certificate_number": cert.certificate_number, "organization_name": cert.organization_name, "system_name": cert.system_name, "state": cert.state, "issued_at": cert.issued_at.isoformat() if cert.issued_at else None, "expires_at": cert.expires_at.isoformat() if cert.expires_at else None, "convergence_score": cert.convergence_score, "evidence_hash": cert.evidence_hash}

@router.get("/{certificate_number}/pdf", summary="Download certificate PDF")
async def download_pdf(certificate_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.state == "revoked": raise HTTPException(status_code=400, detail="Cannot download revoked certificate")
    test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
    test = test_result.scalar_one_or_none()
    odd_spec = cert.odd_specification or {}
    odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
    pdf_bytes = generate_certificate_pdf({"certificate_number": cert.certificate_number, "organization_name": cert.organization_name, "system_name": cert.system_name, "system_version": cert.system_version if hasattr(cert, "system_version") else "", "odd_specification": cert.odd_specification, "issued_at": cert.issued_at, "expires_at": cert.expires_at, "convergence_score": cert.convergence_score or 0.95, "evidence_hash": cert.evidence_hash or "N/A", "signature": cert.evidence_hash[:16] if cert.evidence_hash else "N/A", "audit_log_ref": test.test_id if test else "N/A", "verification_url": f"https://app.sentinelauthority.org/verify?cert={cert.certificate_number}"})
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=ODDC-{cert.certificate_number}.pdf"})



@router.post("/{certificate_number}/regenerate-pdf", summary="Regenerate certificate PDF")
async def regenerate_pdf(certificate_number: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    """Regenerate PDF for an existing certificate (admin only)"""
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
    test = test_result.scalar_one_or_none()
    odd_spec = cert.odd_specification or {}
    odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
    pdf_bytes = generate_certificate_pdf({
            "certificate_number": cert.certificate_number,
            "organization_name": cert.organization_name,
            "system_name": cert.system_name,
            "system_version": getattr(cert, "system_version", ""),
            "odd_specification": cert.odd_specification,
            "issued_at": cert.issued_at,
            "expires_at": cert.expires_at,
            "convergence_score": cert.convergence_score or 0.95,
            "evidence_hash": cert.evidence_hash or "N/A",
            "signature": cert.evidence_hash[:16] if cert.evidence_hash else "N/A",
            "audit_log_ref": test.test_id if test else "N/A",
            "verification_url": f"https://app.sentinelauthority.org/verify?cert={cert.certificate_number}"
        })
    cert.certificate_pdf = pdf_bytes
    await db.commit()
    return {"message": f"PDF regenerated for {cert.certificate_number}", "size_bytes": len(pdf_bytes)}

@router.post("/regenerate-all-pdfs", summary="Regenerate all certificate PDFs")
async def regenerate_all_pdfs(db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    """Regenerate PDFs for all certificates missing them (admin only)"""
    result = await db.execute(select(Certificate).where(Certificate.certificate_pdf == None))
    certs = result.scalars().all()
    regenerated = 0
    errors = []
    for cert in certs:
        try:
            test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
            test = test_result.scalar_one_or_none()
            odd_spec = cert.odd_specification or {}
            odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
            pdf_bytes = generate_certificate_pdf({
            "certificate_number": cert.certificate_number,
            "organization_name": cert.organization_name,
            "system_name": cert.system_name,
            "system_version": getattr(cert, "system_version", ""),
            "odd_specification": cert.odd_specification,
            "issued_at": cert.issued_at,
            "expires_at": cert.expires_at,
            "convergence_score": cert.convergence_score or 0.95,
            "evidence_hash": cert.evidence_hash or "N/A",
            "signature": cert.evidence_hash[:16] if cert.evidence_hash else "N/A",
            "audit_log_ref": test.test_id if test else "N/A",
            "verification_url": f"https://app.sentinelauthority.org/verify?cert={cert.certificate_number}"
        })
            cert.certificate_pdf = pdf_bytes
            regenerated += 1
        except Exception as e:
            errors.append({"cert": cert.certificate_number, "error": str(e)})
    await db.commit()
    return {"regenerated": regenerated, "errors": errors, "total_missing": len(certs)}

@router.patch("/{certificate_number}/suspend", summary="Suspend certificate")
async def suspend_certificate(certificate_number: str, reason: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    cert.state = "suspended"
    # Tag sessions
    from app.models.models import EnveloSession
    sr = await db.execute(select(EnveloSession).where(EnveloSession.certificate_id == certificate_number, EnveloSession.status == "active"))
    for ss in sr.scalars().all():
        ss.offline_reason = f"Certificate suspended - {reason}"
    cert.history = (cert.history or []) + [{"action": "suspended", "timestamp": datetime.utcnow().isoformat(), "by": user["email"], "reason": reason}]
    await db.commit()
    return {"message": "Certificate suspended", "state": cert.state}


@router.patch("/{certificate_number}/reinstate", summary="Reinstate suspended certificate")
async def reinstate_certificate(certificate_number: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    cert = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = cert.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.state != "suspended": raise HTTPException(status_code=400, detail="Only suspended certificates can be reinstated")
    cert.state = "conformant"
    # Clear offline reason
    from app.models.models import EnveloSession
    sr = await db.execute(select(EnveloSession).where(EnveloSession.certificate_id == certificate_number))
    for ss in sr.scalars().all():
        ss.offline_reason = None
    cert.history = (cert.history or []) + [{"action": "reinstated", "timestamp": datetime.utcnow().isoformat(), "by": user["email"]}]
    await db.commit()
    return {"message": "Certificate reinstated", "state": cert.state}

@router.patch("/{certificate_number}/revoke", summary="Revoke certificate")
async def revoke_certificate(certificate_number: str, reason: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    cert.state = "revoked"
    # Tag sessions
    from app.models.models import EnveloSession
    sr = await db.execute(select(EnveloSession).where(EnveloSession.certificate_id == certificate_number, EnveloSession.status == "active"))
    for ss in sr.scalars().all():
        ss.offline_reason = f"Certificate revoked - {reason}"
    cert.history = (cert.history or []) + [{"action": "revoked", "timestamp": datetime.utcnow().isoformat(), "by": user["email"], "reason": reason}]
    await db.commit()
    return {"message": "Certificate revoked", "state": cert.state}
