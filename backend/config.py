"""
Configuration settings for Sentinel Authority API
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "Sentinel Authority API"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel_authority"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis (for caching and rate limiting)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "change-me-in-production-use-secrets-manager"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Auth0 / External Auth Provider
    AUTH0_DOMAIN: Optional[str] = None
    AUTH0_API_AUDIENCE: Optional[str] = None
    AUTH0_ALGORITHMS: List[str] = ["RS256"]
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://app.sentinelauthority.org",
        "https://sentinelauthority.org"
    ]
    
    # API Rate Limiting
    RATE_LIMIT_STANDARD: int = 1000  # requests per hour
    RATE_LIMIT_PREMIUM: int = 10000
    RATE_LIMIT_ENTERPRISE: int = 100000
    
    # Cryptographic Signing
    SIGNING_KEY_PATH: str = "/etc/sentinel/keys/signing_key.pem"
    SIGNING_KEY_ID: str = "SA-KEY-2026-001"
    SIGNATURE_ALGORITHM: str = "ECDSA-P256-SHA256"
    
    # Storage
    S3_BUCKET: str = "sentinel-authority-evidence"
    S3_REGION: str = "us-east-1"
    S3_ENDPOINT: Optional[str] = None  # For MinIO/local S3-compatible storage
    
    # Email
    SMTP_HOST: str = "smtp.sendgrid.net"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@sentinelauthority.org"
    
    # Stripe (Billing)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    # Feature Flags
    ENABLE_TELEMETRY_INGESTION: bool = True
    ENABLE_REAL_TIME_MONITORING: bool = True
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Environment-specific configurations
class DevelopmentSettings(Settings):
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel_dev"


class TestingSettings(Settings):
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel_test"
    ENABLE_EMAIL_NOTIFICATIONS: bool = False


class ProductionSettings(Settings):
    DEBUG: bool = False
    WORKERS: int = 8


def get_settings() -> Settings:
    """Get settings based on environment."""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionSettings()
    elif env == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()
