"""
ENVELO Configuration Management
"""

import os
import json
import hashlib
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from pathlib import Path


@dataclass
class EnveloConfig:
    """ENVELO Agent Configuration"""
    
    api_key: str = field(default_factory=lambda: os.getenv("ENVELO_API_KEY", ""))
    certificate_number: str = field(default_factory=lambda: os.getenv("ENVELO_CERTIFICATE", ""))
    api_endpoint: str = field(default_factory=lambda: os.getenv(
        "ENVELO_ENDPOINT", 
        "https://sentinel-authority-production.up.railway.app"
    ))
    
    enforcement_mode: str = "BLOCK"  # BLOCK, EXCEPTION, SAFE_STATE
    fail_closed: bool = True
    failsafe_timeout_seconds: float = 30.0
    
    telemetry_enabled: bool = True
    telemetry_batch_size: int = 100
    telemetry_flush_interval: float = 1.0
    
    heartbeat_interval: float = 60.0
    heartbeat_timeout: float = 10.0
    
    offline_buffer_size: int = 10000
    offline_buffer_path: Optional[str] = None
    
    safe_state_callback: Optional[callable] = None
    
    log_level: str = "INFO"
    log_file: Optional[str] = None
    
    system_name: str = ""
    organization: str = ""
    
    _config_hash: str = field(default="", repr=False)
    
    def __post_init__(self):
        if not self.api_key:
            self._load_from_file()
        self._compute_hash()
    
    def _load_from_file(self):
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
                        if hasattr(self, key):
                            setattr(self, key, value)
                    break
                except Exception:
                    continue
    
    def _compute_hash(self):
        config_str = f"{self.api_key}:{self.certificate_number}:{self.api_endpoint}"
        self._config_hash = hashlib.sha256(config_str.encode()).hexdigest()[:16]
    
    def validate(self) -> bool:
        if not self.api_key:
            raise ValueError("ENVELO_API_KEY is required")
        if not self.api_key.startswith("sa_live_"):
            raise ValueError("Invalid API key format")
        return True
    
    @classmethod
    def from_provisioned_agent(cls, api_key: str, certificate_number: str, **kwargs) -> "EnveloConfig":
        return cls(api_key=api_key, certificate_number=certificate_number, **kwargs)
