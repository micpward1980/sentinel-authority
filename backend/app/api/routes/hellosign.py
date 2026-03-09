import json, logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import Application
from app.services.audit_service import write_audit_log
from app.services.hellosign_service import send_agreement_envelope, get_signature_request, verify_webhook_signature, parse_webhook_event

logger = logging.getLogger("sentinel.hellosign")
router = APIRouter()

@router.post("/webhook", include_in_schema=False)
async def hellosign_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    if not verify_webhook_signature(body, request.headers.get("X-HelloSign-Signature", "")):
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        payload = json.loads(body)
    except Exception:
        return "Hello API Event Received"
    event = parse_webhook_event(payload)
    event_type = event.get("event_type")
    sig_request_id = event.get("signature_request_id")
    metadata = event.get("metadata", {})
    logger.info(f"HelloSign event: {event_type} for {sig_request_id}")
    if event_type in ("signature_request_all_signed",) or event.get("is_complete"):
        app_id = metadata.get("application_id")
        if app_id:
            result = await db.execute(select(Application).where(Application.id == int(app_id)))
            app = result.scalar_one_or_none()
            if app:
                app.agreement_signed_at = datetime.now(timezone.utc)
                app.hellosign_complete = True
                await write_audit_log(db, action="agreement_countersigned", resource_type="application", resource_id=app.id, user_id=None, user_email="hellosign@system", details={"signature_request_id": sig_request_id, "application_number": app.application_number})
                await db.commit()
                logger.info(f"Agreement completed for {app.application_number}")
    elif event_type == "signature_request_declined":
        app_id = metadata.get("application_id")
        if app_id:
            result = await db.execute(select(Application).where(Application.id == int(app_id)))
            app = result.scalar_one_or_none()
            if app:
                await write_audit_log(db, action="agreement_declined", resource_type="application", resource_id=app.id, user_id=None, user_email="hellosign@system", details={"signature_request_id": sig_request_id})
                await db.commit()
    return "Hello API Event Received"

@router.get("/{application_id}/status")
async def get_agreement_status(application_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if user.get("role") not in ["admin", "operator"] and app.applicant_id != int(user["sub"]):
        raise HTTPException(status_code=403, detail="Access denied")
    if not app.hellosign_request_id:
        return {"status": "not_sent", "application_id": application_id}
    try:
        hs_data = await get_signature_request(app.hellosign_request_id)
        return {"status": "complete" if hs_data.get("is_complete") else "pending", "signature_request_id": app.hellosign_request_id, "is_complete": hs_data.get("is_complete"), "signatures": [{"signer_email": s.get("signer_email_address"), "status": s.get("status_code"), "signed_at": s.get("signed_at")} for s in hs_data.get("signatures", [])], "agreement_signed_at": app.agreement_signed_at.isoformat() if app.agreement_signed_at else None}
    except Exception as e:
        return {"status": "unknown", "error": str(e)}

@router.post("/{application_id}/resend")
async def resend_agreement(application_id: int, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.agreement_signed_at:
        raise HTTPException(status_code=400, detail="Agreement already fully executed")
    hs_result = await send_agreement_envelope(app.id, app.application_number, app.system_name, app.organization_name, app.contact_name or app.contact_email, app.contact_email)
    app.hellosign_request_id = hs_result["signature_request_id"]
    await db.commit()
    await write_audit_log(db, action="agreement_resent", resource_type="application", resource_id=app.id, user_id=int(user["sub"]), user_email=user.get("email"), details={"signature_request_id": hs_result["signature_request_id"]})
    return {"status": "sent", "signature_request_id": hs_result["signature_request_id"]}
