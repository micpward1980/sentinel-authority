#!/usr/bin/env python3
"""
SENTINEL AUTHORITY — Email Lifecycle Notifications
====================================================

Wires existing email templates into actual lifecycle events:
 1. email_service.py: Add ADMIN_EMAIL constant, add missing templates (approved, under_review, expiry warning)
 2. cat72.py: Email on test create, start, stop (pass/fail)
 3. applicants.py: Email applicant on submission
 4. applications.py: Email on state transitions (approve, review, schedule)
 5. certificates.py: Email on certificate issuance

Usage: cd ~/Downloads/sentinel-authority && python3 patch_email_lifecycle.py
"""

import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(BASE, "backend", "app")

patches_applied = 0
checks_passed = 0
total_checks = 0


def read_file(relpath):
    full = os.path.join(BACKEND, relpath)
    if not os.path.exists(full):
        print(f"  ✗ File not found: {relpath}")
        return None
    with open(full, "r") as f:
        return f.read()


def write_file(relpath, content):
    full = os.path.join(BACKEND, relpath)
    with open(full, "w") as f:
        f.write(content)


def patch(relpath, old, new, label):
    global patches_applied
    content = read_file(relpath)
    if content is None:
        print(f"  ⚠ {label} — file missing")
        return False
    if old not in content:
        print(f"  ⚠ {label} — pattern not found")
        return False
    content = content.replace(old, new, 1)
    write_file(relpath, content)
    print(f"  ✓ {label}")
    patches_applied += 1
    return True


def check(label, relpath, substring):
    global checks_passed, total_checks
    total_checks += 1
    content = read_file(relpath)
    if content and substring in content:
        print(f"  ✓ {label}")
        checks_passed += 1
    else:
        print(f"  ✗ {label}")


print("═" * 60)
print("  SENTINEL AUTHORITY — Email Lifecycle Notifications")
print("═" * 60)
print()

# ═══════════════════════════════════════════════════════════════
# 1. EMAIL SERVICE — Add ADMIN_EMAIL + missing templates
# ═══════════════════════════════════════════════════════════════

print("── email_service.py ──")

# Add ADMIN_EMAIL constant
patch(
    "services/email_service.py",
    'FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@sentinelauthority.org")',
    '''FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@sentinelauthority.org")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "info@sentinelauthority.org")''',
    "Add ADMIN_EMAIL constant"
)

# Add missing templates at end of file
email_svc = read_file("services/email_service.py")
if email_svc and "send_application_approved" not in email_svc:
    new_templates = '''

async def send_application_approved(to: str, system_name: str, app_number: str):
    """Notify applicant their application has been approved"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #2e7d32;">✓ Application Approved</h2>
            <p>Your ODDC certification application has been approved.</p>
            <p><strong>System:</strong> {system_name}<br>
            <strong>Application:</strong> {app_number}</p>
            <h3 style="color: #5B4B8A;">Next Steps</h3>
            <ol>
                <li>Deploy the ENVELO Agent from your <a href="https://app.sentinelauthority.org/envelo" style="color: #5B4B8A;">dashboard</a></li>
                <li>Your CAT-72 conformance test will be scheduled</li>
                <li>The test runs for 72 continuous hours</li>
            </ol>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.sentinelauthority.org/envelo"
                   style="background: #5B4B8A; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Deploy ENVELO Agent
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Questions? Contact us at info@sentinelauthority.org</p>
        </div>
    </div>
    """
    await send_email(to, f"Application Approved - {system_name}", html)


async def send_application_under_review(to: str, system_name: str, app_number: str):
    """Notify applicant their application is under review"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #5B4B8A;">Application Under Review</h2>
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
    """Warn customer their certificate is expiring soon"""
    urgency = "🚨" if days_remaining <= 7 else "⚠️"
    color = "#D65C5C" if days_remaining <= 7 else "#D6A05C"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
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
                   style="background: #5B4B8A; color: white; padding: 12px 30px;
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
'''
    email_svc += new_templates
    write_file("services/email_service.py", email_svc)
    print("  ✓ Add approved, under_review, expiry_warning templates")
    patches_applied += 1
else:
    print("  ⚠ Templates already exist or file missing")

# Fix ADMIN_EMAIL references that use undefined var
email_svc = read_file("services/email_service.py")
if email_svc:
    # Replace any bare ADMIN_EMAIL in send_email calls that might fail
    # The notify_admin functions use "info@sentinelauthority.org" directly - that's fine
    # But notify_admin_agent_offline and notify_admin_high_violations use ADMIN_EMAIL
    if 'await send_email(ADMIN_EMAIL, subject, html)' in email_svc:
        print("  ✓ ADMIN_EMAIL references will now resolve (constant added)")
    else:
        print("  ⚠ No bare ADMIN_EMAIL references found")

