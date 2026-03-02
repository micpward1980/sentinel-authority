"""
Email Notification Service
Uses Resend for transactional emails
"""

import httpx
import os
from typing import Optional

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@sentinelauthority.org")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "info@sentinelauthority.org")


# ═══ Email Preference Guard ═══

async def should_send_email(user_email: str, category: str) -> bool:
    """Check if user has opted in to this email category.
    Returns True by default (fail-open for transactional mail)."""
    try:
        from app.core.database import async_session_maker
        from app.models.models import User
        from sqlalchemy import select
        async with async_session_maker() as db:
            result = await db.execute(select(User).where(User.email == user_email))
            user = result.scalar_one_or_none()
            if not user or not user.email_preferences:
                return True
            default = category != "marketing"
            return user.email_preferences.get(category, default)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Preference check failed: {e}")
        return True

EMAIL_CATEGORIES = {
    "send_application_received": "application_updates",
    "send_application_approved": "application_updates",
    "send_application_under_review": "application_updates",
    "send_test_scheduled": "test_notifications",
    "send_test_completed": "test_notifications",
    "send_certificate_issued": "certificate_alerts",
    "send_certificate_expiry_warning": "certificate_alerts",
    "notify_agent_offline": "agent_alerts",
}


async def send_email(to: str, subject: str, html: str, from_email: str = None) -> bool:
    """Send an email via Resend"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": from_email or FROM_EMAIL,
                    "to": to,
                    "subject": subject,
                    "html": html
                }
            )
            return response.status_code == 200
    except Exception as e:
        print(f"Email error: {e}")
        return False


async def send_application_received(to: str, app_name: str, app_id: int):
    if not await should_send_email(to, "application_updates"):
        return False
    """Send application received notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Application Received</h2>
            <p>Thank you for submitting your ODDC certification application.</p>
            <p><strong>System Name:</strong> {app_name}<br>
            <strong>Application ID:</strong> SA-{app_id:04d}</p>
            <p>Our team will review your application within 2-3 business days. 
            You will receive notification when your CAT-72 conformance test is scheduled.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
                Questions? Contact us at info@sentinelauthority.org
            </p>
        </div>
    </div>
    """
    await send_email(to, f"Application Received - {app_name}", html)


async def send_test_scheduled(to: str, app_name: str, test_start: str):
    if not await should_send_email(to, "test_notifications"):
        return False
    """Send test scheduled notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">CAT-72 Test Scheduled</h2>
            <p>Your CAT-72 conformance test has been scheduled.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Test Start:</strong> {test_start}</p>
            <h3 style="color: #1d1a3b;">Before the test begins:</h3>
            <ol>
                <li>Install the ENVELO Interlock in your system</li>
                <li>Configure your API key and certificate ID</li>
                <li>Define your ODD boundaries</li>
                <li>Ensure continuous network connectivity</li>
            </ol>
            <p>The test will run for 72 continuous hours. Your system must maintain 
            active ENVELO enforcement throughout.</p>
        </div>
    </div>
    """
    await send_email(to, f"CAT-72 Test Scheduled - {app_name}", html)


async def send_test_started(to: str, app_name: str, test_id: str):
    if not await should_send_email(to, "test_notifications"):
        return False
    """Send test started notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5CD685;">✓ CAT-72 Test Started</h2>
            <p>Your CAT-72 conformance test is now active.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Test ID:</strong> {test_id}</p>
            <p>The test will run for 72 hours. You can monitor progress in your dashboard.</p>
            <p style="background: #fff3cd; padding: 12px; border-radius: 4px;">
                <strong>Important:</strong> Maintain continuous ENVELO Interlock operation. 
                Extended disconnection may require test restart.
            </p>
        </div>
    </div>
    """
    await send_email(to, f"CAT-72 Test Started - {app_name}", html)


async def send_certificate_issued(to: str, app_name: str, cert_number: str, expiry_date: str):
    if not await should_send_email(to, "certificate_alerts"):
        return False
    """Send certificate issued notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5CD685;">🎉 Certification Complete!</h2>
            <p>Congratulations! Your system has passed CAT-72 conformance testing.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Certificate Number:</strong> {cert_number}<br>
            <strong>Valid Until:</strong> {expiry_date}</p>
            <p>Your certificate is available for download in your dashboard.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.sentinelauthority.org/certificates" 
                   style="background: #1d1a3b; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    View Certificate
                </a>
            </div>
            <p style="font-size: 12px; color: #666;">
                Maintain active ENVELO enforcement to keep your certification valid.
            </p>
        </div>
    </div>
    """
    await send_email(to, f"ODDC Certificate Issued - {cert_number}", html)


async def send_test_failed(to: str, app_name: str, reason: str, pass_rate: float):
    if not await should_send_email(to, "test_notifications"):
        return False
    """Send test failed notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #D65C5C;">CAT-72 Test Did Not Pass</h2>
            <p>Unfortunately, your system did not meet certification requirements.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Pass Rate:</strong> {pass_rate:.1f}% (required: 95%)<br>
            <strong>Reason:</strong> {reason}</p>
            <h3>Next Steps:</h3>
            <ol>
                <li>Review the telemetry logs in your dashboard</li>
                <li>Identify and fix boundary violations</li>
                <li>Contact us to schedule a re-test ($7,500 fee)</li>
            </ol>
            <p style="font-size: 12px; color: #666;">
                Questions? Contact us at info@sentinelauthority.org
            </p>
        </div>
    </div>
    """
    await send_email(to, f"CAT-72 Test Results - {app_name}", html)


async def notify_admin_new_registration(email: str, name: str = None):
    """Notify admin of new user registration"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">New User Registration</h2>
            <p>A new user has registered and is <strong>awaiting your approval</strong>:</p>
            <p><strong>Email:</strong> {email}<br>
            <strong>Name:</strong> {name or 'Not provided'}</p>
            <p style="margin-top: 20px;"><a href="https://app.sentinelauthority.org/users" style="background: #1d1a3b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review &amp; Approve</a></p>
        </div>
    </div>
    """
    await send_email("info@sentinelauthority.org", f"New Registration: {email}", html)


async def notify_admin_new_application(app_name: str, org: str, email: str):
    """Notify admin of new application"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">New ODDC Application</h2>
            <p>A new certification application has been submitted:</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Organization:</strong> {org}<br>
            <strong>Contact:</strong> {email}</p>
            <p><a href="https://app.sentinelauthority.org/applications">Review in Dashboard</a></p>
        </div>
    </div>
    """
    await send_email("info@sentinelauthority.org", f"New Application: {app_name}", html)


async def send_test_setup_instructions(
    to: str,
    system_name: str,
    certificate_id: str,
    api_key: str,
    test_id: str
):
    """Send one-command deploy instructions when application is approved"""
    deploy_url = f"https://sentinel-authority-production.up.railway.app/api/v1/deploy/{certificate_id}?key={api_key}"
    curl_cmd = f"curl -sSL '{deploy_url}' | bash"
    dashboard_url = "https://app.sentinelauthority.org/envelo"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e8;">
        <div style="background: #12121a; padding: 24px; text-align: center; border-bottom: 1px solid #2a2a3a;">
            <h1 style="color: #00d4aa; margin: 0; font-size: 18px; letter-spacing: 2px;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; border: 2px solid #00d4aa; line-height: 48px; font-size: 20px; text-align: center;">&#10003;</div>
            </div>
            <h2 style="color: #00d4aa; text-align: center; font-size: 22px; margin-bottom: 8px;">Application Approved</h2>
            <p style="text-align: center; color: #8888a0; margin-bottom: 32px;">{system_name}</p>
            
            <div style="background: #12121a; border: 1px solid #2a2a3a; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #00d4aa; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 16px 0;">&#9654; PASTE THIS ON YOUR TARGET SYSTEM</p>
                <div style="background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 6px; padding: 16px; word-break: break-all;">
                    <code style="font-family: 'Courier New', monospace; font-size: 13px; color: #e0e0e8; line-height: 1.6;">{curl_cmd}</code>
                </div>
                <p style="color: #8888a0; font-size: 12px; margin: 12px 0 0 0;">This single command installs the ENVELO Interlock, configures your boundaries, starts enforcement, and begins your 72-hour CAT-72 test.</p>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                <div style="flex: 1; background: #12121a; border: 1px solid #2a2a3a; border-radius: 6px; padding: 14px;">
                    <p style="color: #8888a0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Certificate</p>
                    <p style="color: #8b5cf6; font-family: monospace; font-size: 13px; margin: 0;">{certificate_id}</p>
                </div>
                <div style="flex: 1; background: #12121a; border: 1px solid #2a2a3a; border-radius: 6px; padding: 14px;">
                    <p style="color: #8888a0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">API Key</p>
                    <p style="color: #8b5cf6; font-family: monospace; font-size: 12px; margin: 0; word-break: break-all;">{api_key}</p>
                </div>
            </div>
            
            <div style="background: rgba(0,212,170,0.05); border: 1px solid rgba(0,212,170,0.15); border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #00d4aa; font-size: 13px; margin: 0; line-height: 1.6;">
                    <strong>What happens next:</strong> Once deployed, your 72-hour test starts automatically. After 100+ enforcement actions with 95%+ conformance, your certificate activates. No manual steps needed.
                </p>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
                <a href="{dashboard_url}" style="display: inline-block; padding: 12px 32px; background: #00d4aa; color: #0a0a0f; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 6px;">View Dashboard</a>
            </div>
            
            <p style="font-size: 11px; color: #5a5a7a; text-align: center; margin: 0;">
                Save this email &mdash; your API key will not be shown again.<br>
                Questions? info@sentinelauthority.org
            </p>
        </div>
    </div>
    """
    await send_email(to, f"Deploy Now: {system_name} — ODDC Certification", html)


