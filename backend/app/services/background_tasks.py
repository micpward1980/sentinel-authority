"""
Automatic Enforcement Background Tasks
- Monitors agent heartbeats and violation rates
- Auto-suspends/revokes certificates based on thresholds
- Sends notifications to customers and admin
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.models.models import (
    Certificate, CertificationState, EnveloSession, 
    TelemetryRecord, APIKey, User
)
import logging

logger = logging.getLogger(__name__)

# Thresholds
OFFLINE_WARNING_MINUTES = 5
OFFLINE_SUSPEND_HOURS = 24
OFFLINE_REVOKE_HOURS = 72
VIOLATION_RATE_SUSPEND_THRESHOLD = 0.20  # 20%
CHECK_INTERVAL_SECONDS = 300  # 5 minutes


async def check_offline_agents_task(get_db):
    """Background task that monitors agents and enforces compliance"""
    while True:
        try:
            await enforce_compliance()
        except Exception as e:
            logger.error(f"Enforcement task error: {e}")
        
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


async def enforce_compliance():
    """Main enforcement loop - checks all active sessions and enforces rules"""
    async with async_session_maker() as db:
        now = datetime.utcnow()
        
        # Get all active sessions with their certificates
        result = await db.execute(
            select(EnveloSession).where(EnveloSession.status == "active")
        )
        sessions = result.scalars().all()
        
        for session in sessions:
            try:
                await enforce_session_compliance(db, session, now)
            except Exception as e:
                logger.error(f"Error enforcing session {session.session_id}: {e}")
        
        await db.commit()


async def enforce_session_compliance(db: AsyncSession, session: EnveloSession, now: datetime):
    """Enforce compliance rules for a single session"""
    
    # Get the certificate
    if not session.certificate_id:
        return
    
    cert_result = await db.execute(
        select(Certificate).where(Certificate.id == session.certificate_id)
    )
    cert = cert_result.scalar_one_or_none()
    
    if not cert or cert.state in [CertificationState.REVOKED, CertificationState.EXPIRED]:
        return  # Already terminal state
    
    # Get user info for notifications
    api_key_result = await db.execute(
        select(APIKey).where(APIKey.id == session.api_key_id)
    )
    api_key = api_key_result.scalar_one_or_none()
    
    user = None
    if api_key:
        user_result = await db.execute(
            select(User).where(User.id == api_key.user_id)
        )
        user = user_result.scalar_one_or_none()
    
    # Check offline duration
    last_activity = session.last_heartbeat_at or session.last_telemetry_at or session.started_at
    offline_duration = now - last_activity
    offline_hours = offline_duration.total_seconds() / 3600
    
    # Check violation rate
    total_actions = (session.pass_count or 0) + (session.block_count or 0)
    violation_rate = (session.block_count or 0) / total_actions if total_actions > 100 else 0
    
    # === ENFORCEMENT RULES ===
    
    # Rule 1: Offline > 72 hours → AUTO-REVOKE
    if offline_hours >= OFFLINE_REVOKE_HOURS:
        if cert.state != CertificationState.REVOKED:
            await auto_revoke_certificate(
                db, cert, session, user,
                f"ENVELO Agent offline for {int(offline_hours)} hours (threshold: {OFFLINE_REVOKE_HOURS}h)"
            )
            return
    
    # Rule 2: Offline > 24 hours → AUTO-SUSPEND
    elif offline_hours >= OFFLINE_SUSPEND_HOURS:
        if cert.state == CertificationState.CONFORMANT:
            await auto_suspend_certificate(
                db, cert, session, user,
                f"ENVELO Agent offline for {int(offline_hours)} hours (threshold: {OFFLINE_SUSPEND_HOURS}h)"
            )
            return
    
    # Rule 3: Violation rate > 20% → AUTO-SUSPEND
    if violation_rate >= VIOLATION_RATE_SUSPEND_THRESHOLD:
        if cert.state == CertificationState.CONFORMANT:
            await auto_suspend_certificate(
                db, cert, session, user,
                f"Violation rate {violation_rate*100:.1f}% exceeds threshold ({VIOLATION_RATE_SUSPEND_THRESHOLD*100}%)"
            )
            return
    
    # Rule 4: Offline > 5 minutes → WARNING (notification only, handled elsewhere)
    # This is handled by the existing notification system


async def auto_suspend_certificate(
    db: AsyncSession, 
    cert: Certificate, 
    session: EnveloSession,
    user: User,
    reason: str
):
    """Automatically suspend a certificate"""
    logger.warning(f"AUTO-SUSPENDING certificate {cert.certificate_number}: {reason}")
    
    cert.state = CertificationState.SUSPENDED
    history = cert.history or []
    history.append({
        "action": "auto_suspended",
        "timestamp": datetime.utcnow().isoformat(),
        "by": "SYSTEM",
        "reason": reason,
        "session_id": session.session_id
    })
    cert.history = history
    
    # Update session status
    session.status = "suspended"
    
    # Send notifications
    try:
        from app.services.email_service import send_email, ADMIN_EMAIL
        
        # Notify customer
        if user and user.email:
            await send_email(
                user.email,
                f"⚠️ CERTIFICATE SUSPENDED: {cert.system_name}",
                f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <h2 style="color: #d65c5c;">Certificate Automatically Suspended</h2>
                    
                    <div style="background: #fff3f3; border-left: 4px solid #d65c5c; padding: 16px; margin: 24px 0;">
                        <p style="margin: 0;"><strong>Reason:</strong> {reason}</p>
                    </div>
                    
                    <p><strong>Certificate:</strong> {cert.certificate_number}</p>
                    <p><strong>System:</strong> {cert.system_name}</p>
                    <p><strong>Organization:</strong> {cert.organization_name}</p>
                    
                    <h3>What This Means</h3>
                    <p>Your ODDC certification is currently <strong>not valid</strong>. Third parties checking your certification status will see "SUSPENDED".</p>
                    
                    <h3>To Reinstate</h3>
                    <ol>
                        <li>Restore ENVELO Agent operation</li>
                        <li>Ensure agent is reporting telemetry</li>
                        <li>Contact Sentinel Authority for reinstatement review</li>
                    </ol>
                    
                    <p style="color: #666; margin-top: 32px;">
                        Contact: info@sentinelauthority.org
                    </p>
                </div>
                """
            )
        
        # Notify admin
        await send_email(
            ADMIN_EMAIL,
            f"🔴 AUTO-SUSPEND: {cert.organization_name} - {cert.system_name}",
            f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #d65c5c;">Certificate Auto-Suspended</h2>
                
                <p><strong>Certificate:</strong> {cert.certificate_number}</p>
                <p><strong>Organization:</strong> {cert.organization_name}</p>
                <p><strong>System:</strong> {cert.system_name}</p>
                <p><strong>Reason:</strong> {reason}</p>
                <p><strong>Session ID:</strong> {session.session_id}</p>
                <p><strong>Customer Email:</strong> {user.email if user else 'Unknown'}</p>
                
                <p style="margin-top: 24px;">Customer has been notified. Review in dashboard.</p>
            </div>
            """
        )
    except Exception as e:
        logger.error(f"Failed to send suspension notification: {e}")


async def auto_revoke_certificate(
    db: AsyncSession, 
    cert: Certificate, 
    session: EnveloSession,
    user: User,
    reason: str
):
    """Automatically revoke a certificate - this is permanent"""
    logger.warning(f"AUTO-REVOKING certificate {cert.certificate_number}: {reason}")
    
    cert.state = CertificationState.REVOKED
    history = cert.history or []
    history.append({
        "action": "auto_revoked",
        "timestamp": datetime.utcnow().isoformat(),
        "by": "SYSTEM",
        "reason": reason,
        "session_id": session.session_id
    })
    cert.history = history
    
    # Update session status
    session.status = "revoked"
    session.ended_at = datetime.utcnow()
    
    # Send notifications
    try:
        from app.services.email_service import send_email, ADMIN_EMAIL
        
        # Notify customer
        if user and user.email:
            await send_email(
                user.email,
                f"🔴 CERTIFICATE REVOKED: {cert.system_name}",
                f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <h2 style="color: #8b0000;">Certificate Permanently Revoked</h2>
                    
                    <div style="background: #fff0f0; border-left: 4px solid #8b0000; padding: 16px; margin: 24px 0;">
                        <p style="margin: 0;"><strong>Reason:</strong> {reason}</p>
                    </div>
                    
                    <p><strong>Certificate:</strong> {cert.certificate_number}</p>
                    <p><strong>System:</strong> {cert.system_name}</p>
                    <p><strong>Organization:</strong> {cert.organization_name}</p>
                    
                    <h3>What This Means</h3>
                    <p>Your ODDC certification has been <strong>permanently revoked</strong>. This action cannot be reversed.</p>
                    <p>To obtain certification again, you must submit a new application and complete a full CAT-72 assessment.</p>
                    
                    <p style="color: #666; margin-top: 32px;">
                        Contact: info@sentinelauthority.org
                    </p>
                </div>
                """
            )
        
        # Notify admin
        await send_email(
            ADMIN_EMAIL,
            f"⛔ AUTO-REVOKE: {cert.organization_name} - {cert.system_name}",
            f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #8b0000;">Certificate Auto-Revoked</h2>
                
                <p><strong>Certificate:</strong> {cert.certificate_number}</p>
                <p><strong>Organization:</strong> {cert.organization_name}</p>
                <p><strong>System:</strong> {cert.system_name}</p>
                <p><strong>Reason:</strong> {reason}</p>
                <p><strong>Session ID:</strong> {session.session_id}</p>
                <p><strong>Customer Email:</strong> {user.email if user else 'Unknown'}</p>
                
                <p style="margin-top: 24px; color: #8b0000;"><strong>This is permanent. Customer must re-apply for new certification.</strong></p>
            </div>
            """
        )
    except Exception as e:
        logger.error(f"Failed to send revocation notification: {e}")
