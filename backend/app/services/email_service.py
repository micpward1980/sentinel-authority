"""
Email Notification Service
Uses Resend for transactional emails
"""

import httpx
import os
from typing import Optional

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "re_BkncgUC1_2uMjrza8EsxuSS8Ja6HLgCTV")
FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@sentinelauthority.org")

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
    """Send application received notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
    """Send test scheduled notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">CAT-72 Test Scheduled</h2>
            <p>Your CAT-72 conformance test has been scheduled.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Test Start:</strong> {test_start}</p>
            <h3 style="color: #5B4B8A;">Before the test begins:</h3>
            <ol>
                <li>Install the ENVELO Agent in your system</li>
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
    """Send test started notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5CD685;">✓ CAT-72 Test Started</h2>
            <p>Your CAT-72 conformance test is now active.</p>
            <p><strong>System:</strong> {app_name}<br>
            <strong>Test ID:</strong> {test_id}</p>
            <p>The test will run for 72 hours. You can monitor progress in your dashboard.</p>
            <p style="background: #fff3cd; padding: 12px; border-radius: 4px;">
                <strong>Important:</strong> Maintain continuous ENVELO Agent operation. 
                Extended disconnection may require test restart.
            </p>
        </div>
    </div>
    """
    await send_email(to, f"CAT-72 Test Started - {app_name}", html)


async def send_certificate_issued(to: str, app_name: str, cert_number: str, expiry_date: str):
    """Send certificate issued notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
                   style="background: #5B4B8A; color: white; padding: 12px 30px; 
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
    """Send test failed notification"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">New User Registration</h2>
            <p>A new user has registered:</p>
            <p><strong>Email:</strong> {email}<br>
            <strong>Name:</strong> {name or 'Not provided'}</p>
        </div>
    </div>
    """
    await send_email("info@sentinelauthority.org", f"New Registration: {email}", html)


async def notify_admin_new_application(app_name: str, org: str, email: str):
    """Notify admin of new application"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
    """Send setup instructions when CAT-72 test is scheduled"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Your CAT-72 Test is Ready</h2>
            <p>Your ODDC certification test for <strong>{system_name}</strong> has been scheduled.</p>
            
            <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #5B4B8A; margin-top: 0;">Your Credentials</h3>
                <p style="margin: 8px 0;"><strong>Certificate ID:</strong></p>
                <code style="display: block; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 14px;">{certificate_id}</code>
                <p style="margin: 8px 0; margin-top: 16px;"><strong>API Key:</strong></p>
                <code style="display: block; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 14px; word-break: break-all;">{api_key}</code>
                <p style="font-size: 12px; color: #666; margin-top: 8px;">⚠️ Save this API key securely. It won't be shown again.</p>
            </div>
            
            <h3 style="color: #5B4B8A;">Installation Steps</h3>
            <ol style="line-height: 1.8;">
                <li>Install the ENVELO Agent:<br>
                    <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px;">pip install httpx</code>
                </li>
                <li>Download the agent from:<br>
                    <a href="https://www.sentinelauthority.org/agent.html" style="color: #5B4B8A;">sentinelauthority.org/agent.html</a>
                </li>
                <li>Configure with your credentials above</li>
                <li>Start your system - the agent will automatically begin sending telemetry</li>
            </ol>
            
            <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h4 style="color: #2e7d32; margin: 0 0 8px 0;">Test Requirements</h4>
                <ul style="margin: 0; padding-left: 20px; color: #333;">
                    <li>72 continuous hours of operation</li>
                    <li>Minimum 100 actions evaluated</li>
                    <li>≥95% pass rate required</li>
                    <li>At least 1 boundary violation must be blocked (proves enforcement works)</li>
                </ul>
            </div>
            
            <h3 style="color: #5B4B8A;">Monitor Your Progress</h3>
            <p>Check your test status anytime at:</p>
            <p><a href="https://www.sentinelauthority.org/status?cert={certificate_id}" style="color: #5B4B8A; font-weight: bold;">sentinelauthority.org/status?cert={certificate_id}</a></p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
                Questions? Contact us at info@sentinelauthority.org<br>
                Test ID: {test_id}
            </p>
        </div>
    </div>
    """
    await send_email(to, f"CAT-72 Test Ready - Setup Instructions for {system_name}", html)


async def notify_certificate_issued(to: str, system_name: str, cert_number: str, org_name: str):
    """Notify applicant that their certificate has been issued"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
                <li>Download your certificate from the <a href="https://app.sentinelauthority.org" style="color: #5B4B8A;">portal</a></li>
                <li>Your ENVELO Agent is now authorized for production use</li>
                <li>Verify your certificate anytime at <a href="https://sentinelauthority.org/verify.html?cert={cert_number}" style="color: #5B4B8A;">sentinelauthority.org/verify</a></li>
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
    """Notify customer that their ENVELO agent has gone offline"""
    subject = f"⚠️ ENVELO Agent Offline: {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; background: #5B4B8A; border-radius: 8px; margin-bottom: 16px;"></div>
            <h1 style="font-size: 24px; font-weight: 300; color: #1a1a2e; margin: 0;">Agent Offline Alert</h1>
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
    subject = f"⚠️ Customer Agent Offline: {org_name} - {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a2e;">Agent Offline Alert</h2>
        
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
    """Notify customer of high violation rate"""
    subject = f"🚨 High Violation Rate: {system_name}"
    
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; background: #5B4B8A; border-radius: 8px; margin-bottom: 16px;"></div>
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
        <div style="background: linear-gradient(135deg, #5B4B8A 0%, #6B5B9A 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SENTINEL AUTHORITY</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px; letter-spacing: 2px;">OPERATIONAL DESIGN DOMAIN CONFORMANCE</p>
        </div>
        
        <div style="padding: 30px; background: white;">
            <h2 style="color: #333; margin-top: 0;">Your ENVELO Agent is Ready</h2>
            
            <p>Hello {customer_name},</p>
            
            <p>Your ENVELO enforcement agent has been configured and is ready to deploy. This agent is pre-configured for your system and requires no additional setup.</p>
            
            <div style="background: #f4f4f8; border-left: 4px solid #5B4B8A; padding: 15px; margin: 20px 0;">
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
            <a href="https://app.sentinelauthority.org/envelo" style="color: #5B4B8A;">https://app.sentinelauthority.org/envelo</a></p>
        </div>
        
        <div style="padding: 20px; background: #f4f4f8; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@sentinelauthority.org" style="color: #5B4B8A;">support@sentinelauthority.org</a></p>
            <p style="margin: 10px 0 0 0;">Sentinel Authority • Autonomous System Conformance</p>
        </div>
    </div>
    """
    
    # For now, send HTML email. In production, attach the .py file
    # Resend supports attachments but we'll include download link for now
    return await send_email(
        to=to,
        subject=f"Your ENVELO Agent is Ready - {system_name}",
        html=html
    )

async def send_password_reset_email(to: str, name: str, token: str):
    """Send password reset email"""
    reset_url = f"https://app.sentinelauthority.org/reset-password?token={token}"
    
    html = f"""
    <div style="font-family: 'IBM Plex Mono', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #2a2f3d; color: #fff;">
        <div style="background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); padding: 30px; text-align: center;">
            <div style="display: inline-block; width: 48px; height: 48px; background: #5B4B8A; border: 2px solid #9d8ccf; border-radius: 12px; margin-bottom: 16px;"></div>
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
                <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">
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