async def notify_certificate_issued(to: str, system_name: str, cert_number: str, org_name: str):
    """Notify applicant that their certificate has been issued"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #2e7d32;">🎉 ODDC Certificate Issued</h2>
            <p>Congratulations! Your system has successfully completed CAT-72 testing and has been granted ODDC conformance.</p>
            
            <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>Certificate Number:</strong> {cert_number}</p>
                <p style="margin: 8px 0;"><strong>System:</strong> {system_name}</p>
                <p style="margin: 8px 0;"><strong>Organization:</strong> {org_name}</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul style="line-height: 1.8;">
                <li>Download your certificate from the <a href="https://app.sentinelauthority.org" style="color: #1d1a3b;">portal</a></li>
                <li>Your ENVELO Interlock is now authorized for production use</li>
                <li>Verify your certificate anytime at <a href="https://sentinelauthority.org/verify.html?cert={cert_number}" style="color: #1d1a3b;">sentinelauthority.org/verify</a></li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
                Questions? Contact us at info@sentinelauthority.org
            </p>
        </div>
    </div>
    """
    await send_email(to, f"ODDC Certificate Issued: {system_name}", html)
    # Also notify admin
    await send_email("info@sentinelauthority.org", f"Certificate Issued: {cert_number} - {system_name}", html)


