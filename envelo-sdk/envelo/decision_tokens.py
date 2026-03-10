"""
ENVELO Decision Tokens
Signed, short-lived authorization artifacts bound to exact action + inputs.
Replaces Boolean evaluate() as the enforcement primitive.
"""
import base64
import hashlib
import json
import secrets
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------

def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64u_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


# ---------------------------------------------------------------------------
# Canonical JSON / hashing
# ---------------------------------------------------------------------------

def canonical_json(data: Any) -> bytes:
    """Deterministic, compact UTF-8 JSON — sorted keys, no extra whitespace."""
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_action_payload(action: str, params: Dict[str, Any]) -> str:
    """Produce a stable sha256 fingerprint of (action, params).

    Both the interlock and the executor compute this independently.
    A mismatch means the params were mutated after authorization.
    """
    payload = {"action": action, "params": params}
    return "sha256:" + sha256_hex(canonical_json(payload))


# ---------------------------------------------------------------------------
# Signing / verification
# ---------------------------------------------------------------------------

def sign_claims(claims: Dict[str, Any], private_key: Ed25519PrivateKey) -> str:
    """Sign canonical JSON claims with Ed25519.  Returns 'b64u_body.b64u_sig'."""
    body = canonical_json(claims)
    sig = private_key.sign(body)
    return f"{_b64u(body)}.{_b64u(sig)}"


def verify_token(token: str, public_key: Ed25519PublicKey) -> Dict[str, Any]:
    """Verify signature and return claims dict.  Raises ValueError on any failure."""
    try:
        body_b64, sig_b64 = token.split(".", 1)
        body = _b64u_decode(body_b64)
        sig = _b64u_decode(sig_b64)
        public_key.verify(sig, body)
        return json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"invalid decision token: {exc}") from exc


# ---------------------------------------------------------------------------
# Decision data class
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AuthorizationDecision:
    allowed: bool
    reason: str
    token: Optional[str] = None
    jti: Optional[str] = None
    expires_at: Optional[int] = None
    policy_version: Optional[str] = None
    policy_hash: Optional[str] = None


# ---------------------------------------------------------------------------
# Token minting
# ---------------------------------------------------------------------------

def mint_allow_token(
    *,
    issuer: str,
    key_id: str,
    signing_key: Ed25519PrivateKey,
    subject: str,
    audience: str,
    action: str,
    params: Dict[str, Any],
    policy_version: str,
    policy_hash: str,
    ttl_seconds: int = 5,
    constraints: Optional[Dict[str, Any]] = None,
    reason: str = "within_boundary",
) -> AuthorizationDecision:
    """Issue a signed allow token.  TTL should be 2–10 seconds for high-assurance paths."""
    now = int(time.time())
    exp = now + ttl_seconds
    jti = str(uuid.uuid4())

    claims = {
        "ver": 1,
        "iss": issuer,
        "kid": key_id,
        "jti": jti,
        "sub": subject,
        "aud": audience,
        "iat": now,
        "nbf": now,
        "exp": exp,
        "policy_version": policy_version,
        "policy_hash": policy_hash,
        "action": action,
        "input_hash": hash_action_payload(action, params),
        "input_schema_version": 1,
        "result": "allow",
        "reason": reason,
        "nonce": secrets.token_hex(16),
        "constraints": constraints or {},
    }

    token = sign_claims(claims, signing_key)

    return AuthorizationDecision(
        allowed=True,
        reason=reason,
        token=token,
        jti=jti,
        expires_at=exp,
        policy_version=policy_version,
        policy_hash=policy_hash,
    )
