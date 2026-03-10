"""
Signed ODD Compliance Log Service
Sentinel Authority

Generates a cryptographically signed record of boundary enforcement activity
for a given certificate and reporting period. This is the insurance-facing
artifact — a verifiable document a deploying entity can hand to an underwriter.

Usage:
    from app.services.compliance_log_service import generate_compliance_log

    payload, signature, pdf_bytes = await generate_compliance_log(
        db=db,
        certificate=cert,
        period_from=datetime(2026, 1, 1),
        period_to=datetime(2026, 3, 10),
    )
"""

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Certificate,
    EnveloSession,
    TelemetryRecord,
    Violation,
)

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )
    from cryptography.hazmat.primitives import serialization
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False


# ── Signing key management ────────────────────────────────────────────────────

SA_KEY_ID = "sa-compliance-key-1"
_SIGNING_KEY: Optional["Ed25519PrivateKey"] = None


def _load_signing_key() -> "Ed25519PrivateKey":
    """
    Load or generate the SA compliance signing key.

    In production set SA_COMPLIANCE_SIGNING_KEY env var to a base64-encoded
    Ed25519 private key (raw 32 bytes). Generate with:

        python3 -c "
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization
        import base64
        k = Ed25519PrivateKey.generate()
        raw = k.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
        print(base64.b64encode(raw).decode())
        "

    Store the output as SA_COMPLIANCE_SIGNING_KEY in Railway env vars.
    Store the corresponding public key at:
        website/public/sa-compliance-pubkey.txt
    """
    global _SIGNING_KEY
    if _SIGNING_KEY is not None:
        return _SIGNING_KEY

    if not _CRYPTO_AVAILABLE:
        raise RuntimeError("cryptography package not installed — pip install cryptography>=42.0.0")

    raw_b64 = os.environ.get("SA_COMPLIANCE_SIGNING_KEY", "").strip()
    if raw_b64:
        raw = base64.b64decode(raw_b64)
        _SIGNING_KEY = Ed25519PrivateKey.from_private_bytes(raw)
    else:
        # Dev fallback — ephemeral key, not suitable for production
        _SIGNING_KEY = Ed25519PrivateKey.generate()

    return _SIGNING_KEY


def get_public_key_pem() -> str:
    """Export the SA compliance public key as PEM for publishing."""
    key = _load_signing_key()
    pub = key.public_key()
    return pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")


def get_public_key_b64() -> str:
    """Export the SA compliance public key as raw base64."""
    key = _load_signing_key()
    pub = key.public_key()
    raw = pub.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(raw).decode("ascii")


# ── Canonical JSON and signing ────────────────────────────────────────────────

def _canonical_json(data: dict) -> bytes:
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")


def _sign(payload: dict) -> str:
    """Sign canonical JSON of payload, return base64url signature."""
    key = _load_signing_key()
    body = _canonical_json(payload)
    sig = key.sign(body)
    return base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")


def _payload_hash(payload: dict) -> str:
    body = _canonical_json(payload)
    return "sha256:" + hashlib.sha256(body).hexdigest()


# ── Data aggregation ──────────────────────────────────────────────────────────

async def _get_sessions(
    db: AsyncSession,
    certificate_db_id: int,
    period_from: datetime,
    period_to: datetime,
) -> list:
    result = await db.execute(
        select(EnveloSession).where(
            and_(
                EnveloSession.certificate_id == certificate_db_id,
                EnveloSession.session_type == "production",
                EnveloSession.started_at >= period_from,
                EnveloSession.started_at <= period_to,
            )
        ).order_by(EnveloSession.started_at)
    )
    return result.scalars().all()


async def _get_violations(
    db: AsyncSession,
    session_ids: list[int],
    period_from: datetime,
    period_to: datetime,
) -> list:
    if not session_ids:
        return []
    result = await db.execute(
        select(Violation).where(
            and_(
                Violation.session_id.in_(session_ids),
                Violation.timestamp >= period_from,
                Violation.timestamp <= period_to,
            )
        ).order_by(Violation.timestamp)
    )
    return result.scalars().all()


async def _get_telemetry_counts(
    db: AsyncSession,
    session_ids: list[int],
    period_from: datetime,
    period_to: datetime,
) -> dict:
    """Return {total, passed, blocked} counts from telemetry_records."""
    if not session_ids:
        return {"total": 0, "passed": 0, "blocked": 0}

    total_q = await db.execute(
        select(func.count(TelemetryRecord.id)).where(
            and_(
                TelemetryRecord.session_id.in_(session_ids),
                TelemetryRecord.timestamp >= period_from,
                TelemetryRecord.timestamp <= period_to,
            )
        )
    )
    pass_q = await db.execute(
        select(func.count(TelemetryRecord.id)).where(
            and_(
                TelemetryRecord.session_id.in_(session_ids),
                TelemetryRecord.result == "PASS",
                TelemetryRecord.timestamp >= period_from,
                TelemetryRecord.timestamp <= period_to,
            )
        )
    )
    block_q = await db.execute(
        select(func.count(TelemetryRecord.id)).where(
            and_(
                TelemetryRecord.session_id.in_(session_ids),
                TelemetryRecord.result == "BLOCK",
                TelemetryRecord.timestamp >= period_from,
                TelemetryRecord.timestamp <= period_to,
            )
        )
    )

    total = total_q.scalar() or 0
    passed = pass_q.scalar() or 0
    blocked = block_q.scalar() or 0
    return {"total": total, "passed": passed, "blocked": blocked}


