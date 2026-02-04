#!/usr/bin/env python3
"""
SENTINEL AUTHORITY — Certificate Expiry Cron Job
=================================================

Adds:
 1. check_certificate_expiry() function in background_tasks.py
    - Scans all CONFORMANT certificates
    - Sends 30-day warning email
    - Sends 7-day warning email
    - Auto-expires past-due certificates
    - Records actions in certificate history
 2. Startup hook in main.py to run every 6 hours

Usage: cd ~/Downloads/sentinel-authority && python3 patch_expiry_cron.py
"""

import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
BG_TASKS = os.path.join(BASE, 'backend', 'app', 'services', 'background_tasks.py')
MAIN_PY = os.path.join(BASE, 'backend', 'main.py')

print('═══════════════════════════════════════════════════════')
print('  SENTINEL AUTHORITY — Certificate Expiry Cron Job')
print('═══════════════════════════════════════════════════════\n')

patch_count = 0

# ═══════════════════════════════════════════════════════════
# PATCH 1: Add expiry check function to background_tasks.py
# ═══════════════════════════════════════════════════════════

print('── background_tasks.py ──')

if not os.path.exists(BG_TASKS):
    print('✗ background_tasks.py not found')
    sys.exit(1)

with open(BG_TASKS, 'r') as f:
    bg_code = f.read()

EXPIRY_FUNCTION = '''

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
                Certificate.state == CertificationState.CONFORMANT
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
                cert.state = CertificationState.EXPIRED
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
'''

if 'check_certificate_expiry' not in bg_code:
    bg_code += EXPIRY_FUNCTION
    with open(BG_TASKS, 'w') as f:
        f.write(bg_code)
    print('✓ Add check_certificate_expiry function')
    print('✓ Add check_certificate_expiry_task loop')
    print('✓ Add _already_warned dedup helper')
    print('✓ Add _get_certificate_owner helper')
    print('✓ Add auto-expire logic with email')
    patch_count += 5
else:
    print('⚠ check_certificate_expiry already exists')

# ═══════════════════════════════════════════════════════════
# PATCH 2: Wire expiry task into main.py startup
# ═══════════════════════════════════════════════════════════

print('\n── main.py ──')

if not os.path.exists(MAIN_PY):
    print('✗ main.py not found')
    sys.exit(1)

with open(MAIN_PY, 'r') as f:
    main_code = f.read()

STARTUP_HOOK = '''
    # Start certificate expiry monitor
    from app.services.background_tasks import check_certificate_expiry_task
    asyncio.create_task(check_certificate_expiry_task())
    logger.info("Certificate expiry monitor started (checks every 6 hours)")'''

if 'check_certificate_expiry_task' not in main_code:
    # Insert before the last logger.info in startup
    target = '    logger.info("Auto-evaluator background task started")'
    if target in main_code:
        main_code = main_code.replace(
            target,
            STARTUP_HOOK + '\n' + target
        )
        with open(MAIN_PY, 'w') as f:
            f.write(main_code)
        print('✓ Wire expiry task into startup')
        patch_count += 1
    else:
        # Try alternate insertion point
        alt_target = '    logger.info("Offline agent monitor started")'
        if alt_target in main_code:
            main_code = main_code.replace(
                alt_target,
                alt_target + '\n' + STARTUP_HOOK
            )
            with open(MAIN_PY, 'w') as f:
                f.write(main_code)
            print('✓ Wire expiry task into startup (alt insertion)')
            patch_count += 1
        else:
            print('⚠ Could not find insertion point in main.py')
else:
    print('⚠ Expiry task already wired into startup')

# ═══════════════════════════════════════════════════════════
# VERIFICATION
# ═══════════════════════════════════════════════════════════

print('\n── Verification ──')

with open(BG_TASKS, 'r') as f:
    bg_final = f.read()
with open(MAIN_PY, 'r') as f:
    main_final = f.read()

checks = [
    ('check_certificate_expiry function', 'async def check_certificate_expiry():' in bg_final),
    ('check_certificate_expiry_task loop', 'async def check_certificate_expiry_task():' in bg_final),
    ('6-hour interval', 'EXPIRY_CHECK_INTERVAL = 6 * 3600' in bg_final),
    ('30-day + 7-day warnings', 'EXPIRY_WARNING_DAYS = [30, 7]' in bg_final),
    ('Auto-expire past-due', "CertificationState.EXPIRED" in bg_final and "auto_expired" in bg_final),
    ('Dedup via history', '_already_warned' in bg_final),
    ('Certificate owner lookup', '_get_certificate_owner' in bg_final),
    ('Expired email to customer', 'Certificate Has Expired' in bg_final),
    ('Expired email to admin', 'Certificate Expired:' in bg_final),
    ('Warning uses existing template', 'send_certificate_expiry_warning' in bg_final),
    ('Startup hook in main.py', 'check_certificate_expiry_task' in main_final),
]

passed = 0
for name, ok in checks:
    print(f'  {"✓" if ok else "✗"} {name}')
    if ok:
        passed += 1

print(f'\n  {passed}/{len(checks)} checks passed · {patch_count} patches applied')
print('\n  git add -A && git commit -m "feat: certificate expiry cron job with 30/7-day warnings"')
