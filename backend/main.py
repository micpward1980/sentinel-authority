"""
Sentinel Authority Platform API
Unified certification platform for autonomous systems operating under ENVELO
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.database import init_db, get_db
from app.core.security import get_current_user
from fastapi import Depends
from app.api.routes import audit as audit_routes, auth, dashboard, applicants, cat72, certificates, verification, licensees, envelo, apikeys, envelo_boundaries, registry, users, documents, deploy

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


limiter = Limiter(key_func=get_remote_address)

OPENAPI_TAGS = [
    {"name": "System", "description": "Health checks and service info"},
    {"name": "Authentication", "description": "User registration, login, password reset, and token management"},
    {"name": "Dashboard", "description": "Admin dashboard statistics, recent applications, active tests, and certificate summaries"},
    {"name": "Applicant Portal", "description": "Submit, track, and manage ODDC certification applications"},
    {"name": "CAT-72 Console", "description": "Create, schedule, and monitor CAT-72 conformance tests"},
    {"name": "Certification Registry", "description": "Issue, manage, suspend, and revoke ODDC certificates"},
    {"name": "Public Verification", "description": "Publicly accessible certificate verification and evidence endpoints"},
    {"name": "Licensee Portal", "description": "ENVELO technology licensee management and API key provisioning"},
    {"name": "ENVELO Agent", "description": "Agent session lifecycle, telemetry ingestion, monitoring, and violation tracking"},
    {"name": "ENVELO Boundaries", "description": "Configure and test ENVELO boundary definitions and enforcement parameters"},
    {"name": "API Keys", "description": "Generate, list, and revoke API keys for programmatic access"},
    {"name": "Registry", "description": "Public registry search for certified autonomous systems"},
    {"name": "User Management", "description": "Admin user CRUD, role management, email preferences, and password resets"},
    {"name": "Documents", "description": "Upload, list, and download certification-related documents"},
    {"name": "One-Command Deploy", "description": "Single-command ENVELO agent deployment configuration"},
    {"name": "Audit Log", "description": "Tamper-evident audit trail of all platform actions"},
]

app = FastAPI(
    title="Sentinel Authority API",
    description="""
## Sentinel Authority Platform

Certification platform for autonomous systems operating under the **ENVELO™** (Enforced Non-Violable Execution-Limit Override) framework.

### Core Concepts
- **ODDC**: Operational Design Domain Conformance certification
- **CAT-72**: 72-hour Conformance Assessment Test
- **ENVELO**: Runtime safety boundary enforcement for AI agents

