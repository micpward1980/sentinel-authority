"""
Email notification service using Resend
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "info@sentinelauthority.org")
FROM_EMAIL = "notifications@sentinelauthority.org"

try:
    import resend
    resend.api_key = RESEND_API_KEY
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("Resend not installed, email notifications disabled")


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend"""
    if not RESEND_AVAILABLE or not RESEND_API_KEY:
        logger.warning(f"Email not sent (no API key): {subject}")
        return False
    
    try:
        resend.Emails.send({
            "from": f"Sentinel Authority <{FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html
        })
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def notify_admin_new_registration(user_email: str, user_name: str, organization: str):
    """Notify admin of new user registration"""
    subject = f"New Registration: {organization}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2a2f3d; padding: 20px; text-align: center;">
            <h1 style="color: #9d8ccf; margin: 0;">Sentinel Authority</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5B4B8A;">New User Registration</h2>
            <p><strong>Name:</strong> {user_name}</p>
            <p><strong>Email:</strong> {user_email}</p>
            <p><strong>Organization:</strong> {organization}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
                <a href="https://app.sentinelauthority.org" style="color: #5B4B8A;">View in Platform</a>
            </p>
        </div>
    </div>
    """
    send_email(ADMIN_EMAIL, subject, html)


def notify_admin_new_application(org_name: str, system_name: str, contact_email: str):
    """Notify admin of new ODDC application"""
    subject = f"New Application: {system_name} ({org_name})"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2a2f3d; padding: 20px; text-align: center;">
            <h1 style="color: #9d8ccf; margin: 0;">Sentinel Authority</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5B4B8A;">New ODDC Application</h2>
            <p><strong>Organization:</strong> {org_name}</p>
            <p><strong>System:</strong> {system_name}</p>
            <p><strong>Contact:</strong> {contact_email}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
                <a href="https://app.sentinelauthority.org/applications" style="color: #5B4B8A;">Review Application</a>
            </p>
        </div>
    </div>
    """
    send_email(ADMIN_EMAIL, subject, html)


def notify_test_complete(applicant_email: str, system_name: str, test_id: str, result: str):
    """Notify admin and applicant when CAT-72 test completes"""
    subject = f"CAT-72 Complete: {system_name} - {result}"
    
    result_color = "#5CD685" if result == "PASS" else "#D65C5C"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2a2f3d; padding: 20px; text-align: center;">
            <h1 style="color: #9d8ccf; margin: 0;">Sentinel Authority</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5B4B8A;">CAT-72 Test Complete</h2>
            <p><strong>System:</strong> {system_name}</p>
            <p><strong>Test ID:</strong> {test_id}</p>
            <p><strong>Result:</strong> <span style="color: {result_color}; font-weight: bold;">{result}</span></p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
                <a href="https://app.sentinelauthority.org/cat72" style="color: #5B4B8A;">View Details</a>
            </p>
        </div>
    </div>
    """
    
    # Notify admin
    send_email(ADMIN_EMAIL, subject, html)
    
    # Notify applicant
    if applicant_email and applicant_email != ADMIN_EMAIL:
        send_email(applicant_email, subject, html)


def notify_certificate_issued(applicant_email: str, org_name: str, system_name: str, cert_number: str):
    """Notify admin and applicant when certificate is issued"""
    subject = f"ODDC Certificate Issued: {cert_number}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2a2f3d; padding: 20px; text-align: center;">
            <h1 style="color: #9d8ccf; margin: 0;">Sentinel Authority</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5CD685;">ODDC Certificate Issued</h2>
            <p><strong>Certificate:</strong> {cert_number}</p>
            <p><strong>Organization:</strong> {org_name}</p>
            <p><strong>System:</strong> {system_name}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
                <a href="https://app.sentinelauthority.org/certificates" style="color: #5B4B8A;">View Certificate</a> |
                <a href="https://sentinelauthority.org/verify.html" style="color: #5B4B8A;">Verify</a>
            </p>
        </div>
    </div>
    """
    
    # Notify admin
    send_email(ADMIN_EMAIL, subject, html)
    
    # Notify applicant
    if applicant_email and applicant_email != ADMIN_EMAIL:
        send_email(applicant_email, subject, html)
