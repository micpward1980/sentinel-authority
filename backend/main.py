"""
Sentinel Authority Platform
===========================
Unified certification platform for autonomous systems operating under ENVELO
(Enforcer for Non-Violable Execution & Limit Oversight)

Copyright 2026 Wemby Corporation. All rights reserved.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import (
    applicants,
    cat72,
    certificates,
    verification,
    licensees,
    auth,
    dashboard,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sentinel Authority Platform...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Sentinel Authority API",
    description="Certification platform for autonomous systems under ENVELO framework",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(applicants.router, prefix="/api/applicants", tags=["Applicant Portal"])
app.include_router(cat72.router, prefix="/api/cat72", tags=["CAT-72 Console"])
app.include_router(certificates.router, prefix="/api/certificates", tags=["Certification Registry"])
app.include_router(verification.router, prefix="/api/verify", tags=["Public Verification"])
app.include_router(licensees.router, prefix="/api/licensees", tags=["Licensee Portal"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "sentinel-authority"}


@app.get("/")
async def root():
    return {
        "name": "Sentinel Authority Platform",
        "version": "1.0.0",
        "framework": "ENVELO",
        "docs": "/docs"
    }