async def notify_agent_offline(to: str, system_name: str, session_id: str, org_name: str, minutes_offline: int):
    if not await should_send_email(to, "agent_alerts"):
        return False
    """Notify customer that their ENVELO agent has gone offline"""
    subject = f"⚠️ ENVELO Interlock Offline: {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; background: #1d1a3b; border-radius: 8px; margin-bottom: 16px;"></div>
            <h1 style="font-size: 24px; font-weight: 300; color: #1a1a2e; margin: 0;">Interlock Offline Alert</h1>
        </div>
        
        <div style="background: #FFF3CD; border: 1px solid #FFECB5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #856404;"><strong>Warning:</strong> Your ENVELO agent has been offline for {minutes_offline} minutes.</p>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0;"><strong>Organization:</strong> {org_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>System:</strong> {system_name}</p>
            <p style="margin: 0;"><strong>Session ID:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px;">{session_id}</code></p>
        </div>
        
        <p style="color: #666; line-height: 1.6;">
            Your ODDC certification requires continuous ENVELO agent operation. Please check your system and restart the agent if necessary.
        </p>
        
        <p style="color: #666; line-height: 1.6;">
            If the agent remains offline for an extended period, your certification may be subject to review.
        </p>
        
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e9ecef; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #999;">Sentinel Authority — ODDC Certification</p>
        </div>
    </div>
    """
    
    await send_email(to, subject, html)


async def notify_admin_agent_offline(system_name: str, org_name: str, session_id: str, minutes_offline: int, customer_email: str):
    """Notify admin that a customer's agent has gone offline"""
    subject = f"⚠️ Customer Interlock Offline: {org_name} - {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e;">Interlock Offline Alert</h2>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0;"><strong>Organization:</strong> {org_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>System:</strong> {system_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>Session ID:</strong> {session_id}</p>
            <p style="margin: 0 0 12px 0;"><strong>Offline Duration:</strong> {minutes_offline} minutes</p>
            <p style="margin: 0;"><strong>Customer Email:</strong> {customer_email}</p>
        </div>
        
        <p style="color: #666;">Customer has been notified.</p>
    </div>
    """
    
    await send_email(ADMIN_EMAIL, subject, html)


async def notify_high_violation_rate(to: str, system_name: str, org_name: str, block_count: int, block_rate: float):
    if not await should_send_email(to, "agent_alerts"):
        return False
    """Notify customer of high violation rate"""
    subject = f"🚨 High Violation Rate: {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; background: #1d1a3b; border-radius: 8px; margin-bottom: 16px;"></div>
            <h1 style="font-size: 24px; font-weight: 300; color: #1a1a2e; margin: 0;">Violation Rate Alert</h1>
        </div>
        
        <div style="background: #F8D7DA; border: 1px solid #F5C6CB; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #721C24;"><strong>Alert:</strong> Your system has a high boundary violation rate of {block_rate:.1f}%</p>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0;"><strong>Organization:</strong> {org_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>System:</strong> {system_name}</p>
            <p style="margin: 0;"><strong>Blocked Actions:</strong> {block_count}</p>
        </div>
        
        <p style="color: #666; line-height: 1.6;">
            The ENVELO agent is blocking actions that exceed your declared Operational Design Domain boundaries. 
            This indicates your autonomous system is attempting to operate outside its certified parameters.
        </p>
        
        <p style="color: #666; line-height: 1.6;">
            <strong>What this means:</strong> The interlock is working correctly by preventing out-of-bounds operation.
            However, frequent violations may indicate a need to review your system configuration or ODD boundaries.
        </p>
        
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e9ecef; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #999;">Sentinel Authority — ODDC Certification</p>
        </div>
    </div>
    """
    
    await send_email(to, subject, html)


