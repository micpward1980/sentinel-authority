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
from app.api.routes import auth, dashboard, applicants, cat72, certificates, verification, licensees

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sentinel Authority Platform...")
    init_db()
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
        .swagger-ui .info .description { color: rgba(255,255,255,0.9) !important; }
        .swagger-ui .info p, .swagger-ui .info li { color: rgba(255,255,255,0.9) !important; }
        .swagger-ui, .swagger-ui * { color: rgba(255,255,255,0.85); }
        .swagger-ui .info a { color: #9d8ccf; }
        .swagger-ui .scheme-container { background: #1e222b; box-shadow: none; }
        .swagger-ui .opblock-tag { color: #c4b8e8; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 500; }
        .swagger-ui .opblock-tag small { color: rgba(255,255,255,0.7); }
        .swagger-ui .opblock-tag:hover { background: rgba(255,255,255,0.05); }
        .swagger-ui .opblock { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px; }
        .swagger-ui .opblock .opblock-summary-method { background: #5B4B8A; font-weight: 600; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #5B4B8A; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #5CD685; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #D65C5C; }
        .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #D6A05C; }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #9d8ccf; }
        .swagger-ui .opblock .opblock-summary-description { color: rgba(255,255,255,0.85); }
        .swagger-ui .opblock .opblock-summary-path { color: #fff; font-weight: 500; }
        .swagger-ui .opblock .opblock-summary-path__deprecated { color: rgba(255,255,255,0.5); }
        .swagger-ui .opblock .opblock-summary { border: none; }
        .swagger-ui .opblock .opblock-section-header { background: rgba(255,255,255,0.05); }
        .swagger-ui .opblock .opblock-section-header h4 { color: #fff; }
        .swagger-ui .opblock-description-wrapper p { color: rgba(255,255,255,0.75); }
        .swagger-ui .opblock-body pre.microlight { background: #1e222b; border: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui .btn { background: #5B4B8A; color: #fff; border: 1px solid #9d8ccf; }
        .swagger-ui .btn:hover { background: #6b5b9a; }
        .swagger-ui .btn.execute { background: #5B4B8A; }
        .swagger-ui .btn.cancel { background: #D65C5C; border-color: #D65C5C; }
        .swagger-ui select { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui input[type=text], .swagger-ui input[type=email], .swagger-ui input[type=password] { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui textarea { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui .parameter__name { color: #c4b8e8; font-weight: 500; }
        .swagger-ui .parameter__type { color: rgba(255,255,255,0.7); }
        .swagger-ui .parameter__in { color: rgba(255,255,255,0.6); }
        .swagger-ui table thead tr th { color: rgba(255,255,255,0.8); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .swagger-ui table tbody tr td { color: rgba(255,255,255,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .swagger-ui .response-col_status { color: #5CD685; }
        .swagger-ui .response-col_description { color: rgba(255,255,255,0.75); }
        .swagger-ui .model-box { background: rgba(255,255,255,0.08); }
        .swagger-ui .model { color: #fff; }
        .swagger-ui .model span { color: #fff !important; }
        .swagger-ui .model .prop { color: #fff; }
        .swagger-ui .model .prop-name { color: #c4b8e8 !important; font-weight: 500; }
        .swagger-ui .model .prop-type { color: #5CD685 !important; }
        .swagger-ui .model .prop-format { color: rgba(255,255,255,0.6); }
        .swagger-ui .model-title { color: #c4b8e8; font-weight: 600; }
        .swagger-ui .model-title__text { color: #c4b8e8 !important; }
        .swagger-ui section.models { border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.03); }
        .swagger-ui section.models h4 { color: #fff !important; }
        .swagger-ui section.models h4 span { color: #fff !important; }
        .swagger-ui section.models .model-container { background: rgba(255,255,255,0.05); margin: 8px 0; padding: 12px; }
        .swagger-ui .model-toggle { background: rgba(255,255,255,0.1); }
        .swagger-ui .model-toggle::after { color: #fff; }
        .swagger-ui .brace-open, .swagger-ui .brace-close { color: #fff !important; }
        .swagger-ui .inner-object { color: #fff; }
        .swagger-ui .renderedMarkdown p { color: rgba(255,255,255,0.85); }
        .swagger-ui .highlight-code { background: #1e222b; }
        .swagger-ui .highlight-code .microlight { color: #fff !important; }
        .swagger-ui pre { color: #fff !important; }
        .swagger-ui code { color: #fff !important; }
        .swagger-ui .microlight { color: #fff !important; }
        .swagger-ui .response .microlight { color: #fff !important; }
        .swagger-ui .markdown p, .swagger-ui .markdown li { color: rgba(255,255,255,0.9); }
        .swagger-ui .markdown code { background: rgba(255,255,255,0.15); color: #c4b8e8; }
        .swagger-ui .response-col_links { color: rgba(255,255,255,0.5); }
        .swagger-ui .responses-inner { background: transparent; }
        .swagger-ui .responses-header { color: rgba(255,255,255,0.75); }
        .swagger-ui .loading-container .loading::after { color: #9d8ccf; }
        .swagger-ui .filter-container .filter input { background: #1e222b; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .swagger-ui .download-contents { background: #5B4B8A; color: #fff; }
        .swagger-ui .copy-to-clipboard { background: #1e222b; }
        .swagger-ui .copy-to-clipboard button { background: #5B4B8A; }
        .swagger-ui .authorization__btn { fill: #9d8ccf; }
        .swagger-ui .unlocked { fill: #5CD685; }
        .swagger-ui .locked { fill: #D6A05C; }
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
