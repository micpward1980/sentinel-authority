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
    
    if not cert or cert.state in ["revoked", "expired"]:
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
        if cert.state != "revoked":
            await auto_revoke_certificate(
                db, cert, session, user,
                f"ENVELO Agent offline for {int(offline_hours)} hours (threshold: {OFFLINE_REVOKE_HOURS}h)"
            )
            return
    
    # Rule 2: Offline > 24 hours → AUTO-SUSPEND
    elif offline_hours >= OFFLINE_SUSPEND_HOURS:
        if cert.state == "conformant":
            await auto_suspend_certificate(
                db, cert, session, user,
                f"ENVELO Agent offline for {int(offline_hours)} hours (threshold: {OFFLINE_SUSPEND_HOURS}h)"
            )
            return
    
    # Rule 3: Violation rate > 20% → AUTO-SUSPEND
    if violation_rate >= VIOLATION_RATE_SUSPEND_THRESHOLD:
        if cert.state == "conformant":
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
    
    cert.state = "suspended"
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
    
    cert.state = "revoked"
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


# ═══════════════════════════════════════════════════════════
# Certificate Expiry Monitor
# ═══════════════════════════════════════════════════════════

EXPIRY_CHECK_INTERVAL = 6 * 3600  # 6 hours
EXPIRY_WARNING_DAYS = [30, 7]  # Send warnings at these thresholds


async def check_certificate_expiry_task():
    """Background task that checks for expiring certificates"""
    while True:
        try:
            await check_certificate_expiry()
        except Exception as e:
            logger.error(f"Certificate expiry check error: {e}")
        
        await asyncio.sleep(EXPIRY_CHECK_INTERVAL)


async def check_certificate_expiry():
    """Scan all active certificates and handle expiry warnings + auto-expiration"""
    async with async_session_maker() as db:
        now = datetime.utcnow()
        
        # Get all conformant certificates
        result = await db.execute(
            select(Certificate).where(
                Certificate.state == "conformant"
            )
        )
        certificates = result.scalars().all()
        
        expired_count = 0
        warned_count = 0
        
        for cert in certificates:
            if not cert.expires_at:
                continue
            
            days_remaining = (cert.expires_at - now).days
            
            # === AUTO-EXPIRE past-due certificates ===
            if days_remaining <= 0:
                cert.state = "expired"
                history = cert.history or []
                history.append({
                    "action": "auto_expired",
                    "timestamp": now.isoformat(),
                    "by": "SYSTEM",
                    "reason": f"Certificate expired on {cert.expires_at.strftime('%Y-%m-%d')}"
                })
                cert.history = history
                expired_count += 1
                
                # Get user email for notification
                user = await _get_certificate_owner(db, cert)
                if user and user.email:
                    try:
                        from app.services.email_service import send_email, ADMIN_EMAIL
                        await send_email(
                            user.email,
                            f"🔴 Certificate Expired: {cert.certificate_number}",
                            f"""
                            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                                <div style="background: #5B4B8A; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                                    <h1 style="color: white; margin: 0; font-size: 18px;">SENTINEL AUTHORITY</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px;">
                                    <h2 style="color: #D65C5C;">Certificate Has Expired</h2>
                                    <p>Your ODDC certification has expired and is no longer valid.</p>
                                    <p><strong>Certificate:</strong> {cert.certificate_number}<br>
                                    <strong>System:</strong> {cert.system_name}<br>
                                    <strong>Organization:</strong> {cert.organization_name}<br>
                                    <strong>Expired:</strong> {cert.expires_at.strftime('%B %d, %Y')}</p>
                                    <p>Third parties verifying your certification will now see <strong>EXPIRED</strong>.</p>
                                    <p>To renew, contact us to schedule a new CAT-72 assessment.</p>
                                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                    <p style="font-size: 12px; color: #666;">Contact: info@sentinelauthority.org</p>
                                </div>
                            </div>
                            """
                        )
                        await send_email(
                            ADMIN_EMAIL,
                            f"Certificate Expired: {cert.certificate_number} ({cert.organization_name})",
                            f"<p><strong>{cert.certificate_number}</strong> for {cert.organization_name} - {cert.system_name} has expired.</p>"
                        )
                    except Exception as e:
                        logger.error(f"Failed to send expiry notification for {cert.certificate_number}: {e}")
                
                logger.warning(f"AUTO-EXPIRED certificate {cert.certificate_number} ({cert.organization_name})")
                continue
            
            # === SEND WARNINGS at 30 and 7 day thresholds ===
            for threshold in EXPIRY_WARNING_DAYS:
                # Only send if we're within the window (threshold to threshold-1 days)
                # This prevents re-sending every 6 hours
                if days_remaining == threshold or (
                    days_remaining <= threshold and 
                    not _already_warned(cert, threshold)
                ):
                    user = await _get_certificate_owner(db, cert)
                    if user and user.email:
                        try:
                            from app.services.email_service import send_certificate_expiry_warning
                            await send_certificate_expiry_warning(
                                user.email,
                                cert.system_name,
                                cert.certificate_number,
                                days_remaining
                            )
                            warned_count += 1
                        except Exception as e:
                            logger.error(f"Failed to send expiry warning for {cert.certificate_number}: {e}")
                    
                    # Record warning in history to prevent re-sending
                    history = cert.history or []
                    history.append({
                        "action": f"expiry_warning_{threshold}d",
                        "timestamp": now.isoformat(),
                        "by": "SYSTEM",
                        "days_remaining": days_remaining
                    })
                    cert.history = history
                    
                    logger.info(f"Expiry warning sent for {cert.certificate_number}: {days_remaining} days remaining")
                    break  # Only send one warning per check
        
        await db.commit()
        
        if expired_count or warned_count:
            logger.info(f"Expiry check complete: {expired_count} expired, {warned_count} warnings sent")


def _already_warned(cert, threshold_days):
    """Check if we already sent a warning for this threshold"""
    history = cert.history or []
    action_key = f"expiry_warning_{threshold_days}d"
    return any(h.get("action") == action_key for h in history)


async def _get_certificate_owner(db, cert):
    """Find the user who owns this certificate"""
    if not cert.applicant_id:
        return None
    try:
        result = await db.execute(
            select(User).where(User.id == cert.applicant_id)
        )
        return result.scalar_one_or_none()
    except Exception:
        return None


async def demo_session_ticker():
    """Tick demo sessions every 15s to simulate live telemetry."""
    import random
    from sqlalchemy import select, text
    from app.core.database import AsyncSessionLocal
    from app.models.models import EnveloSession

    DEMO_IDS = [
        '88dd4e8c18cc46d6b71c0440a99b71cd',
        '316e05b066474399bc085497da10cf5d',
        '32af8699f65e45a189a0f1163125d73c',
        '4f9a9ea698dc4fe59f12b97d3d48d692',
        '26346890eef9442ca4c868a40afda40f',
        '78700dbda0ed4573b47ede666850b253',
        '81c7db2674ad4727ac9b8aba99bc5b07',
    ]

    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(EnveloSession).where(EnveloSession.session_id.in_(DEMO_IDS))
                )
                sessions = result.scalars().all()
                for s in sessions:
                    actions = random.randint(1, 5)
                    passed = actions if random.random() > 0.02 else actions - 1
                    blocked = actions - passed
                    s.pass_count = (s.pass_count or 0) + passed
                    s.block_count = (s.block_count or 0) + blocked
                    s.last_heartbeat_at = __import__('datetime').datetime.utcnow()
                    s.is_online = True
                await db.commit()
        except Exception as e:
            print(f"Demo ticker error: {e}")
        await __import__('asyncio').sleep(15)