async def notify_admin_high_violations(system_name: str, org_name: str, block_count: int, block_rate: float, customer_email: str):
    """Notify admin of customer's high violation rate"""
    subject = f"🚨 Customer High Violations: {org_name} - {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e;">High Violation Rate Alert</h2>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0;"><strong>Organization:</strong> {org_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>System:</strong> {system_name}</p>
            <p style="margin: 0 0 12px 0;"><strong>Blocked Actions:</strong> {block_count}</p>
            <p style="margin: 0 0 12px 0;"><strong>Violation Rate:</strong> {block_rate:.1f}%</p>
            <p style="margin: 0;"><strong>Customer Email:</strong> {customer_email}</p>
        </div>
        
        <p style="color: #666;">Customer has been notified. Consider reaching out to discuss ODD boundary adjustments.</p>
    </div>
    """
    
    await send_email(ADMIN_EMAIL, subject, html)


async def send_provisioned_agent_email(to: str, customer_name: str, system_name: str, certificate_number: str, agent_code: str):
    """Send the pre-configured ENVELO agent to a customer"""
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #1d1a3b 0%, #6B5B9A 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SENTINEL AUTHORITY</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px; letter-spacing: 2px;">OPERATIONAL DESIGN DOMAIN CONFORMANCE</p>
        </div>
        
        <div style="padding: 30px; background: white;">
            <h2 style="color: #333; margin-top: 0;">Your ENVELO Interlock is Ready</h2>
            
            <p>Hello {customer_name},</p>
            
            <p>Your ENVELO enforcement agent has been configured and is ready to deploy. This agent is pre-configured for your system and requires no additional setup.</p>
            
            <div style="background: #f4f4f8; border-left: 4px solid #1d1a3b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>System:</strong> {system_name}</p>
                <p style="margin: 0;"><strong>Certificate:</strong> {certificate_number}</p>
            </div>
            
            <h3 style="color: #333;">Quick Start</h3>
            <ol style="color: #555; line-height: 1.8;">
                <li>Save the attached <code>envelo_agent.py</code> file to your system</li>
                <li>Run: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">python envelo_agent.py</code></li>
                <li>The agent will connect automatically and begin enforcement</li>
            </ol>
            
            <p style="margin-top: 20px;">For CAT-72 attestation, the agent must run continuously for 72 hours with no violations. Your progress is tracked automatically.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Keep this file secure. It contains your API credentials.</p>
            </div>
            
            <p>You can monitor your agent status at:<br>
            <a href="https://app.sentinelauthority.org/envelo" style="color: #1d1a3b;">https://app.sentinelauthority.org/envelo</a></p>
        </div>
        
        <div style="padding: 20px; background: #f4f4f8; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@sentinelauthority.org" style="color: #1d1a3b;">support@sentinelauthority.org</a></p>
            <p style="margin: 10px 0 0 0;">Sentinel Authority • Autonomous System Conformance</p>
        </div>
    </div>
    """
    
    # For now, send HTML email. In production, attach the .py file
    # Resend supports attachments but we'll include download link for now
    return await send_email(
        to=to,
        subject=f"Your ENVELO Interlock is Ready - {system_name}",
        html=html
    )