### Authentication
All authenticated endpoints require a Bearer token obtained via `/api/auth/login`.
    """.strip(),
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url="/redoc",
    openapi_tags=OPENAPI_TAGS,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(envelo_boundaries.router, prefix="/api/envelo/boundaries", tags=["ENVELO Boundaries"])
app.include_router(apikeys.router, prefix="/api/apikeys", tags=["API Keys"])
app.include_router(registry.router, tags=["Registry"])
app.include_router(users.router, prefix="/api/users", tags=["User Management"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(deploy.router, prefix="/api", tags=["One-Command Deploy"])
app.include_router(audit_routes.router, prefix="/api/audit", tags=["Audit Log"])


@app.get("/health", tags=["System"], summary="Health check")
async def health_check():
    return {"status": "healthy", "service": "sentinel-authority"}


@app.get("/", tags=["System"], summary="Service info")
async def root():
    return {
        "name": "Sentinel Authority Platform",
        "version": "1.0.0",
        "framework": "ENVELO",
        "docs": "/docs"
    }




# ═══ Notifications (derived from audit log) ═══

@app.get("/api/notifications", tags=["System"], summary="Get user notifications")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from sqlalchemy import select, desc
    from app.models.models import AuditLog, Application
    from datetime import timedelta
    
    notifications = []
    cutoff = datetime.utcnow() - timedelta(days=7)
    
    if current_user.get("role") == "admin":
        result = await db.execute(
            select(AuditLog).where(
                AuditLog.timestamp >= cutoff,
                AuditLog.action.in_(["state_changed", "certificate_issued", "submitted"])
            ).order_by(desc(AuditLog.timestamp)).limit(30)
        )
        logs = result.scalars().all()
        for log in logs:
            details = log.details or {}
            ns = details.get("new_state", "")
            sn = details.get("system_name", "")
            if log.action == "state_changed":
                msg = f"{sn or 'Application'} moved to {ns.replace('_', ' ')}"
                ntype = "success" if ns in ("conformant", "approved") else "warning" if ns in ("suspended", "revoked") else "info"
            elif log.action == "certificate_issued":
                msg = f"Certificate issued for {sn or 'system'}"
                ntype = "success"
            elif log.action == "submitted":
                msg = f"New application: {sn or 'system'}"
                ntype = "info"
            else:
                msg = log.action.replace("_", " ").title()
                ntype = "info"
            notifications.append({
                "id": log.id, "message": msg, "type": ntype,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "resource_type": log.resource_type, "resource_id": log.resource_id,
                "user_email": log.user_email,
            })
        # Pending count
        result = await db.execute(select(Application).where(Application.state == "pending"))
        pending = result.scalars().all()
        if len(pending) > 0:
            notifications.insert(0, {
                "id": "pending-apps", "message": f"{len(pending)} application(s) awaiting review",
                "type": "warning", "timestamp": datetime.utcnow().isoformat(),
                "resource_type": "application", "resource_id": None, "user_email": None,
            })
    else:
        result = await db.execute(
            select(AuditLog).where(AuditLog.timestamp >= cutoff, AuditLog.resource_type == "application")
            .order_by(desc(AuditLog.timestamp)).limit(20)
        )
        logs = result.scalars().all()
        result2 = await db.execute(select(Application.id).where(Application.applicant_id == current_user.get("id")))
        user_app_ids = set(r[0] for r in result2.fetchall())
        for log in logs:
            if log.resource_id not in user_app_ids:
                continue
            details = log.details or {}
            ns = details.get("new_state", "")
            sn = details.get("system_name", "")
            if ns == "approved": msg, ntype = f"Your application for {sn} has been approved", "success"
            elif ns == "under_review": msg, ntype = f"{sn} is now under review", "info"
            elif ns == "conformant": msg, ntype = f"{sn} achieved ODDC conformance", "success"
            elif ns == "suspended": msg, ntype = f"{sn} has been suspended", "warning"
            else: msg, ntype = f"{sn or 'Application'} status: {ns.replace('_', ' ')}", "info"
            notifications.append({
                "id": log.id, "message": msg, "type": ntype,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "resource_type": log.resource_type, "resource_id": log.resource_id, "user_email": None,
            })
    return {"notifications": notifications[:20]}

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return HTMLResponse(content="""<!DOCTYPE html>
<html>
<head>
    <title>Sentinel Authority API</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='6' y='6' width='20' height='20' rx='5' fill='%235B4B8A' stroke='%239d8ccf' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='%239d8ccf'/></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@300;400;500&family=Source+Serif+4:opsz,wght@8..60,200;8..60,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        :root {
            --bg-deep: #2a2f3d;
            --bg-panel: rgba(255,255,255,0.05);
            --purple-primary: #5B4B8A;
            --purple-bright: #9d8ccf;
            --green: #5CD685;
            --amber: #D6A05C;
            --red: #D65C5C;
            --text-primary: rgba(255,255,255,0.94);
            --text-secondary: rgba(255,255,255,0.75);
            --text-tertiary: rgba(255,255,255,0.50);
            --border-glass: rgba(255,255,255,0.10);
        }
        
        * { box-sizing: border-box; }
        
        body { 
            background: var(--bg-deep); 
            margin: 0; 
            font-family: 'Inter', sans-serif;
            font-weight: 400;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            overflow-x: hidden;
        }
        
        /* Animated background gradients */
        .bg-gradient-1 {
            position: fixed; top: -15%; left: -5%; width: 600px; height: 600px;
            background: radial-gradient(circle, rgba(91,75,138,0.18) 0%, transparent 70%);
            animation: float1 20s ease-in-out infinite; pointer-events: none; z-index: 0;
        }
        .bg-gradient-2 {
            position: fixed; bottom: -25%; right: -10%; width: 800px; height: 800px;
            background: radial-gradient(circle, rgba(92,214,133,0.06) 0%, transparent 70%);
            animation: float2 25s ease-in-out infinite; pointer-events: none; z-index: 0;
        }
        .bg-gradient-3 {
            position: fixed; top: 40%; right: 15%; width: 400px; height: 400px;
            background: radial-gradient(circle, rgba(157,140,207,0.10) 0%, transparent 70%);
            animation: float3 15s ease-in-out infinite; pointer-events: none; z-index: 0;
        }
        
        /* Grid overlay */
        .grid-overlay {
            position: fixed; inset: 0; pointer-events: none; z-index: 0;
            background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), 
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 120px 120px;
            opacity: 0.2;
            mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%);
            -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%);
        }
        
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -40px) scale(1.05); } 66% { transform: translate(-30px, 30px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-50px, -50px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 40px); } }
        
        /* Custom header - matches dashboard */
        .custom-header {
            position: relative; z-index: 10;
            height: 64px;
            background: rgba(42,47,61,0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 0 24px;
            display: flex; align-items: center;
        }
        .header-spacer { flex: 1; }
        .header-links {
            display: flex; align-items: center; gap: 20px;
        }
        .header-link {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
            color: var(--text-tertiary); text-decoration: none;
            display: flex; align-items: center; gap: 6px;
            transition: color 0.2s ease;
        }
        .header-link:hover {
            color: var(--purple-bright);
        }
        
        /* Swagger UI overrides */
        .swagger-ui { 
            background: transparent !important;
            position: relative; z-index: 5;
        }
        .swagger-ui .wrapper { padding: 32px; max-width: 1400px; }
        
        /* Hide default topbar */
        .swagger-ui .topbar { display: none !important; }
        
        /* Info section */
        .swagger-ui .info { margin: 30px 0 40px; }
        .swagger-ui .info .title { 
            font-family: 'Source Serif 4', serif !important;
            font-size: 32px !important; font-weight: 200 !important;
            color: var(--text-primary) !important;
        }
        .swagger-ui .info .title small { 
            background: linear-gradient(135deg, var(--purple-primary), var(--purple-bright)) !important;
            border-radius: 8px !important; padding: 4px 12px !important;
            font-family: 'IBM Plex Mono', monospace !important;
            font-size: 10px !important; letter-spacing: 1px !important;
        }
        .swagger-ui .info .description, .swagger-ui .info p, .swagger-ui .info li {
            font-family: 'Inter', sans-serif !important;
            color: var(--text-secondary) !important;
            font-size: 14px !important; line-height: 1.7 !important;
        }
        .swagger-ui .info a { color: var(--purple-bright) !important; }
        
        /* Filter */
        .swagger-ui .filter-container { margin: 20px 0; }
        .swagger-ui input[type=text] {
            background: rgba(0,0,0,0.3) !important;
            border: 1px solid var(--border-glass) !important;
            border-radius: 12px !important;
            color: var(--text-primary) !important;
            font-family: 'IBM Plex Mono', monospace !important;
            padding: 14px 18px !important;
            transition: all 0.3s ease !important;
        }
        .swagger-ui input[type=text]:focus {
            border-color: rgba(157,140,207,0.5) !important;
            box-shadow: 0 0 0 3px rgba(157,140,207,0.1) !important;
            outline: none !important;
        }
        .swagger-ui input[type=text]::placeholder { color: var(--text-tertiary) !important; }
        
        /* Operation blocks */
        .swagger-ui .opblock-tag { 
            font-family: 'Source Serif 4', serif !important;
            font-size: 20px !important; font-weight: 400 !important;
            color: var(--text-primary) !important;
            border-bottom: 1px solid var(--border-glass) !important;
            padding: 16px 0 !important;
        }
        .swagger-ui .opblock-tag small { 
            font-family: 'Inter', sans-serif !important;
            color: var(--text-tertiary) !important;
        }
        .swagger-ui .opblock {
            background: var(--bg-panel) !important;
            border: 1px solid var(--border-glass) !important;
            border-radius: 16px !important;
            margin: 12px 0 !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            backdrop-filter: blur(12px) !important;
            overflow: hidden !important;
        }
        .swagger-ui .opblock .opblock-summary {
            padding: 14px 20px !important;
            border: none !important;
        }
        .swagger-ui .opblock .opblock-summary-method {
            font-family: 'IBM Plex Mono', monospace !important;
            font-size: 11px !important; font-weight: 500 !important;
            letter-spacing: 1px !important;
            padding: 8px 14px !important;
            border-radius: 8px !important;
            min-width: 70px !important;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: var(--purple-primary) !important; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: var(--green) !important; color: #1a1d24 !important; }
        .swagger-ui .opblock.opblock-put .opblock-summary-method { background: var(--amber) !important; color: #1a1d24 !important; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: var(--red) !important; }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #6B8E9F !important; }
        
        .swagger-ui .opblock .opblock-summary-path {
            font-family: 'IBM Plex Mono', monospace !important;
            color: var(--text-primary) !important;
            font-size: 13px !important;
        }
        .swagger-ui .opblock .opblock-summary-description {
            font-family: 'Inter', sans-serif !important;
            color: var(--text-secondary) !important;
            font-size: 13px !important;
        }
        
        .swagger-ui .opblock.opblock-get { border-color: rgba(91,75,138,0.3) !important; }
        .swagger-ui .opblock.opblock-post { border-color: rgba(92,214,133,0.3) !important; }
        .swagger-ui .opblock.opblock-put { border-color: rgba(214,160,92,0.3) !important; }
        .swagger-ui .opblock.opblock-delete { border-color: rgba(214,92,92,0.3) !important; }
        
        .swagger-ui .opblock-body { background: rgba(0,0,0,0.2) !important; }
        .swagger-ui .opblock-section-header {
            background: rgba(0,0,0,0.3) !important;
            border: none !important;
            box-shadow: none !important;
        }
        .swagger-ui .opblock-section-header h4 {
            font-family: 'IBM Plex Mono', monospace !important;
            font-size: 11px !important; letter-spacing: 1px !important;
            text-transform: uppercase !important;
            color: var(--text-tertiary) !important;
        }
        
        /* Parameters */
        .swagger-ui .parameters-col_name {
            font-family: 'IBM Plex Mono', monospace !important;
            color: var(--purple-bright) !important;
        }
        .swagger-ui .parameter__name { color: var(--text-primary) !important; }
        .swagger-ui .parameter__type { color: var(--text-tertiary) !important; }
        .swagger-ui .parameter__in { 
            font-family: 'IBM Plex Mono', monospace !important;
            color: var(--text-tertiary) !important;
            font-style: normal !important;
        }
        .swagger-ui table tbody tr td { 
            border-color: var(--border-glass) !important;
            color: var(--text-secondary) !important;
        }
        
        /* Buttons */
        .swagger-ui .btn {
            font-family: 'IBM Plex Mono', monospace !important;
            font-size: 11px !important; letter-spacing: 1px !important;
            text-transform: uppercase !important;
            border-radius: 10px !important;
            padding: 10px 18px !important;
            transition: all 0.3s ease !important;
        }
        .swagger-ui .btn.execute {
            background: linear-gradient(135deg, var(--purple-primary), #7B6BAA) !important;
            border: 1px solid var(--purple-bright) !important;
            color: #fff !important;
            box-shadow: 0 4px 15px rgba(91,75,138,0.3) !important;
        }
        .swagger-ui .btn.execute:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 20px rgba(91,75,138,0.4) !important;
        }
        .swagger-ui .btn.cancel {
            background: transparent !important;
            border: 1px solid var(--border-glass) !important;
            color: var(--text-tertiary) !important;
        }
        .swagger-ui .btn.authorize {
            background: rgba(92,214,133,0.15) !important;
            border: 1px solid rgba(92,214,133,0.4) !important;
            color: var(--green) !important;
        }
        .swagger-ui .btn.authorize svg { fill: var(--green) !important; }
        
        /* Response */
        .swagger-ui .responses-inner { background: transparent !important; }
        .swagger-ui .response-col_status {
            font-family: 'IBM Plex Mono', monospace !important;
            color: var(--green) !important;
        }
        .swagger-ui .response-col_description {
            color: var(--text-secondary) !important;
        }
        
        /* Models */
        .swagger-ui section.models {
            background: var(--bg-panel) !important;
            border: 1px solid var(--border-glass) !important;
            border-radius: 16px !important;
            backdrop-filter: blur(12px) !important;
        }
        .swagger-ui section.models h4 {
            font-family: 'Source Serif 4', serif !important;
            color: var(--text-primary) !important;
            border: none !important;
        }
        .swagger-ui .model-box {
            background: rgba(0,0,0,0.2) !important;
            border-radius: 12px !important;
        }
        .swagger-ui .model { color: var(--text-secondary) !important; }
        .swagger-ui .model-title { color: var(--purple-bright) !important; }
        .swagger-ui .prop-type { color: var(--green) !important; }
        
        /* Code */
        .swagger-ui .highlight-code, .swagger-ui .microlight {
            background: rgba(0,0,0,0.4) !important;
            border-radius: 12px !important;
            font-family: 'IBM Plex Mono', monospace !important;
        }
        .swagger-ui .microlight { color: var(--text-primary) !important; }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(157,140,207,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(157,140,207,0.5); }
        ::-webkit-scrollbar-thumb { background: var(--purple-primary); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--purple-bright); }
        
        /* Auth modal */
        .swagger-ui .dialog-ux .modal-ux {
            background: rgba(30,34,44,0.98) !important;
            border: 1px solid var(--border-glass) !important;
            border-radius: 20px !important;
            backdrop-filter: blur(20px) !important;
        }
        .swagger-ui .dialog-ux .modal-ux-header {
            border-color: var(--border-glass) !important;
        }
        .swagger-ui .dialog-ux .modal-ux-header h3 {
            font-family: 'Source Serif 4', serif !important;
            color: var(--text-primary) !important;
        }
        .swagger-ui .dialog-ux .modal-ux-content {
            color: var(--text-secondary) !important;
        }
        .swagger-ui .auth-container input[type=text] {
            background: rgba(0,0,0,0.3) !important;
            border: 1px solid var(--border-glass) !important;
            color: var(--text-primary) !important;
        }
        
        /* Misc text */
        .swagger-ui, .swagger-ui .info .title, .swagger-ui .scheme-container {
            background: transparent !important;
        }
        .swagger-ui label { color: var(--text-secondary) !important; }
        .swagger-ui select {
            background: rgba(0,0,0,0.3) !important;
            border: 1px solid var(--border-glass) !important;
            color: var(--text-primary) !important;
            border-radius: 8px !important;
        }
        
        /* Server dropdown */
        .swagger-ui .servers-title {
            font-family: 'IBM Plex Mono', monospace !important;
            color: var(--text-tertiary) !important;
        }
        .swagger-ui .servers > label select {
            padding: 10px 14px !important;
        }
        
        /* Loading */
        .swagger-ui .loading-container { 
            padding: 100px; 
            display: flex; 
            justify-content: center; 
        }
        .swagger-ui .loading-container .loading::before {
            border-color: var(--purple-bright) !important;
            border-top-color: transparent !important;
        }
    </style>
</head>
<body>
    <div class="bg-gradient-1"></div>
    <div class="bg-gradient-2"></div>
    <div class="bg-gradient-3"></div>
    <div class="grid-overlay"></div>
    
    <div class="custom-header">
        <div class="header-spacer"></div>
        <div class="header-links">
            <a href="https://sentinelauthority.org" class="header-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Main Site</a>
            <a href="https://app.sentinelauthority.org/verify" class="header-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Verify</a>
            <a href="https://app.sentinelauthority.org" class="header-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dashboard</a>
        </div>
    </div>
    
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
            defaultModelsExpandDepth: 0,
            displayRequestDuration: true,
        });
    </script>
