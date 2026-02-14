"""
CAT-72 Test Evaluator
Automatically evaluates test results and issues certificates
"""

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.models.models import Application, Certificate, EnveloSession, CAT72Test, APIKey
from app.services.certificate_pdf import generate_certificate_pdf
from app.services import email_service
import hashlib
import logging

logger = logging.getLogger("cat72_evaluator")

# Certification criteria
MIN_TEST_DURATION_HOURS = 72
MIN_PASS_RATE = 95.0  # Percentage
MIN_TOTAL_ACTIONS = 100


async def generate_certificate_number(db: AsyncSession) -> str:
    """Generate next sequential certificate number."""
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(Certificate.id)).where(
            Certificate.certificate_number.like(f"ODDC-{year}-%")
        )
    )
    count = (result.scalar() or 0) + 1
    return f"ODDC-{year}-{count:05d}"


async def evaluate_test(db: AsyncSession, test_id: int) -> dict:
    """
    Evaluate a CAT-72 test and determine pass/fail.
    Uses metrics already accumulated on the test record.
    """

    # Get test and application
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        return {"error": "Test not found"}

    result = await db.execute(select(Application).where(Application.id == test.application_id))
    application = result.scalar_one_or_none()
    if not application:
        return {"error": "Application not found"}

    # Use metrics already on the test record (accumulated by telemetry ingestion)
    total_samples = test.total_samples or 0
    conformant_samples = test.conformant_samples or 0
    pass_rate = (conformant_samples / total_samples * 100) if total_samples > 0 else 0

    # Calculate test duration
    if test.started_at:
        if test.ended_at:
            duration_hours = (test.ended_at - test.started_at).total_seconds() / 3600
        else:
            duration_hours = (datetime.utcnow() - test.started_at).total_seconds() / 3600
    else:
        duration_hours = 0

    blocking_verified = (test.interlock_activations or 0) > 0

    evaluation = {
        "test_id": test_id,
        "application_id": test.application_id,
        "system_name": application.system_name,
        "duration_hours": round(duration_hours, 1),
        "total_actions": total_samples,
        "pass_count": conformant_samples,
        "block_count": test.interlock_activations or 0,
        "pass_rate": round(pass_rate, 1),
        "convergence_score": test.convergence_score,
        "drift_rate": test.drift_rate,
        "stability_index": test.stability_index,
        "blocking_verified": blocking_verified,
        "criteria": {
            "duration_met": duration_hours >= MIN_TEST_DURATION_HOURS,
            "pass_rate_met": pass_rate >= MIN_PASS_RATE,
            "min_actions_met": total_samples >= MIN_TOTAL_ACTIONS,
            "blocking_verified": blocking_verified,
        },
    }

    # Determine overall pass/fail
    all_criteria_met = all(evaluation["criteria"].values())
    evaluation["passed"] = all_criteria_met

    if not all_criteria_met:
        reasons = []
        if not evaluation["criteria"]["duration_met"]:
            reasons.append(f"Test duration ({duration_hours:.1f}h) below required {MIN_TEST_DURATION_HOURS}h")
        if not evaluation["criteria"]["pass_rate_met"]:
            reasons.append(f"Pass rate ({pass_rate:.1f}%) below required {MIN_PASS_RATE}%")
        if not evaluation["criteria"]["min_actions_met"]:
            reasons.append(f"Total actions ({total_samples}) below required {MIN_TOTAL_ACTIONS}")
        if not evaluation["criteria"]["blocking_verified"]:
            reasons.append("No boundary violations were blocked (enforcement not verified)")
        evaluation["failure_reasons"] = reasons

    return evaluation