async def send_password_reset_email(to: str, name: str, token: str):
    """Send password reset email"""
    reset_url = f"https://app.sentinelauthority.org/reset-password?token={token}"
    
    html = f"""
    <div style="font-family: 'IBM Plex Mono', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #2a2f3d; color: #fff;">
        <div style="background: linear-gradient(135deg, #1d1a3b 0%, #2d2856 100%); padding: 30px; text-align: center;">
            <div style="display: inline-block; width: 48px; height: 48px; background: #1d1a3b; border: 2px solid #9d8ccf; border-radius: 12px; margin-bottom: 16px;"></div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 300;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 40px 30px;">
            <h2 style="color: #9d8ccf; font-size: 18px; font-weight: 400; margin-bottom: 24px;">Password Reset Request</h2>
            <p style="color: rgba(255,255,255,0.8); line-height: 1.6; margin-bottom: 24px;">
                Hi {name or 'there'},
            </p>
            <p style="color: rgba(255,255,255,0.8); line-height: 1.6; margin-bottom: 24px;">
                We received a request to reset your password. Click the button below to create a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #1d1a3b 0%, #2d2856 100%); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">
                    Reset Password
                </a>
            </div>
            <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; margin-top: 32px;">
                This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0;">
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
                SENTINEL AUTHORITY — ODDC Conformance<br>
                <a href="https://sentinelauthority.org" style="color: #9d8ccf; text-decoration: none;">sentinelauthority.org</a>
            </p>
        </div>
    </div>
    """
    await send_email(to, "Reset Your Password - Sentinel Authority", html)



async def send_application_approved(to: str, system_name: str, app_number: str):
    if not await should_send_email(to, "application_updates"):
        return False
    """Notify applicant their application has been approved"""
    html = f"""
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0;">
        <div style="padding: 32px; border-bottom: 1px solid rgba(157,140,207,0.2);">
            <div style="font-family: monospace; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: rgba(157,140,207,0.7);">Sentinel Authority</div>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #5cd685; font-weight: 400; margin: 0 0 16px;">Application Approved</h2>
            <p style="color: #ccc; line-height: 1.6; margin: 0 0 20px;">
                Your ODDC certification application for <strong style="color: #fff;">{system_name}</strong> ({app_number}) has been approved.
            </p>
            <p style="color: #ccc; line-height: 1.6; margin: 0 0 24px;">
                Your dashboard has deployment instructions and your API credentials. Deploy the Interlock and your CAT-72 certification test begins automatically.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://app.sentinelauthority.org"
                   style="display: inline-block; border: 1px solid rgba(157,140,207,0.3); color: rgba(157,140,207,0.9); padding: 14px 32px;
                          text-decoration: none; font-family: monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                    Open Dashboard
                </a>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; margin-top: 32px;">
                <p style="font-size: 12px; color: #666; margin: 0;">Sentinel Authority — info@sentinelauthority.org</p>
            </div>
        </div>
    </div>
    """
    await send_email(to, f"Approved: {system_name} — {app_number}", html)