</body>
</html>""")


# Start auto-evaluator background task
@app.on_event("startup")
async def start_auto_evaluator():
    # Auto-migrate: ensure email_preferences column exists
    try:
        from sqlalchemy import text
        from app.core.database import engine
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_preferences JSON"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS application_comments (
                id SERIAL PRIMARY KEY,
                application_id INTEGER REFERENCES applications(id),
                user_id INTEGER REFERENCES users(id),
                user_email VARCHAR(255),
                user_role VARCHAR(50),
                content TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_comments_app_id ON application_comments(application_id)"))
        logger.info('Migration: email_preferences column OK')
    except Exception as e:
        logger.warning(f'Migration check: {e}')

    import asyncio
    from app.services.auto_evaluator import run_auto_evaluator
    asyncio.create_task(run_auto_evaluator())
    
    # Start offline agent monitor
    from app.services.background_tasks import check_offline_agents_task
    from app.core.database import get_db
    asyncio.create_task(check_offline_agents_task(get_db))
    logger.info("Offline agent monitor started")

    # Start certificate expiry monitor
    from app.services.background_tasks import check_certificate_expiry_task
    asyncio.create_task(check_certificate_expiry_task())
    logger.info("Certificate expiry monitor started (checks every 6 hours)")
    logger.info("Auto-evaluator background task started")