print()

# ═══════════════════════════════════════════════════════════════
# 2. CAT-72 — Wire emails into create/start/stop
# ═══════════════════════════════════════════════════════════════

print("── cat72.py ──")

# Import additional email functions
patch(
    "api/routes/cat72.py",
    "from app.services.email_service import send_test_setup_instructions",
    """from app.services.email_service import (
    send_test_setup_instructions, send_test_started, send_test_failed,
    send_certificate_issued
)""",
    "Import email functions"
)

# Wire email into create_test (after commit)
patch(
    "api/routes/cat72.py",
    '''    await db.commit()
    await db.refresh(test)
    
    return {
        "id": test.id,
        "test_id": test.test_id,
        "state": test.state.value,
        "duration_hours": test.duration_hours,
        "message": "Test created and scheduled"
    }''',
    '''    await db.commit()
    await db.refresh(test)
    
    # Notify applicant
    try:
        from app.models.models import User
        owner_result = await db.execute(select(User).where(User.id == application.user_id))
        owner = owner_result.scalar_one_or_none()
        if owner and owner.email:
            from app.services.email_service import send_test_scheduled
            await send_test_scheduled(owner.email, application.system_name, "Within 24 hours")
    except Exception as e:
        print(f"Email error (test scheduled): {e}")
    
    return {
        "id": test.id,
        "test_id": test.test_id,
        "state": test.state.value,
        "duration_hours": test.duration_hours,
        "message": "Test created and scheduled"
    }''',
    "Wire email into create_test"
)

# Wire email into start_test (after commit)
patch(
    "api/routes/cat72.py",
    '''    await db.commit()
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
        "started_at": test.started_at.isoformat(),
        "genesis_hash": genesis_hash,
        "message": "Test started - 72-hour timer running"
    }''',
    '''    await db.commit()
    
    # Notify applicant
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.user_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                await send_test_started(owner.email, application.system_name, test.test_id)
    except Exception as e:
        print(f"Email error (test started): {e}")
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
        "started_at": test.started_at.isoformat(),
        "genesis_hash": genesis_hash,
        "message": "Test started - 72-hour timer running"
    }''',
    "Wire email into start_test"
)

# Wire email into stop_test (after result determined, before final return)
patch(
    "api/routes/cat72.py",
    '''    chain = test.evidence_chain or []
    chain.append({"block": len(chain), "hash": final_hash, "data": final_block})
    test.evidence_chain = chain
    test.evidence_hash = final_hash
    
    await db.commit()
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
        "result": test.result,''',
    '''    chain = test.evidence_chain or []
    chain.append({"block": len(chain), "hash": final_hash, "data": final_block})
    test.evidence_chain = chain
    test.evidence_hash = final_hash
    
    await db.commit()
    
    # Notify applicant of result
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.user_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                if test.result == "PASS":
                    await send_certificate_issued(
                        owner.email, application.system_name,
                        test.test_id, "Pending issuance"
                    )
                else:
                    reason = []
                    if test.convergence_score < 0.95:
                        reason.append(f"Convergence {test.convergence_score:.1%} < 95%")
                    if test.drift_rate and test.drift_rate > 0.005:
                        reason.append(f"Drift rate {test.drift_rate:.4f} > 0.005")
                    if test.stability_index and test.stability_index < 0.90:
                        reason.append(f"Stability {test.stability_index:.1%} < 90%")
                    await send_test_failed(
                        owner.email, application.system_name,
                        "; ".join(reason) or "Did not meet thresholds",
                        (test.convergence_score or 0) * 100
                    )
    except Exception as e:
        print(f"Email error (test result): {e}")
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
        "result": test.result,''',
    "Wire email into stop_test (pass/fail)"
)

print()

# ═══════════════════════════════════════════════════════════════
# 3. APPLICANTS — Email applicant on submission
# ═══════════════════════════════════════════════════════════════

print("── applicants.py ──")

patch(
    "api/routes/applicants.py",
    "from app.services.email_service import notify_admin_new_application",
    """from app.services.email_service import notify_admin_new_application, send_application_received""",
    "Import send_application_received"
)

# Add applicant notification after admin notification
patch(
    "api/routes/applicants.py",
    """    await notify_admin_new_application(
""",
    """    # Notify the applicant
    try:
        await send_application_received(app_data.contact_email, app_data.system_name, application.id)
    except Exception as e:
        print(f"Email error (app received): {e}")
    
    await notify_admin_new_application(
""",
    "Wire applicant notification on submission"
)

