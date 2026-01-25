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
# Custom Swagger UI with dark theme
from fastapi.responses import HTMLResponse

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return HTMLResponse(content='''<!DOCTYPE html>
<html>
<head>
    <title>Sentinel Authority API</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='6' y='6' width='20' height='20' rx='5' fill='%235B4B8A' stroke='%239d8ccf' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='%239d8ccf'/></svg>" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        body { background: #2a2f3d; margin: 0; }
        .swagger-ui { background: #2a2f3d; }
        .swagger-ui .topbar { background: #1e222b; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui .info .title { color: #fff; }
        .swagger-ui .info .description { color: rgba(255,255,255,0.75); }
        .swagger-ui .scheme-container { background: #1e222b; box-shadow: none; }
        .swagger-ui .opblock-tag { color: #9d8ccf; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui .opblock { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui .opblock .opblock-summary-method { background: #5B4B8A; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #5CD685; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #D65C5C; }
        .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #D6A05C; }
        .swagger-ui .opblock .opblock-summary-description { color: rgba(255,255,255,0.75); }
        .swagger-ui .opblock .opblock-summary-path { color: #fff; }
        .swagger-ui .btn { background: #5B4B8A; color: #fff; border: 1px solid #9d8ccf; }
        .swagger-ui select { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui input { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui textarea { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui .parameter__name { color: #9d8ccf; }
        .swagger-ui .parameter__type { color: rgba(255,255,255,0.5); }
        .swagger-ui table tbody tr td { color: rgba(255,255,255,0.75); }
        .swagger-ui .response-col_status { color: #5CD685; }
        .swagger-ui .model-box { background: rgba(255,255,255,0.05); }
        .swagger-ui .model { color: rgba(255,255,255,0.75); }
        .swagger-ui section.models { border: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui section.models h4 { color: #fff; }
        .swagger-ui .opblock-body pre { background: #1e222b; color: #fff; }
        .swagger-ui .markdown p { color: rgba(255,255,255,0.75); }
        .swagger-ui .response-col_links { color: rgba(255,255,255,0.5); }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: "/openapi.json",
            dom_id: "#swagger-ui",
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: "BaseLayout",
            docExpansion: "list",
            filter: true,
        });
    </script>
</body>
</html>''')
