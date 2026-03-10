"""Core configuration."""

from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql://localhost/sentinel_authority"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://app.sentinelauthority.org",
        "https://www.sentinelauthority.org",
        "https://sentinelauthority.org",
        "https://envelo.ai",
    ]
    CAT72_DURATION_HOURS: int = 72
    CAT72_CONVERGENCE_THRESHOLD: float = 0.95
    CAT72_DRIFT_THRESHOLD: float = 0.02
    CAT72_STABILITY_THRESHOLD: float = 0.90
    CERTIFICATE_PREFIX: str = "ODDC"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        value = (value or "").strip()
        if value and len(value) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value):
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
