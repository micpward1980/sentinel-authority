"""
ENVELO Executor Verifier
The enforcement point.  Executors call verify_and_raise() before performing
any protected action.  All checks must pass or execution is blocked.
"""
import base64
import json
import time
from typing import Dict

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from .decision_tokens import hash_action_payload, verify_token
from .replay_cache import ReplayCache


class DecisionVerificationError(Exception):
    """Raised when a decision token fails any verification check."""


class ExecutorVerifier:
    """
    Verifies signed ENVELO decision tokens at the execution boundary.

    Checks (in order):
      1. Token is structurally valid
      2. Signature valid for known kid
      3. Issuer matches
      4. Audience matches
      5. Subject matches
      6. Action matches
      7. Token not yet expired (with clock skew tolerance)
      8. Token not replayed (jti uniqueness)
      9. Input hash matches actual params (TOCTOU defense)
     10. Result field is "allow"
    """

    def __init__(
        self,
        *,
        issuer: str,
        audience: str,
        public_keys: Dict[str, Ed25519PublicKey],
        replay_cache: ReplayCache,
        max_clock_skew_seconds: int = 2,
    ):
        self.issuer = issuer
        self.audience = audience
        self.public_keys = public_keys
        self.replay_cache = replay_cache
        self.max_clock_skew_seconds = max_clock_skew_seconds

    def _extract_kid(self, token: str) -> str:
        """Peek at the unverified body to get the key id for lookup."""
        try:
            body_b64 = token.split(".", 1)[0]
            padding = "=" * (-len(body_b64) % 4)
            body = base64.urlsafe_b64decode(body_b64 + padding)
            claims = json.loads(body.decode("utf-8"))
        except Exception:
            raise DecisionVerificationError("malformed_token")

        kid = claims.get("kid")
        if not kid:
            raise DecisionVerificationError("missing_kid")
        return kid

    def verify(
        self,
        *,
        token: str,
        subject: str,
        action: str,
        params: dict,
    ) -> dict:
        """Verify token and return claims.  Raises DecisionVerificationError on any failure."""

        # 1+2. Structural check + signature
        kid = self._extract_kid(token)
        if kid not in self.public_keys:
            raise DecisionVerificationError("unknown_kid")

        try:
            claims = verify_token(token, self.public_keys[kid])
        except ValueError:
            raise DecisionVerificationError("signature_verification_failed")

        now = int(time.time())

        # 3. Issuer
        if claims.get("iss") != self.issuer:
            raise DecisionVerificationError("issuer_mismatch")

        # 4. Audience
        if claims.get("aud") != self.audience:
            raise DecisionVerificationError("audience_mismatch")

        # 5. Subject
        if claims.get("sub") != subject:
            raise DecisionVerificationError("subject_mismatch")

        # 6. Action
        if claims.get("action") != action:
            raise DecisionVerificationError("action_mismatch")

        # 7. Temporal validity
        nbf = int(claims.get("nbf", 0))
        exp = int(claims.get("exp", 0))

        if now + self.max_clock_skew_seconds < nbf:
            raise DecisionVerificationError("token_not_yet_valid")

        if now - self.max_clock_skew_seconds > exp:
            raise DecisionVerificationError("token_expired")

        # 8. Replay
        jti = claims.get("jti")
        if not jti:
            raise DecisionVerificationError("missing_jti")

        if not self.replay_cache.mark_if_new(jti, exp):
            raise DecisionVerificationError("replay_detected")

        # 9. Input hash (TOCTOU defense — params must match exactly)
        expected_hash = hash_action_payload(action, params)
        if claims.get("input_hash") != expected_hash:
            raise DecisionVerificationError("input_hash_mismatch")

        # 10. Result
        if claims.get("result") != "allow":
            raise DecisionVerificationError("not_allow_token")

        return claims

    def verify_and_raise(
        self,
        *,
        token: str,
        subject: str,
        action: str,
        params: dict,
    ) -> dict:
        """Alias for verify().  Raises DecisionVerificationError on any failure."""
        return self.verify(
            token=token,
            subject=subject,
            action=action,
            params=params,
        )
