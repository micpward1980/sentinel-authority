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
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import init_db, get_db
from app.core.security import get_current_user
from fastapi import Depends
from app.api.routes import audit as audit_routes, auth, dashboard, applicants, cat72, certificates, verification, licensees, envelo, apikeys, envelo_boundaries, registry, users, documents, deploy, session_routes

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
    docs_url="/internal-docs",
    openapi_url=None,
    redoc_url=None,
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

# Request logging
from app.middleware.request_logging import RequestLoggingMiddleware
app.add_middleware(RequestLoggingMiddleware)

# API Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(session_routes.router, prefix="/api/auth", tags=["Session Management"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(applicants.router, prefix="/api/applications", tags=["Applicant Portal"])
app.include_router(cat72.router, prefix="/api/cat72", tags=["CAT-72 Console"])
app.include_router(certificates.router, prefix="/api/certificates", tags=["Certification Registry"])
app.include_router(verification.router, prefix="/api/verify", tags=["Public Verification"])
app.include_router(licensees.router, prefix="/api/licensees", tags=["Licensee Portal"])
app.include_router(envelo.router, prefix="/api/envelo", tags=["ENVELO Agent"])
app.include_router(envelo_boundaries.router, prefix="/api/envelo/boundaries", tags=["ENVELO Boundaries"])
app.include_router(apikeys.router, prefix="/api/apikeys", tags=["API Keys"])
app.include_router(registry.router, prefix="/api/registry", tags=["Registry"])
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
        
    }




# ═══ Notifications (derived from audit log) ═══

@app.get("/api/notifications", tags=["System"], summary="Get user notifications")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from sqlalchemy import select, desc
    from app.models.models import AuditLog, Application, User
    from datetime import timedelta
    
    user_result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user_obj = user_result.scalar_one_or_none()
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
                "user_email": log.user_email, "read": user_obj.notifications_read_at is not None and log.timestamp is not None and log.timestamp <= user_obj.notifications_read_at,
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
        result2 = await db.execute(select(Application.id).where(Application.applicant_id == int(current_user.get("sub"))))
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
                "resource_type": log.resource_type, "resource_id": log.resource_id, "user_email": None, "read": user_obj.notifications_read_at is not None and log.timestamp is not None and log.timestamp <= user_obj.notifications_read_at,
            })
    unread = sum(1 for n in notifications if not n.get("read", False))
    return {"notifications": notifications[:20], "unread_count": unread}

@app.post("/api/notifications/mark-read", tags=["System"], summary="Mark all notifications as read")
async def mark_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.models import User
    result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user = result.scalar_one_or_none()
    if user:
        user.notifications_read_at = datetime.utcnow()
        await db.commit()
    return {"message": "Notifications marked as read"}



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

    try:
        await conn.execute(text("ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32)"))
    except:
        pass
    try:
        await conn.execute(text("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE"))
    except:
        pass
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN totp_backup_codes TEXT"))
                print("Added totp_backup_codes column")
            except Exception:
                pass
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN notifications_read_at TIMESTAMP"))
                print("Added notifications_read_at column")
            except Exception:
                pass
            try:
                await conn.execute(text("ALTER TABLE audit_log ADD COLUMN prev_hash VARCHAR(64)"))
                print("Added prev_hash column to audit_log")
            except Exception:
                pass
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
