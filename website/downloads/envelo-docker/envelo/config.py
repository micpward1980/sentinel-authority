"""
ENVELO Configuration Management
Secure loading with injection prevention.

Sentinel Authority © 2025-2026
"""

import os
import json
import hashlib
import hmac
from dataclasses import dataclass, field
from typing import Optional, Callable
from pathlib import Path


# Fields that can be set via config file — whitelist only
_CONFIGURABLE_FIELDS = frozenset({
    "api_key", "certificate_number", "api_endpoint",
    "enforcement_mode", "fail_closed", "failsafe_timeout_seconds",
    "cache_boundaries_locally", "boundary_cache_path",
    "enforce_with_cached_boundaries",
    "telemetry_enabled", "telemetry_batch_size", "telemetry_flush_interval",
    "heartbeat_interval", "heartbeat_timeout",
    "offline_buffer_size",
    "log_level", "log_file",
    "system_name", "organization",
})

# Valid enforcement modes
_VALID_MODES = frozenset({"BLOCK", "EXCEPTION", "SAFE_STATE"})


@dataclass
class EnveloConfig:
    """ENVELO Agent Configuration."""

    # Auth
    api_key: str = field(default_factory=lambda: os.getenv("ENVELO_API_KEY", ""))
    certificate_number: str = field(
        default_factory=lambda: os.getenv("ENVELO_CERTIFICATE", "")
    )
    api_endpoint: str = field(
        default_factory=lambda: os.getenv(
            "ENVELO_ENDPOINT",
            "https://sentinel-authority-production.up.railway.app",
        )
    )

    # Enforcement
    enforcement_mode: str = "BLOCK"
    fail_closed: bool = True
    failsafe_timeout_seconds: float = 30.0

    # Offline / caching
    cache_boundaries_locally: bool = True
    boundary_cache_path: str = field(
        default_factory=lambda: str(Path.home() / ".envelo" / "boundary_cache.json")
    )
    enforce_with_cached_boundaries: bool = True

    # Telemetry
    telemetry_enabled: bool = True
    telemetry_batch_size: int = 100
    telemetry_flush_interval: float = 1.0

    # Heartbeat
    heartbeat_interval: float = 60.0
    heartbeat_timeout: float = 10.0

    # Offline buffer
    offline_buffer_size: int = 10_000

    # Callbacks (not serializable — set in code only)
    safe_state_callback: Optional[Callable] = field(default=None, repr=False)

    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = None

    # Identity
    system_name: str = ""
    organization: str = ""

    # Computed
    _config_hash: str = field(default="", repr=False)

    def __post_init__(self):
        if not self.api_key:
            self._load_from_file()
        self._validate_fields()
        self._compute_hash()
        Path(self.boundary_cache_path).parent.mkdir(parents=True, exist_ok=True)

    def _validate_fields(self):
        if self.enforcement_mode not in _VALID_MODES:
            raise ValueError(
                f"enforcement_mode must be one of {_VALID_MODES}, got '{self.enforcement_mode}'"
            )
        if self.failsafe_timeout_seconds < 5:
            raise ValueError("failsafe_timeout_seconds must be >= 5")
        if self.heartbeat_interval < 5:
            raise ValueError("heartbeat_interval must be >= 5")
        if self.telemetry_batch_size < 1:
            raise ValueError("telemetry_batch_size must be >= 1")

    def _load_from_file(self):
        """Load config from file — only whitelisted fields."""
        paths = [
            Path.cwd() / ".envelo.json",
            Path.cwd() / "envelo.json",
            Path.home() / ".envelo" / "config.json",
        ]
        for path in paths:
            if path.exists():
                try:
                    with open(path) as f:
                        data = json.load(f)
                    for key, value in data.items():
                        if key in _CONFIGURABLE_FIELDS:
                            setattr(self, key, value)
                    return
                except (json.JSONDecodeError, OSError):
                    continue

    def _compute_hash(self):
        raw = f"{self.api_key}:{self.certificate_number}:{self.api_endpoint}"
        self._config_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def validate(self) -> bool:
        """Validate config is sufficient to start the agent."""
        if not self.api_key:
            raise ValueError("ENVELO_API_KEY is required")
        if not self.api_key.startswith("sa_live_"):
            raise ValueError("Invalid API key format (must start with sa_live_)")
        return True

    # ── Cache integrity ─────────────────────────────────────────────

    def cache_hmac_key(self) -> bytes:
        """Derive HMAC key from API key — prevents cache tampering."""
        return hashlib.sha256(f"envelo_cache:{self.api_key}".encode()).digest()

    def sign_cache(self, data: bytes) -> str:
        """HMAC-SHA256 signature for boundary cache."""
        return hmac.new(self.cache_hmac_key(), data, hashlib.sha256).hexdigest()

    def verify_cache(self, data: bytes, signature: str) -> bool:
        """Verify boundary cache has not been tampered with."""
        expected = self.sign_cache(data)
        return hmac.compare_digest(expected, signature)
