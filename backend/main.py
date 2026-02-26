from app.api.routes.surveillance import router as surveillance_router
import time
from app.api.routes import ai_review
"""
Sentinel Authority Platform API
Unified certification platform for autonomous systems operating under ENVELO
"""

import logging
import hashlib
import os
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from chat import router as chat_router
from app.api.routes.content import router as content_router
from app.services.content_scraper import scraper_loop
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi.responses import HTMLResponse

from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import init_db, get_db
from app.core.security import get_current_user
from fastapi import Depends
from app.api.routes import audit as audit_routes, auth, dashboard, applicants, cat72, certificates, verification, licensees, envelo, apikeys, envelo_boundaries, registry, users, documents, deploy, session_routes, webhooks

# Logging setup

# Error monitoring
import sentry_sdk
sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.environ.get("RAILWAY_ENVIRONMENT", "production"),
        traces_sample_rate=0.1,
        enable_tracing=True,
    )

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sentinel Authority Platform...")
    await init_db()
    logger.info("Database initialized")
    import asyncio as _asyncio; _asyncio.create_task(scraper_loop())
    logger.info("Content scraper started")
    
    # Organization migration
    from app.core.database import engine
    from sqlalchemy import text as raw_text
    async with engine.begin() as conn:
        try:
            await conn.execute(raw_text("""
                CREATE TABLE IF NOT EXISTS organizations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            for tbl, col in [("users", "organization_id"), ("applications", "organization_id"), ("api_keys", "organization_id")]:
                try:
                    await conn.execute(raw_text(f"ALTER TABLE {tbl} ADD COLUMN {col} INTEGER REFERENCES organizations(id)"))
                except Exception:
                    pass
            await conn.commit()
        except Exception as e:
            logger.warning(f"Org table migration: {e}")
        
            logger.info("Org schema migration complete")
        except Exception as e:
            logger.warning(f"Org schema note: {e}")
    
    # Backfill in separate connection
    async with engine.begin() as conn2:
        try:
            rows = await conn2.execute(raw_text(
                "SELECT DISTINCT organization FROM users WHERE organization IS NOT NULL AND organization != '' AND organization_id IS NULL"
            ))
            for row in rows:
                org_name = row[0]
                slug = org_name.lower().strip().replace(' ', '-').replace(',', '').replace('.', '')
                await conn2.execute(raw_text(
                    "INSERT INTO organizations (name, slug) VALUES (:name, :slug) ON CONFLICT (slug) DO NOTHING"
                ), {"name": org_name, "slug": slug})
                org_result = await conn2.execute(raw_text("SELECT id FROM organizations WHERE slug = :slug"), {"slug": slug})
                org_row = org_result.first()
                if org_row:
                    await conn2.execute(raw_text(
                        "UPDATE users SET organization_id = :oid WHERE organization = :oname AND organization_id IS NULL"
                    ), {"oid": org_row[0], "oname": org_name})
            await conn2.commit()
            logger.info("User org backfill complete")
        except Exception as e:
            logger.warning(f"User backfill: {e}")
    

    # Tamper-proof audit log: DB triggers to prevent UPDATE/DELETE
    async with engine.begin() as tpconn:
        try:
            await tpconn.execute(raw_text("""
                CREATE OR REPLACE FUNCTION prevent_audit_modification()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted. This is a tamper-proof log.';
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;
            """))
            await tpconn.execute(raw_text("DROP TRIGGER IF EXISTS no_audit_update ON audit_log"))
            await tpconn.execute(raw_text("CREATE TRIGGER no_audit_update BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()"))
            await tpconn.execute(raw_text("DROP TRIGGER IF EXISTS no_audit_delete ON audit_log"))
            await tpconn.execute(raw_text("CREATE TRIGGER no_audit_delete BEFORE DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()"))
            # Create anchor table for periodic hash checkpoints
            await tpconn.execute(raw_text("""
                CREATE TABLE IF NOT EXISTS audit_anchors (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_audit_id INTEGER NOT NULL,
                    chain_hash VARCHAR(64) NOT NULL,
                    entry_count INTEGER NOT NULL,
                    anchor_signature VARCHAR(128) NOT NULL
                )
            """))
            # Protect anchors too
            await tpconn.execute(raw_text("""
                CREATE OR REPLACE FUNCTION prevent_anchor_modification()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Audit anchors cannot be modified or deleted.';
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;
            """))
            await tpconn.execute(raw_text("DROP TRIGGER IF EXISTS no_anchor_update ON audit_anchors"))
            await tpconn.execute(raw_text("CREATE TRIGGER no_anchor_update BEFORE UPDATE ON audit_anchors FOR EACH ROW EXECUTE FUNCTION prevent_anchor_modification()"))
            await tpconn.execute(raw_text("DROP TRIGGER IF EXISTS no_anchor_delete ON audit_anchors"))
            await tpconn.execute(raw_text("CREATE TRIGGER no_anchor_delete BEFORE DELETE ON audit_anchors FOR EACH ROW EXECUTE FUNCTION prevent_anchor_modification()"))
            await tpconn.commit()
            logger.info("Tamper-proof audit triggers installed")
        except Exception as e:
            logger.warning(f"Audit trigger setup: {e}")
    # Auto-create daily audit anchor
    async with engine.begin() as anchor_conn:
        try:
            # Check if anchor exists for today
            last_anchor = await anchor_conn.execute(raw_text(
                "SELECT created_at FROM audit_anchors ORDER BY id DESC LIMIT 1"
            ))
            last_row = last_anchor.first()
            need_anchor = True
            if last_row and last_row[0]:
                if (datetime.utcnow() - last_row[0]) < timedelta(hours=24):
                    need_anchor = False
            
            if need_anchor:
                latest = await anchor_conn.execute(raw_text(
                    "SELECT id, log_hash FROM audit_log ORDER BY id DESC LIMIT 1"
                ))
                latest_row = latest.first()
                if latest_row:
                    count_result = await anchor_conn.execute(raw_text("SELECT COUNT(*) FROM audit_log"))
                    total = count_result.scalar()
                    import hmac as hmac_mod
                    secret = os.environ.get("SECRET_KEY", "sentinel-authority-secret")
                    sig_payload = f"{latest_row[0]}:{latest_row[1]}:{total}:{datetime.utcnow().isoformat()}"
                    signature = hmac_mod.new(secret.encode(), sig_payload.encode(), hashlib.sha256).hexdigest()
                    await anchor_conn.execute(raw_text(
                        "INSERT INTO audit_anchors (last_audit_id, chain_hash, entry_count, anchor_signature) VALUES (:aid, :hash, :count, :sig)"
                    ), {"aid": latest_row[0], "hash": latest_row[1], "count": total, "sig": signature})
                    await anchor_conn.commit()
                    logger.info(f"Daily audit anchor created at entry #{latest_row[0]}")
                else:
                    logger.info("No audit entries yet, skipping anchor")
            else:
                logger.info("Recent anchor exists, skipping")
        except Exception as e:
            logger.warning(f"Auto-anchor: {e}")


    # Schema migrations (idempotent)
    schema_migrations = [
        "ALTER TABLE envelo_sessions ADD COLUMN session_type VARCHAR(20) DEFAULT 'production'",
        "ALTER TABLE envelo_sessions ADD COLUMN is_demo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE envelo_sessions ADD COLUMN metadata_json JSON DEFAULT NULL",
        "ALTER TABLE envelo_sessions ADD COLUMN organization_name VARCHAR(255)",
        "ALTER TABLE envelo_sessions ADD COLUMN system_name VARCHAR(255)",
        "ALTER TABLE certificates ADD COLUMN is_demo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE certificates ADD COLUMN metadata_json JSON DEFAULT NULL",
        "ALTER TABLE certificates ADD COLUMN suspended_at TIMESTAMP",
        "ALTER TABLE certificates ADD COLUMN suspension_reason TEXT",
        "ALTER TABLE certificates ADD COLUMN suspended_by VARCHAR(100)",
        "ALTER TABLE certificates ADD COLUMN reinstated_at TIMESTAMP",
        "ALTER TABLE certificates ADD COLUMN reinstatement_reason TEXT",
    ]
    for mig in schema_migrations:
        async with engine.begin() as mig_conn:
            try:
                await mig_conn.execute(raw_text(mig))
                logger.info(f"Migration OK: {mig[:60]}")
            except Exception:
                pass  # column already exists


    # Create surveillance_alerts table
    async with engine.begin() as surv_conn:
        try:
            await surv_conn.execute(raw_text("""
                CREATE TABLE IF NOT EXISTS surveillance_alerts (
                    id SERIAL PRIMARY KEY,
                    alert_id VARCHAR(50) UNIQUE NOT NULL,
                    alert_type VARCHAR(50) NOT NULL,
                    severity VARCHAR(20) NOT NULL,
                    certificate_id VARCHAR(100),
                    session_id VARCHAR(100),
                    message TEXT,
                    details JSON DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW(),
                    acknowledged BOOLEAN DEFAULT FALSE,
                    acknowledged_at TIMESTAMP,
                    acknowledged_by VARCHAR(100)
                )
            """))
            await surv_conn.execute(raw_text("""
                CREATE INDEX IF NOT EXISTS idx_surv_alerts_cert ON surveillance_alerts(certificate_id)
            """))
            await surv_conn.execute(raw_text("""
                CREATE INDEX IF NOT EXISTS idx_surv_alerts_sev ON surveillance_alerts(severity)
            """))
            await surv_conn.commit()
            logger.info("Surveillance alerts table ready")
        except Exception as e:
            logger.warning(f"Surveillance alerts table: {e}")

    # Start background tasks
    import asyncio

    try:
        from app.services.auto_evaluator import run_auto_evaluator
        asyncio.create_task(run_auto_evaluator())
        logger.info("Auto evaluator started")
    except Exception as e:
        logger.warning(f"Auto evaluator failed to start: {e}")

    try:
        from app.services.background_tasks import check_offline_agents_task
        from app.core.database import get_db
        asyncio.create_task(check_offline_agents_task(get_db))
        logger.info("Offline agent monitor started")
    except Exception as e:
        logger.warning(f"Offline agent monitor failed to start: {e}")

    try:
        from app.services.background_tasks import check_certificate_expiry_task
        asyncio.create_task(check_certificate_expiry_task())
        logger.info("Certificate expiry monitor started")
    except Exception as e:
        logger.warning(f"Certificate expiry monitor failed to start: {e}")

    try:
        from app.services.background_tasks import demo_session_ticker, auto_suspend_offline
        asyncio.create_task(demo_session_ticker())
        asyncio.create_task(auto_suspend_offline())
        logger.info("Auto-suspend monitor started (checks every hour)")
        logger.info("Demo session ticker started")
    except Exception as e:
        logger.warning(f"Demo ticker failed to start: {e}")

    try:
        from app.services.background_tasks import cat72_auto_evaluator
        asyncio.create_task(cat72_auto_evaluator())
        logger.info("CAT-72 auto-evaluator started (checks every 60s)")
    except Exception as e:
        logger.warning(f"CAT-72 auto-evaluator failed to start: {e}")


    # Start surveillance engine
    from app.surveillance import start_surveillance
    from app.core.database import AsyncSessionLocal
    start_surveillance(AsyncSessionLocal)
    logger.info("Surveillance engine started")
    # Reload surveillance state from DB (persist across restarts)
    try:
        from app.surveillance import get_surveillance_state
        surv_state = get_surveillance_state()
        async with AsyncSessionLocal() as reload_db:
            from sqlalchemy import select as sel, text as raw_t
            from app.models.models import EnveloSession, Certificate
            # Reload active sessions
            active = await reload_db.execute(
                sel(EnveloSession).where(EnveloSession.status == "active")
            )
            reloaded = 0
            for session in active.scalars().all():
                cert_num = None
                if session.certificate_id:
                    cert_r = await reload_db.execute(
                        sel(Certificate).where(Certificate.id == session.certificate_id)
                    )
                    cert = cert_r.scalar_one_or_none()
                    cert_num = cert.certificate_number if cert else None
                if cert_num and session.last_heartbeat_at:
                    surv_state.record_heartbeat(
                        session_id=session.session_id,
                        certificate_id=cert_num,
                        stats={"pass": session.pass_count or 0, "block": session.block_count or 0},
                    )
                    reloaded += 1
            # Reload suspended certs
            suspended = await reload_db.execute(
                sel(Certificate).where(Certificate.state == "suspended")
            )
            for cert in suspended.scalars().all():
                if cert.certificate_number:
                    surv_state.suspended_certs.add(cert.certificate_number)
            # Reload unacknowledged alerts
            try:
                alert_rows = await reload_db.execute(raw_t(
                    "SELECT alert_id, alert_type, severity, certificate_id, session_id, message, details, created_at, acknowledged, acknowledged_at, acknowledged_by FROM surveillance_alerts ORDER BY id DESC LIMIT 200"
                ))
                from app.surveillance import SurveillanceAlert, AlertType, AlertSeverity
                for row in alert_rows:
                    try:
                        alert = SurveillanceAlert(
                            id=row[0], alert_type=AlertType(row[1]), severity=AlertSeverity(row[2]),
                            certificate_id=row[3], session_id=row[4], message=row[5],
                            details=row[6] or {}, created_at=row[7],
                            acknowledged=row[8] or False, acknowledged_at=row[9], acknowledged_by=row[10],
                        )
                        surv_state.alerts.append(alert)
                    except Exception:
                        pass
            except Exception:
                pass  # Table may not have data yet
        logger.info(f"Surveillance state reloaded: {reloaded} sessions, {len(surv_state.suspended_certs)} suspended certs, {len(surv_state.alerts)} alerts")
    except Exception as e:
        logger.warning(f"Surveillance reload: {e}")
    reload_surveillance_from_db = True


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
    openapi_url="/internal-openapi.json",
    redoc_url=None,
    openapi_tags=OPENAPI_TAGS,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class ErrorCatchMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            import logging
            logging.getLogger("sentinel.errors").exception(f"Unhandled error: {e}")
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Request logging (innermost — runs closest to route handlers)
from app.middleware.request_logging import RequestLoggingMiddleware
app.add_middleware(RequestLoggingMiddleware)

# Error catch (middle — catches unhandled exceptions)
app.add_middleware(ErrorCatchMiddleware)

# CORS (outermost — added last so it always adds headers, even on 404/500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# API Routes
app.include_router(chat_router)
app.include_router(content_router)
# ── v1 canonical routes ───────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(session_routes.router, prefix="/api/v1/auth", tags=["Session Management"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(applicants.router, prefix="/api/v1/applications", tags=["Applicant Portal"])
app.include_router(cat72.router, prefix="/api/v1/cat72", tags=["CAT-72 Console"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["Certification Registry"])
app.include_router(verification.router, prefix="/api/v1/verify", tags=["Public Verification"])
app.include_router(licensees.router, prefix="/api/v1/licensees", tags=["Licensee Portal"])
app.include_router(envelo.router, prefix="/api/v1/envelo", tags=["ENVELO Interlock"])
app.include_router(envelo_boundaries.router, prefix="/api/v1/envelo/boundaries", tags=["ENVELO Boundaries"])
app.include_router(apikeys.router, prefix="/api/v1/apikeys", tags=["API Keys"])
app.include_router(registry.router, prefix="/api/v1/registry", tags=["Registry"])
app.include_router(users.router, prefix="/api/v1/users", tags=["User Management"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(deploy.router, prefix="/api/v1", tags=["One-Command Deploy"])
app.include_router(audit_routes.router, prefix="/api/v1/audit", tags=["Audit Log"])
app.include_router(ai_review.router, prefix="/api/v1", tags=["AI Review"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])

# ── Legacy unversioned routes (backward compat — deprecated) ──────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(session_routes.router, prefix="/api/auth", tags=["Session Management"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(applicants.router, prefix="/api/applications", tags=["Applicant Portal"])
app.include_router(cat72.router, prefix="/api/cat72", tags=["CAT-72 Console"])
app.include_router(certificates.router, prefix="/api/certificates", tags=["Certification Registry"])
app.include_router(verification.router, prefix="/api/verify", tags=["Public Verification"])
app.include_router(licensees.router, prefix="/api/licensees", tags=["Licensee Portal"])
app.include_router(envelo.router, prefix="/api/envelo", tags=["ENVELO Interlock"])
app.include_router(envelo_boundaries.router, prefix="/api/envelo/boundaries", tags=["ENVELO Boundaries"])
app.include_router(apikeys.router, prefix="/api/apikeys", tags=["API Keys"])
app.include_router(registry.router, prefix="/api/registry", tags=["Registry"])
app.include_router(users.router, prefix="/api/users", tags=["User Management"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(deploy.router, prefix="/api", tags=["One-Command Deploy"])
app.include_router(audit_routes.router, prefix="/api/audit", tags=["Audit Log"])
app.include_router(ai_review.router, prefix="/api", tags=["AI Review"])
app.include_router(surveillance_router, prefix="/api/surveillance", tags=["Surveillance"])




# ── Global API rate limit: 200 req/min per IP ─────────────────────────────────
from collections import defaultdict
_global_rate: dict = defaultdict(list)

@app.middleware("http")
async def global_rate_limit(request, call_next):
    if request.url.path.startswith("/api/"):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        hits = [t for t in _global_rate[ip] if now - t < 60]
        if len(hits) >= 200:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded: 200 requests/minute"})
        hits.append(now)
        _global_rate[ip] = hits
    return await call_next(request)

@app.middleware("http")
async def deprecation_header(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/") and not path.startswith("/api/v1/") and not path.startswith("/api/v"):
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "Sat, 01 Jan 2027 00:00:00 GMT"
        response.headers["Link"] = f'<{path.replace("/api/", "/api/v1/")}>; rel="successor-version"'
    return response

@app.get("/health", tags=["System"], summary="Health check")
@app.get("/api/v1/health", tags=["System"], summary="Health check v1")
async def health_check():
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    db_ok = False
    start = time.time()
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass
    latency_ms = round((time.time() - start) * 1000)
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "sentinel-authority",
        "version": "1.0.0",
        "database": "ok" if db_ok else "error",
        "db_latency_ms": latency_ms,
    }


@app.get("/", tags=["System"], summary="Service info")
async def root():
    return {
        "name": "Sentinel Authority Platform",
        "version": "1.0.0",
        "framework": "ENVELO",
        
    }

@app.get("/robots.txt", tags=["System"], include_in_schema=False)
async def robots_txt():
    from starlette.responses import PlainTextResponse
    return PlainTextResponse(
        "User-agent: *\nDisallow: /api/\nDisallow: /admin/\nAllow: /health\n"
    )


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)





# ═══ Notifications (derived from audit log) ═══

@app.get("/api/notifications", tags=["System"], summary="Get user notifications")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from sqlalchemy import select, desc
    from app.models.models import AuditLog, Application, User
    
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




@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "healthy"}