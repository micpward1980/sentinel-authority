"""
Sentinel Authority Certification Platform
Backend API Server

FastAPI application for managing ENVELO certifications, CAT-72 tests,
and ODDC conformance records.
"""

from fastapi import FastAPI, HTTPException, Depends, Security, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
from datetime import datetime
import os

from routers import accounts, systems, envelopes, cat72, conformance, verification, auth, tasks
from database import engine, get_db, init_db
from middleware import AuditMiddleware, RateLimitMiddleware
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Sentinel Authority API Server...")
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down Sentinel Authority API Server...")

# Create FastAPI application
app = FastAPI(
    title="Sentinel Authority API",
    description="""
    ## Sentinel Authority Certification Platform API
    
    The official API for managing ENVELO™ certifications, CAT-72 convergence tests,
    and ODDC conformance records.
    
    ### Key Features
    
    - **Account Management**: Create and manage applicant, operator, and implementer accounts
    - **System Registration**: Register autonomous systems for certification
    - **Envelope Definition**: Define and version operational envelopes with physics-derived constraints
    - **CAT-72 Testing**: Schedule and monitor 72-hour convergence authorization tests
    - **Conformance Records**: Issue and verify cryptographically signed ODDC attestations
    
    ### Authentication
    
    All endpoints require Bearer token authentication. Obtain tokens via the `/auth/token` endpoint
    or through the OAuth2 flow.
    
    ### Rate Limits
    
    - Standard tier: 1000 requests/hour
    - Premium tier: 10000 requests/hour
    - Enterprise tier: Unlimited
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(systems.router, prefix="/systems", tags=["Systems"])
app.include_router(envelopes.router, prefix="/envelopes", tags=["Envelopes"])
app.include_router(cat72.router, prefix="/cat72", tags=["CAT-72 Tests"])
app.include_router(conformance.router, prefix="/conformance", tags=["Conformance Records"])
app.include_router(verification.router, prefix="/verify", tags=["Public Verification"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "service": "sentinel-authority-api"
    }

# API info endpoint
@app.get("/", tags=["Info"])
async def api_info():
    """Root endpoint with API information."""
    return {
        "name": "Sentinel Authority API",
        "version": "1.0.0",
        "description": "ENVELO™ Certification Platform API",
        "documentation": "/docs",
        "health": "/health",
        "endpoints": {
            "accounts": "/accounts",
            "systems": "/systems",
            "envelopes": "/envelopes",
            "cat72": "/cat72",
            "conformance": "/conformance",
            "verify": "/verify"
        }
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred",
            "request_id": request.state.request_id if hasattr(request.state, 'request_id') else None
        }
    )

# Run server
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS if not settings.DEBUG else 1,
        log_level="info"
    )
