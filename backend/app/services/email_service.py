"""
Email Notification Service
Uses Resend for transactional emails
"""

import httpx
import os
from typing import Optional

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "re_BkncgUC1_2uMjrza8EsxuSS8Ja6HLgCTV")
FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@sentinelauthority.com")

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