# ── Main entry point ──────────────────────────────────────────────────────────

async def generate_compliance_log(
    db: AsyncSession,
    certificate: "Certificate",
    period_from: datetime,
    period_to: datetime,
) -> tuple[dict, str, bytes]:
    """
    Generate a signed ODD compliance log.

    Returns:
        (payload_dict, signature_b64url, pdf_bytes)

    The payload_dict + signature can be used for independent verification:
        canonical_json(payload) → Ed25519 verify with SA public key

    The pdf_bytes is the human-readable artifact for download.
    """
    from app.services.compliance_log_pdf import generate_compliance_log_pdf

    # Ensure datetimes are naive UTC for DB comparison
    if period_from.tzinfo is not None:
        period_from = period_from.replace(tzinfo=None)
    if period_to.tzinfo is not None:
        period_to = period_to.replace(tzinfo=None)

    sessions = await _get_sessions(db, certificate.id, period_from, period_to)
    session_ids = [s.id for s in sessions]

    telemetry_counts = await _get_telemetry_counts(db, session_ids, period_from, period_to)
    violations = await _get_violations(db, session_ids, period_from, period_to)

    # Aggregate session-level pass/block from EnveloSession counters
    # (faster than counting telemetry when sessions are large)
    session_pass = sum(s.pass_count or 0 for s in sessions)
    session_block = sum(s.block_count or 0 for s in sessions)

    # Prefer telemetry counts if available; fall back to session aggregates
    total_checks = telemetry_counts["total"] or (session_pass + session_block)
    total_passed = telemetry_counts["passed"] or session_pass
    total_blocked = telemetry_counts["blocked"] or session_block

    block_rate = round((total_blocked / total_checks * 100), 4) if total_checks > 0 else 0.0

    # Unique boundaries that triggered blocks
    unique_boundaries = list({v.boundary_name for v in violations if v.boundary_name})

    # Violation records — truncate detail to avoid PII/proprietary leakage
    violation_records = []
    for v in violations[:500]:  # cap at 500 in payload
        violation_records.append({
            "timestamp": v.timestamp.isoformat() if v.timestamp else None,
            "boundary_name": v.boundary_name or "unknown",
            "message": v.violation_message or "",
            "session_id": next(
                (s.session_id for s in sessions if s.id == v.session_id), "unknown"
            ),
        })

    # Certificate validity at time of generation
    now = datetime.utcnow()
    cert_valid = (
        certificate.state == "conformant"
        and certificate.expires_at is not None
        and certificate.expires_at > now
    )

    odd_spec = certificate.odd_specification or {}

    payload = {
        "version": "1",
        "document_type": "oddc_compliance_log",
        "generated_at": now.isoformat() + "Z",
        "issuer": "Sentinel Authority",
        "issuer_key_id": SA_KEY_ID,
        "certificate": {
            "certificate_number": certificate.certificate_number,
            "organization_name": certificate.organization_name,
            "system_name": certificate.system_name,
            "system_version": certificate.system_version or "",
            "issued_at": certificate.issued_at.isoformat() if certificate.issued_at else None,
            "expires_at": certificate.expires_at.isoformat() if certificate.expires_at else None,
            "state": certificate.state,
            "valid_at_generation": cert_valid,
        },
        "odd_specification": odd_spec,
        "reporting_period": {
            "from": period_from.isoformat() + "Z",
            "to": period_to.isoformat() + "Z",
        },
        "summary": {
            "total_sessions": len(sessions),
            "total_checks": total_checks,
            "passed": total_passed,
            "blocked": total_blocked,
            "block_rate_pct": block_rate,
            "interlock_activations": total_blocked,
            "unique_boundaries_triggered": len(unique_boundaries),
            "boundaries_triggered": unique_boundaries,
        },
        "violation_count": len(violations),
        "violations": violation_records,
        "interlock_status": "active" if sessions else "no_sessions_in_period",
        "verification_note": (
            "This document is signed with the Sentinel Authority compliance key. "
            "Verify at: https://www.sentinelauthority.org/verify-compliance-log"
        ),
    }

    signature = _sign(payload)
    payload_hash = _payload_hash(payload)

    pdf_bytes = generate_compliance_log_pdf(
        payload=payload,
        signature=signature,
        payload_hash=payload_hash,
    )

    return payload, signature, pdf_bytes
