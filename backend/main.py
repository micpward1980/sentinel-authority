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
    docs_url=None,
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

# Custom Swagger UI with dark theme
from fastapi.openapi.docs import get_swagger_ui_html

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Sentinel Authority API",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
        swagger_ui_parameters={
            "syntaxHighlight.theme": "monokai",
            "docExpansion": "list",
            "filter": True,
        },
        swagger_favicon_url="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='6' y='6' width='20' height='20' rx='5' fill='%235B4B8A' stroke='%239d8ccf' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='%239d8ccf'/></svg>",
    )
