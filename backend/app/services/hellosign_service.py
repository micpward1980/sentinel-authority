import os, hashlib, hmac, httpx, logging
from datetime import datetime, timezone

logger = logging.getLogger("sentinel.hellosign")

HELLOSIGN_API_KEY = os.getenv("HELLOSIGN_API_KEY", "")
SA_SIGNER_EMAIL = os.getenv("SA_SIGNER_EMAIL", "conformance@sentinelauthority.org")
SA_SIGNER_NAME = os.getenv("SA_SIGNER_NAME", "Sentinel Authority")
HELLOSIGN_WEBHOOK_SECRET = os.getenv("HELLOSIGN_WEBHOOK_SECRET", "")
BASE_URL = "https://api.hellosign.com/v3"

async def send_agreement_envelope(application_id, application_number, system_name, organization_name, contact_name, contact_email):
    if not HELLOSIGN_API_KEY:
        raise ValueError("HELLOSIGN_API_KEY not configured")
    payload = {
        "test_mode": 0 if os.getenv("ENVIRONMENT") == "production" else 1,
        "title": f"ODDC Conformance Agreement — {application_number}",
        "subject": f"Conformance Agreement — {system_name} ({application_number})",
        "message": f"Dear {contact_name},\n\nYour ODDC certification application for {system_name} has been approved. Please review and execute the attached Conformance Agreement to proceed to deployment.\n\n— Sentinel Authority",
        "signing_redirect_url": f"https://app.sentinelauthority.org/applications/{application_id}",
        "signers[0][email_address]": contact_email,
        "signers[0][name]": contact_name,
        "signers[0][order]": 0,
        "signers[1][email_address]": SA_SIGNER_EMAIL,
        "signers[1][name]": SA_SIGNER_NAME,
        "signers[1][order]": 1,
        "file_url[0]": "https://www.sentinelauthority.org/conformance-agreement.html",
        "metadata[application_id]": str(application_id),
        "metadata[application_number]": application_number,
        "metadata[system_name]": system_name,
        "metadata[organization_name]": organization_name,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/signature_request/send", data=payload, auth=(HELLOSIGN_API_KEY, ""), timeout=30)
    if response.status_code != 200:
        raise Exception(f"HelloSign API error: {response.status_code} — {response.text}")
    sig = response.json().get("signature_request", {})
    return {"signature_request_id": sig.get("signature_request_id"), "signing_url": sig.get("signing_url")}

async def get_signature_request(signature_request_id):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/signature_request/{signature_request_id}", auth=(HELLOSIGN_API_KEY, ""), timeout=15)
    response.raise_for_status()
    return response.json().get("signature_request", {})

def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    if not HELLOSIGN_WEBHOOK_SECRET:
        return True
    expected = hmac.new(HELLOSIGN_WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

def parse_webhook_event(payload: dict) -> dict:
    event = payload.get("event", {})
    sig_request = payload.get("signature_request", {})
    return {
        "event_type": event.get("event_type"),
        "signature_request_id": sig_request.get("signature_request_id"),
        "is_complete": sig_request.get("is_complete", False),
        "metadata": sig_request.get("metadata", {}),
        "signatures": sig_request.get("signatures", []),
    }