async def send_application_rejected(to: str, system_name: str, app_number: str, reason: str = ""):
    if not await should_send_email(to, "application_updates"):
        return False
    """Notify applicant their application has been rejected"""
    reason_block = f'<p style="color: #ccc; line-height: 1.6; margin: 16px 0; padding: 16px; border-left: 2px solid rgba(214,92,92,0.4); background: rgba(214,92,92,0.05);">{reason}</p>' if reason else ''
    html = f"""
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0;">
        <div style="padding: 32px; border-bottom: 1px solid rgba(157,140,207,0.2);">
            <div style="font-family: monospace; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: rgba(157,140,207,0.7);">Sentinel Authority</div>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #d65c5c; font-weight: 400; margin: 0 0 16px;">Application Requires Revision</h2>
            <p style="color: #ccc; line-height: 1.6; margin: 0 0 20px;">
                Your ODDC certification application for <strong style="color: #fff;">{system_name}</strong> ({app_number}) requires revision before CAT-72 testing can be authorized. Please review the auditor notes below and resubmit.
            </p>
            {reason_block}
            <p style="color: #ccc; line-height: 1.6; margin: 0 0 24px;">
                If you believe this was in error or have additional information, please contact us.
            </p>
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; margin-top: 32px;">
                <p style="font-size: 12px; color: #666; margin: 0;">Sentinel Authority — info@sentinelauthority.org</p>
            </div>
        </div>
    </div>
    """
    await send_email(to, f"Application Update: {system_name} — {app_number}", html)



async def send_application_under_review(to: str, system_name: str, app_number: str):
    if not await should_send_email(to, "application_updates"):
        return False
    """Notify applicant their application is under review"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #1d1a3b;">Application Under Review</h2>
            <p>Your ODDC certification application is now being reviewed by our team.</p>
            <p><strong>System:</strong> {system_name}<br>
            <strong>Application:</strong> {app_number}</p>
            <p>We typically complete reviews within 2-3 business days. You'll receive a notification when a decision has been made.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Questions? Contact us at info@sentinelauthority.org</p>
        </div>
    </div>
    """
    await send_email(to, f"Application Under Review - {system_name}", html)


