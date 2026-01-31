#!/usr/bin/env python3
"""
Patches auth.py and email_service.py to add forgot password feature
"""
import re

def patch_auth(filepath):
    """Add forgot password endpoints to auth.py"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already patched
    if 'forgot-password' in content:
        print(f"⚠ auth.py already has forgot-password endpoint")
        return False
    
    # Add imports after existing imports
    import_addition = """import secrets
from datetime import timedelta
from app.services.email_service import send_password_reset_email
"""
    
    # Find the line "from datetime import datetime" and add after it
    if 'from datetime import datetime' in content:
        content = content.replace(
            'from datetime import datetime',
            'from datetime import datetime, timedelta\nimport secrets'
        )
    else:
        # Add after the first import block
        content = content.replace(
            'from app.services.email_service import notify_admin_new_registration',
            'from app.services.email_service import notify_admin_new_registration, send_password_reset_email\nimport secrets'
        )
    
    # Add new Pydantic models after TokenResponse
    models_addition = '''

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
'''
    
    # Find TokenResponse class end and insert after
    content = content.replace(
        'user: dict\n\n\n@router.post("/register"',
        'user: dict\n' + models_addition + '\n\n@router.post("/register"'
    )
    
    # Add endpoints at the end
    endpoints = '''

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset email"""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent."}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    
    await db.commit()
    
    # Send reset email
    await send_password_reset_email(user.email, user.full_name, reset_token)
    
    return {"message": "If an account exists with this email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using token"""
    result = await db.execute(
        select(User).where(
            User.reset_token == request.token,
            User.reset_token_expires > datetime.utcnow()
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Validate password strength
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Update password and clear token
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    
    await db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.get("/verify-reset-token/{token}")
async def verify_reset_token(token: str, db: AsyncSession = Depends(get_db)):
    """Verify if a reset token is valid"""
    result = await db.execute(
        select(User).where(
            User.reset_token == token,
            User.reset_token_expires > datetime.utcnow()
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"valid": True, "email": user.email}
'''
    
    content = content.rstrip() + endpoints + '\n'
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✓ Patched auth.py with forgot-password endpoints")
    return True


def patch_email_service(filepath):
    """Add password reset email template"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already patched
    if 'send_password_reset_email' in content:
        print(f"⚠ email_service.py already has send_password_reset_email")
        return False
    
    email_function = '''

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
'''
    
    content = content.rstrip() + email_function + '\n'
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✓ Patched email_service.py with password reset template")
    return True


def patch_models(filepath):
    """Add reset token columns to User model"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already patched
    if 'reset_token' in content:
        print(f"⚠ models.py already has reset_token columns")
        return False
    
    # Find hashed_password line and add after it
    content = content.replace(
        'hashed_password = Column(String(255), nullable=False)',
        '''hashed_password = Column(String(255), nullable=False)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)'''
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✓ Patched models.py with reset_token columns")
    return True


if __name__ == "__main__":
    import sys
    import os
    
    # Default paths
    backend_dir = os.path.expanduser("~/Downloads/sentinel-authority/backend")
    
    if len(sys.argv) > 1:
        backend_dir = sys.argv[1]
    
    auth_path = os.path.join(backend_dir, "app/api/routes/auth.py")
    email_path = os.path.join(backend_dir, "app/services/email_service.py")
    models_path = os.path.join(backend_dir, "app/models/models.py")
    
    print("Patching forgot password feature...")
    print("=" * 50)
    
    patch_models(models_path)
    patch_email_service(email_path)
    patch_auth(auth_path)
    
    print("=" * 50)
    print("\nDON'T FORGET: Run this SQL on your Railway database:")
    print("""
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
""")
    print("\nThen deploy:")
    print("  cd ~/Downloads/sentinel-authority/backend")
    print("  git add . && git commit -m 'Add forgot password' && git push")
