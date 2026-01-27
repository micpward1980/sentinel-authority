"""
Sentinel Authority Platform API
Unified certification platform for autonomous systems operating under ENVELO
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, dashboard, applicants, cat72, certificates, verification, licensees, envelo, apikeys

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")


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
app.include_router(applicants.router, prefix="/api/applications", tags=["Applicant Portal"])
app.include_router(cat72.router, prefix="/api/cat72", tags=["CAT-72 Console"])
app.include_router(certificates.router, prefix="/api/certificates", tags=["Certification Registry"])
app.include_router(verification.router, prefix="/api/verify", tags=["Public Verification"])
app.include_router(licensees.router, prefix="/api/licensees", tags=["Licensee Portal"])
app.include_router(envelo.router, prefix="/api/envelo", tags=["ENVELO Agent"])
app.include_router(apikeys.router, prefix="/api/apikeys", tags=["API Keys"])


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


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return HTMLResponse(content="""<!DOCTYPE html>
<html>
<head>
    <title>Sentinel Authority API</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='6' y='6' width='20' height='20' rx='5' fill='%235B4B8A' stroke='%239d8ccf' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='%239d8ccf'/></svg>" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        body { background: #2a2f3d; margin: 0; }
        .swagger-ui { background: #2a2f3d; }
        .swagger-ui .topbar { background: #1e222b; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui .info .title { color: #fff !important; }
        .swagger-ui .opblock .opblock-summary-method { background: #5B4B8A; font-weight: 600; }
        .swagger-ui .btn { background: #5B4B8A; color: #fff; border: 1px solid #9d8ccf; }
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
            deepLinking: true,
        });
    </script>
</body>
</html>""")


# Start auto-evaluator background task
@app.on_event("startup")
async def start_auto_evaluator():
    import asyncio
    from app.services.auto_evaluator import run_auto_evaluator
    asyncio.create_task(run_auto_evaluator())
    
    # Start offline agent monitor
    from app.services.background_tasks import check_offline_agents_task
    from app.core.database import get_db
    asyncio.create_task(check_offline_agents_task(get_db))
    logger.info("Offline agent monitor started")
    logger.info("Auto-evaluator background task started")