async def send_certificate_expiry_warning(to: str, system_name: str, cert_number: str, days_remaining: int):
    if not await should_send_email(to, "certificate_alerts"):
        return False
    """Warn customer their certificate is expiring soon"""
    urgency = "🚨" if days_remaining <= 7 else "⚠️"
    color = "#D65C5C" if days_remaining <= 7 else "#D6A05C"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d1a3b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: {color};">{urgency} Certificate Expiring in {days_remaining} Days</h2>
            <p>Your ODDC certificate will expire soon and requires renewal.</p>
            <p><strong>System:</strong> {system_name}<br>
            <strong>Certificate:</strong> {cert_number}<br>
            <strong>Days Remaining:</strong> {days_remaining}</p>
            <p>To maintain your certification, please contact us to schedule a renewal CAT-72 test.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.sentinelauthority.org/certificates"
                   style="background: #1d1a3b; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    View Certificate
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Questions? Contact us at info@sentinelauthority.org</p>
        </div>
    </div>
    """
    await send_email(to, f"{urgency} Certificate Expiring - {cert_number}", html)
    await send_email(ADMIN_EMAIL, f"Certificate Expiring: {cert_number} ({days_remaining} days)", html)


async def send_learning_started(to: str, system_name: str, test_id: str):
    """Notify that learning mode has begun."""
    if not await should_send_email(to, "test_notifications"):
        return
    html = f"""
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0; padding: 40px; border: 1px solid rgba(157,140,207,0.2);">
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 11px; letter-spacing: 3px; color: rgba(157,140,207,0.6); text-transform: uppercase;">Sentinel Authority</span>
      </div>
      <h2 style="color: #9d8ccf; font-weight: 300; margin-bottom: 16px;">Learning Mode Active</h2>
      <p style="color: #b0b0b0; line-height: 1.7;">
        <strong>{system_name}</strong> (Test {test_id}) has entered learning mode.
      </p>
      <p style="color: #b0b0b0; line-height: 1.7;">
        The ENVELO Interlock is now observing normal operation and profiling telemetry data. No boundaries are enforced during this phase.
      </p>
      <div style="background: rgba(157,140,207,0.08); border: 1px solid rgba(157,140,207,0.15); border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #9d8ccf; font-size: 13px; margin: 0;"><strong>Next step:</strong> Once sufficient samples are collected, review the auto-discovered boundaries and finalize to begin 72-hour enforcement.</p>
      </div>
    </div>"""
    await send_email(to, f"Learning Mode Active — {system_name}", html)


async def send_learning_complete(to: str, system_name: str, test_id: str, boundary_count: int, sample_count: int):
    """Notify that learning is complete and enforcement has begun."""
    if not await should_send_email(to, "test_notifications"):
        return
    html = f"""
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0; padding: 40px; border: 1px solid rgba(157,140,207,0.2);">
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 11px; letter-spacing: 3px; color: rgba(157,140,207,0.6); text-transform: uppercase;">Sentinel Authority</span>
      </div>
      <h2 style="color: #5cd685; font-weight: 300; margin-bottom: 16px;">Learning Complete — Enforcement Active</h2>
      <p style="color: #b0b0b0; line-height: 1.7;">
        <strong>{system_name}</strong> (Test {test_id}) has completed the learning phase.
      </p>
      <div style="background: rgba(92,214,133,0.08); border: 1px solid rgba(92,214,133,0.15); border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #5cd685; font-size: 14px; margin: 0 0 8px;"><strong>{boundary_count} boundaries</strong> auto-generated from <strong>{sample_count} samples</strong></p>
        <p style="color: #b0b0b0; font-size: 13px; margin: 0;">The 72-hour CAT-72 enforcement window is now active. All telemetry will be evaluated against the discovered operational envelope.</p>
      </div>
    </div>"""
    await send_email(to, f"Enforcement Active — {system_name} ({boundary_count} boundaries)", html)


async def send_first_interlock(to: str, system_name: str, test_id: str, violations: list):
    """Notify on first interlock activation for a test."""
    if not await should_send_email(to, "test_notifications"):
        return
    violation_html = ""
    for v in (violations or [])[:5]:
        var = v.get("var", "unknown")
        val = v.get("value", "?")
        bound = v.get("bound", "?")
        threshold = v.get("threshold", "?")
        violation_html += f'<tr><td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#e0e0e0;">{var}</td><td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#d65c5c;">{val}</td><td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#b0b0b0;">{bound}: {threshold}</td></tr>'
    html = f"""
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0; padding: 40px; border: 1px solid rgba(214,92,92,0.3);">
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 11px; letter-spacing: 3px; color: rgba(214,92,92,0.6); text-transform: uppercase;">Sentinel Authority — Alert</span>
      </div>
      <h2 style="color: #d65c5c; font-weight: 300; margin-bottom: 16px;">⬡ First Interlock Activation</h2>
      <p style="color: #b0b0b0; line-height: 1.7;">
        <strong>{system_name}</strong> (Test {test_id}) has triggered its first ENVELO Interlock activation.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:13px;">
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:8px 12px;text-align:left;color:#9d8ccf;">Variable</th><th style="padding:8px 12px;text-align:left;color:#9d8ccf;">Value</th><th style="padding:8px 12px;text-align:left;color:#9d8ccf;">Limit</th></tr>
        {violation_html}
      </table>
      <p style="color: #b0b0b0; font-size: 13px; line-height: 1.7;">
        This notification is sent once per test. Subsequent interlocks are recorded in the evidence chain but do not generate additional emails.
      </p>
    </div>"""
    await send_email(to, f"⬡ Interlock Activated — {system_name}", html)