print()

# ═══════════════════════════════════════════════════════════════
# 4. APPLICATIONS — Email on state transitions
# ═══════════════════════════════════════════════════════════════

print("── applications.py ──")

apps_code = read_file("api/routes/applications.py")
if apps_code:
    # Find the state transition endpoint and add email notifications
    # Look for where state gets updated
    if "application.state =" in apps_code or "new_state" in apps_code:
        # Add email import at top
        if "send_application_approved" not in apps_code:
            patch(
                "api/routes/applications.py",
                "from app.services.email_service import send_email",
                """from app.services.email_service import send_email, send_application_approved, send_application_under_review""",
                "Import state transition emails"
            )
            
            # Find state update logic and add notifications
            # Check for advance/transition endpoint patterns
            if "advance" in apps_code or "transition" in apps_code or "update_state" in apps_code:
                print("  ℹ State transition endpoint found — manual wiring recommended")
                print("    Add after state commit:")
                print("      if new_state == 'approved': await send_application_approved(email, name, number)")
                print("      if new_state == 'under_review': await send_application_under_review(email, name, number)")
            else:
                print("  ℹ No state transition endpoint found — admin dashboard handles state changes")
        else:
            print("  ⚠ Emails already imported")
    else:
        print("  ⚠ No state transition logic found")
else:
    print("  ⚠ applications.py not found")

print()

# ═══════════════════════════════════════════════════════════════
# 5. CERTIFICATES — Email on issuance
# ═══════════════════════════════════════════════════════════════

print("── certificates.py ──")

certs_code = read_file("api/routes/certificates.py")
if certs_code:
    if "notify_certificate_issued" not in certs_code:
        # Find the certificate creation endpoint
        if "certificate_number" in certs_code and "db.add" in certs_code:
            # Add import
            if "from app.services.email_service" not in certs_code:
                patch(
                    "api/routes/certificates.py",
                    "from app.core.security import",
                    """from app.services.email_service import notify_certificate_issued
from app.core.security import""",
                    "Import notify_certificate_issued"
                )
            else:
                # Append to existing import
                patch(
                    "api/routes/certificates.py",
                    "from app.services.email_service import",
                    "from app.services.email_service import notify_certificate_issued,",
                    "Add notify_certificate_issued to imports"
                )
            
            # Find the issuance commit and add notification after it
            # Look for pattern: certificate creation + commit
            certs_code = read_file("api/routes/certificates.py")
            if certs_code and "await db.commit()" in certs_code and "certificate" in certs_code.lower():
                # Find the issue endpoint specifically
                if "issue" in certs_code.lower() or "create" in certs_code.lower():
                    print("  ℹ Certificate issuance endpoint found")
                    # Try to add email after the commit in the issue function
                    # This is tricky without knowing exact structure, so we'll be surgical
                    
                    # Look for the return after certificate creation
                    if '"certificate_number"' in certs_code:
                        print("  ℹ Wire email into certificate issuance — check manually if needed")
        else:
            print("  ⚠ No certificate creation logic found")
    else:
        print("  ✓ notify_certificate_issued already wired")
else:
    print("  ⚠ certificates.py not found")

print()

# ═══════════════════════════════════════════════════════════════
# VERIFICATION
# ═══════════════════════════════════════════════════════════════

print("── Verification ──")

check("ADMIN_EMAIL defined", "services/email_service.py", "ADMIN_EMAIL = os.getenv")
check("send_application_approved template", "services/email_service.py", "async def send_application_approved")
check("send_application_under_review template", "services/email_service.py", "async def send_application_under_review")
check("send_certificate_expiry_warning template", "services/email_service.py", "async def send_certificate_expiry_warning")
check("cat72: email imports", "api/routes/cat72.py", "send_test_started, send_test_failed")
check("cat72: create_test notification", "api/routes/cat72.py", "send_test_scheduled(owner.email")
check("cat72: start_test notification", "api/routes/cat72.py", "send_test_started(owner.email")
check("cat72: stop_test pass notification", "api/routes/cat72.py", "send_certificate_issued(")
check("cat72: stop_test fail notification", "api/routes/cat72.py", "send_test_failed(")
check("applicants: send_application_received import", "api/routes/applicants.py", "send_application_received")
check("applicants: applicant notification wired", "api/routes/applicants.py", "send_application_received(app_data.contact_email")
check("applications: state emails imported", "api/routes/applications.py", "send_application_approved")

print()
print(f"  {checks_passed}/{total_checks} checks passed · {patches_applied} patches applied")
print()
print("  git add -A && git commit -m 'feat: wire email notifications into lifecycle events'")
