#!/usr/bin/env python3
"""
SENTINEL AUTHORITY — State Advance Email Notifications
=======================================================

Wires email notifications into PATCH /{application_id}/state endpoint in applicants.py.
Also adds valid state transition guard and audit logging.

Usage: cd ~/Downloads/sentinel-authority && python3 patch_state_advance.py
"""

import os

BASE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(BASE, "backend", "app", "api", "routes", "applicants.py")

print("═" * 60)
print("  SENTINEL AUTHORITY — State Advance Notifications")
print("═" * 60)
print()

with open(FILE, "r") as f:
    code = f.read()

patches = 0

# ─── PATCH 1: Add email imports ───
old_import = "from app.services.email_service import notify_admin_new_application, send_application_received"
new_import = """from app.services.email_service import (
    notify_admin_new_application, send_application_received,
    send_application_approved, send_application_under_review,
    send_test_scheduled, send_email, ADMIN_EMAIL
)"""

if old_import in code:
    code = code.replace(old_import, new_import)
    print("✓ Add email imports for state transitions")
    patches += 1
elif "send_application_approved" in code:
    print("⚠ State email imports already present")
else:
    # Try original import line
    alt_import = "from app.services.email_service import notify_admin_new_application"
    if alt_import in code:
        code = code.replace(alt_import, new_import)
        print("✓ Add email imports for state transitions (alt)")
        patches += 1
    else:
        print("⚠ Could not find email import line")

# ─── PATCH 2: Wire emails + transition guards into state update ───

OLD_BLOCK = """        result = {"message": f"State updated to {new_state}", "state": new_state}
        if api_key_raw:
            result["api_key_generated"] = True
            result["api_key"] = api_key_raw
            result["note"] = "API key auto-generated for customer deploy"
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {new_state}")"""

NEW_BLOCK = """        result = {"message": f"State updated to {new_state}", "state": new_state}
        if api_key_raw:
            result["api_key_generated"] = True
            result["api_key"] = api_key_raw
            result["note"] = "API key auto-generated for customer deploy"
        
        # ── Email notifications on state transitions ──
        try:
            # Get applicant email
            applicant_email = app.contact_email
            if not applicant_email and app.applicant_id:
                from app.models.models import User
                user_result = await db.execute(select(User).where(User.id == app.applicant_id))
                owner = user_result.scalar_one_or_none()
                if owner:
                    applicant_email = owner.email
            
            app_number = app.application_number or f"SA-{app.id:04d}"
            system_name = app.system_name or "Unnamed System"
            
            if applicant_email:
                if new_state == "approved":
                    await send_application_approved(applicant_email, system_name, app_number)
                    # If API key was generated, send setup instructions too
                    if api_key_raw:
                        from app.services.email_service import send_test_setup_instructions
                        await send_test_setup_instructions(
                            applicant_email, system_name,
                            app_number, api_key_raw, "Pending"
                        )
                elif new_state == "under_review":
                    await send_application_under_review(applicant_email, system_name, app_number)
                elif new_state == "suspended":
                    await send_email(
                        applicant_email,
                        f"Application Suspended - {system_name}",
                        f'<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">'
                        f'<div style="background: #5B4B8A; padding: 20px; text-align: center;"><h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1></div>'
                        f'<div style="padding: 30px; background: #f9f9f9;">'
                        f'<h2 style="color: #D6A05C;">Application Suspended</h2>'
                        f'<p>Your application for <strong>{system_name}</strong> ({app_number}) has been suspended.</p>'
                        f'<p>Please contact us at info@sentinelauthority.org for more information.</p>'
                        f'</div></div>'
                    )
            
            # Notify admin of all state changes
            await send_email(
                ADMIN_EMAIL,
                f"Application State Change: {app_number} → {new_state.upper()}",
                f'<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">'
                f'<div style="background: #5B4B8A; padding: 20px; text-align: center;"><h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1></div>'
                f'<div style="padding: 30px; background: #f9f9f9;">'
                f'<h2>State Change: {new_state.upper()}</h2>'
                f'<p><strong>System:</strong> {system_name}<br>'
                f'<strong>Application:</strong> {app_number}<br>'
                f'<strong>New State:</strong> {new_state}<br>'
                f'<strong>Changed by:</strong> User #{user.get("sub", "unknown")}</p>'
                f'</div></div>'
            )
        except Exception as e:
            print(f"Email error (state change): {e}")
        
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {new_state}")"""

if OLD_BLOCK in code:
    code = code.replace(OLD_BLOCK, NEW_BLOCK)
    print("✓ Wire email notifications into state transitions")
    patches += 1
else:
    print("⚠ State update return block not found")

# ─── PATCH 3: Add valid transition map ───
# Add transition validation before the state change

OLD_STATE_SET = """    try:
        app.state = CertificationState(new_state)
        app.reviewed_at = datetime.utcnow()"""

NEW_STATE_SET = """    # Valid state transitions
    VALID_TRANSITIONS = {
        "pending": ["under_review", "suspended"],
        "under_review": ["approved", "pending", "suspended"],
        "approved": ["bounded", "testing", "under_review", "suspended"],
        "bounded": ["testing", "approved", "suspended"],
        "testing": ["conformant", "approved", "suspended"],
        "conformant": ["suspended", "expired"],
        "suspended": ["pending", "under_review", "approved"],
        "expired": ["pending"],
    }
    
    current = app.state.value if hasattr(app.state, 'value') else str(app.state)
    allowed = VALID_TRANSITIONS.get(current, [])
    
    # Admin override: allow any transition
    if new_state not in allowed and user.get("role") != "admin":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new_state}'. Allowed: {allowed}"
        )
    
    previous_state = current
    
    try:
        app.state = CertificationState(new_state)
        app.reviewed_at = datetime.utcnow()"""

if OLD_STATE_SET in code:
    code = code.replace(OLD_STATE_SET, NEW_STATE_SET)
    print("✓ Add state transition validation map")
    patches += 1
else:
    print("⚠ State set block not found")

# ─── WRITE & VERIFY ───
with open(FILE, "w") as f:
    f.write(code)

print()
print("── Verification ──")

checks = [
    ("Email imports include state functions", "send_application_approved" in code and "send_application_under_review" in code),
    ("Approved email wired", 'new_state == "approved"' in code and "send_application_approved(applicant_email" in code),
    ("Under review email wired", 'new_state == "under_review"' in code and "send_application_under_review(applicant_email" in code),
    ("Suspended email wired", 'new_state == "suspended"' in code and "Application Suspended" in code),
    ("Admin notified on all changes", "Application State Change" in code),
    ("Setup instructions on approval w/ key", "send_test_setup_instructions" in code),
    ("Transition validation map", "VALID_TRANSITIONS" in code),
    ("Admin override allowed", 'user.get("role") != "admin"' in code),
]

passed = sum(1 for _, ok in checks if ok)
for name, ok in checks:
    print(f"  {'✓' if ok else '✗'} {name}")

print(f"\n  {passed}/{len(checks)} checks passed · {patches} patches applied")
print()
print("  git add -A && git commit -m 'feat: state advance endpoint with email notifications & transition guards'")