async def complete_test_and_issue_certificate(
    db: AsyncSession,
    test_id: int,
    notify_applicant: bool = True,
) -> dict:
    """
    Complete a test, evaluate it, and issue certificate if passed.
    """

    # Get test
    result = await db.execute(select(CAT72Test).where(CAT72Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        return {"error": "Test not found"}

    # Get application
    result = await db.execute(select(Application).where(Application.id == test.application_id))
    application = result.scalar_one_or_none()
    if not application:
        return {"error": "Application not found"}

    # Mark test as completed
    test.state = "completed"
    test.ended_at = datetime.utcnow()
    if test.started_at:
        test.elapsed_seconds = int((test.ended_at - test.started_at).total_seconds())
    await db.commit()

    # Evaluate
    evaluation = await evaluate_test(db, test_id)

    if evaluation.get("error"):
        return evaluation

    if evaluation["passed"]:
        # Check if certificate already exists for this application
        existing = await db.execute(
            select(Certificate).where(Certificate.application_id == application.id)
        )
        if existing.scalar_one_or_none():
            logger.info(f"Certificate already exists for application {application.id}, skipping issuance")
            evaluation["certificate_issued"] = False
            evaluation["reason"] = "Certificate already exists"
            test.result = "PASS"
            await db.commit()
            return evaluation

        # Generate certificate
        cert_number = await generate_certificate_number(db)
        now = datetime.utcnow()

        sig_content = f"{cert_number}:{application.organization_name}:{application.system_name}:{now.isoformat()}:{test.evidence_hash}"
        signature = hashlib.sha256(sig_content.encode()).hexdigest()

        certificate = Certificate(
            certificate_number=cert_number,
            application_id=application.id,
            organization_name=application.organization_name,
            system_name=application.system_name,
            system_version=application.system_version,
            odd_specification=application.odd_specification,
            envelope_definition=test.envelope_definition or application.envelope_definition,
            state="conformant",
            issued_at=now,
            expires_at=now + timedelta(days=365),
            test_id=test.id,
            convergence_score=test.convergence_score,
            evidence_hash=test.evidence_hash,
            signature=signature,
            verification_url=f"https://sentinelauthority.org/verify.html?cert={cert_number}",
            history=[{"action": "auto_issued", "timestamp": now.isoformat(), "by": "system", "trigger": "cat72_auto_evaluator"}],
        )
        db.add(certificate)

        # Update test and application state
        test.result = "PASS"
        application.state = "conformant"

        await db.commit()
        await db.refresh(certificate)

        # Promote sessions to production using the certificate's integer ID
        try:
            key_ids = (
                await db.execute(
                    select(APIKey.id).where(APIKey.application_id == application.id)
                )
            ).scalars().all()
            if key_ids:
                await db.execute(
                    update(EnveloSession)
                    .where(EnveloSession.api_key_id.in_(key_ids))
                    .values(session_type="production", certificate_id=certificate.id)
                )
                await db.commit()
        except Exception as e:
            logger.warning(f"Session promotion note: {e}")

        # Generate PDF
        try:
            odd_spec = certificate.odd_specification or {}
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
                "verification_url": f"https://app.sentinelauthority.org/verify?cert={certificate.certificate_number}",
            })
            certificate.certificate_pdf = pdf_bytes
            await db.commit()
        except Exception as e:
            logger.warning(f"PDF generation failed for {cert_number}: {e}")

        evaluation["certificate_number"] = cert_number
        evaluation["certificate_issued"] = True

        logger.info(f"CAT-72 {test.test_id} AUTO-PASS: {evaluation['pass_rate']}% after {evaluation['duration_hours']}h / {evaluation['total_actions']} actions")

        # Send notification
        if notify_applicant and application.contact_email:
            try:
                await email_service.send_certificate_issued(
                    application.contact_email,
                    application.system_name,
                    cert_number,
                    application.organization_name,
                )
            except Exception as e:
                logger.warning(f"Certificate email failed: {e}")
    else:
        # Test failed
        test.result = "FAIL"
        application.state = "test_failed"
        await db.commit()

        evaluation["certificate_issued"] = False

        logger.info(f"CAT-72 {test.test_id} AUTO-FAIL: {evaluation['pass_rate']}% — {', '.join(evaluation.get('failure_reasons', []))}")

        # Send notification
        if notify_applicant and application.contact_email:
            try:
                await email_service.send_test_failed(
                    application.contact_email,
                    application.system_name,
                    "; ".join(evaluation.get("failure_reasons", ["Did not meet criteria"])),
                    evaluation["pass_rate"],
                )
            except Exception as e:
                logger.warning(f"Test failure email failed: {e}")

    return evaluation
