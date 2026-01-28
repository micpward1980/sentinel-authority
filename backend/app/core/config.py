"""Core configuration."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql://localhost/sentinel_authority"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
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
    
    class Config:
        env_file = ".env"


settings = Settings()
