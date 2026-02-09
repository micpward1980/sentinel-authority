import hashlib
import json
import pyotp
import base64
import io
"""Authentication routes."""
from app.services.email_service import notify_admin_new_registration
from app.services.audit_service import write_audit_log

from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import Response as FastAPIResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db

from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.models.models import User, Organization, UserRole, UserSession

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

async def _create_session_token(user, request, db):
    """Create a DB-tracked session and return a JWT with session ID."""
    sid = secrets.token_hex(32)
    db.add(UserSession(
        user_id=user.id, session_id=sid,
        ip_address=request.client.host if request.client else 'unknown',
        user_agent=request.headers.get('user-agent', 'unknown')[:500],
    ))
    await db.commit()
    return create_access_token({
        "sub": str(user.id), "email": user.email,
        "role": user.role, "organization": user.organization,
        "sid": sid,
    })




from app.core.password_validator import validate_password_strength, check_password_breach, score_password


class ProfileUpdate(BaseModel):
    full_name: str = None
    organization: str = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str






class TOTPSetupResponse(BaseModel):
    secret: str
    uri: str
    qr_base64: str

class TOTPVerifyRequest(BaseModel):
    code: str

class DisableTOTPRequest(BaseModel):
    current_password: str

def generate_backup_codes(count=10):
    """Generate plaintext backup codes and their hashes."""
    codes = []
    hashes = []
    for _ in range(count):
        code = secrets.token_hex(4).upper()
        codes.append(code)
        hashes.append(hashlib.sha256(code.encode()).hexdigest())
    return codes, hashes


@limiter.limit("5/minute")
@router.post("/2fa/setup", response_model=TOTPSetupResponse, summary="Generate TOTP secret for 2FA setup")
async def setup_2fa(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    secret = pyotp.random_base32()
    user.totp_secret = secret
    await db.commit()
    
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="Sentinel Authority")
    
    # Generate QR code as base64
    try:
        import qrcode
        qr = qrcode.make(uri)
        buf = io.BytesIO()
        qr.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        qr_b64 = ""
    
    return {"secret": secret, "uri": uri, "qr_base64": qr_b64}


@limiter.limit("5/minute")
@router.post("/2fa/enable", summary="Verify code and enable 2FA")
async def enable_2fa(
    request: Request,
    body: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /2fa/setup first")
    
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Try again.")
    
    user.totp_enabled = True
    await write_audit_log(db, action="2fa_enabled", resource_type="user", resource_id=user.id, user_email=user.email)
    await db.commit()
    # Generate backup codes
    plain_codes, hashed_codes = generate_backup_codes(10)
    user.totp_backup_codes = json.dumps(hashed_codes)
    await db.commit()
    return {"message": "2FA enabled successfully", "backup_codes": plain_codes}


@router.post("/2fa/disable", summary="Disable 2FA")
async def disable_2fa(
    body: DisableTOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    
    user.totp_enabled = False
    user.totp_secret = None
    await write_audit_log(db, action="2fa_disabled", resource_type="user", resource_id=user.id, user_email=user.email)
    await db.commit()
    return {"message": "2FA disabled"}


@router.post("/2fa/verify-login", summary="Verify TOTP during login")
@limiter.limit("5/minute")
async def verify_2fa_login(
    request: Request,
    body: TOTPVerifyRequest,
    temp_token: str = Query(..., description="Temporary token from login"),
    db: AsyncSession = Depends(get_db)
):
    """Verify TOTP code to complete login when 2FA is enabled"""
    try:
        from app.core.security import decode_token
        payload = decode_token(temp_token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not configured")
    
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        used_backup = False
        if user.totp_backup_codes:
            hashed = hashlib.sha256(body.code.upper().encode()).hexdigest()
            codes = json.loads(user.totp_backup_codes)
            if hashed in codes:
                codes.remove(hashed)
                user.totp_backup_codes = json.dumps(codes)
                await db.commit()
                used_backup = True
        if not used_backup:
            raise HTTPException(status_code=400, detail="Invalid code")
    
    token = await _create_session_token(user, request, db)
    
    await write_audit_log(db, action="user_login", resource_type="user", resource_id=user.id,
        user_id=user.id, user_email=user.email, details={"ip": request.client.host if request.client else "unknown", "2fa": False})
    await db.commit()
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "organization": user.organization, "organization_id": user.organization_id}
    }

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post('/change-password', summary='Change password')
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == int(current_user.get('sub'))))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    valid, msg = validate_password_strength(body.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    breached, breach_count = await check_password_breach(body.new_password)
    if breached:
        raise HTTPException(status_code=400, detail=f"This password appeared in {breach_count:,} data breaches — choose a different one")
    user.hashed_password = get_password_hash(body.new_password)
    await db.commit()
    return {'message': 'Password changed successfully'}

@router.post("/register", response_model=TokenResponse, summary="Register new user")
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    valid, msg = validate_password_strength(user_data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    breached, breach_count = await check_password_breach(user_data.password)
    if breached:
        raise HTTPException(status_code=400, detail=f"This password appeared in {breach_count:,} data breaches — choose a different one")
    
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        organization=user_data.organization,
        role="pending",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Link to organization
    if user_data.organization:
        org_slug = user_data.organization.lower().strip().replace(' ', '-').replace(',', '').replace('.', '')
        existing_org = await db.execute(select(Organization).where(Organization.slug == org_slug))
        org = existing_org.scalar_one_or_none()
        if not org:
            org = Organization(name=user_data.organization.strip(), slug=org_slug)
            db.add(org)
            await db.flush()
        user.organization_id = org.id
        await db.commit()
        await db.refresh(user)
    
    await notify_admin_new_registration(user.email, user.full_name)
    
    await write_audit_log(db, action="user_registered", resource_type="user", resource_id=user.id,
        user_id=user.id, user_email=user.email, details={"organization": user.organization, "ip": request.client.host if request.client else "unknown"})
    await db.commit()
    
    token = await _create_session_token(user, request, db)
    
    await write_audit_log(db, action="user_login", resource_type="user", resource_id=user.id,
        user_id=user.id, user_email=user.email, details={"ip": request.client.host if request.client else "unknown", "2fa": False})
    await db.commit()
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "organization": user.organization, "organization_id": user.organization_id}
    }


@router.post("/login", response_model=TokenResponse, summary="Login and get JWT token")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    # Check if account is locked
    if user and user.locked_until and user.locked_until > datetime.utcnow():
        minutes_left = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Account locked. Try again in {minutes_left} minutes.")
    
    # Validate credentials
    if not user or not verify_password(credentials.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                user.failed_login_attempts = 0
            await db.commit()
        await write_audit_log(db, action="login_failed", resource_type="user",
            user_email=credentials.email, details={"ip": request.client.host if request.client else "unknown", "reason": "invalid_credentials"})
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()
    
    # Check if 2FA is enabled
    if user.totp_enabled and user.totp_secret:
        temp_token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role, "organization": user.organization, "organization_id": user.organization_id}, expires_minutes=5)
        return {
            "requires_2fa": True,
            "temp_token": temp_token,
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "organization": user.organization, "organization_id": user.organization_id}
        }
    
    token = await _create_session_token(user, request, db)
    
    await write_audit_log(db, action="user_login", resource_type="user", resource_id=user.id,
        user_id=user.id, user_email=user.email, details={"ip": request.client.host if request.client else "unknown", "2fa": False})
    await db.commit()
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "organization": user.organization, "organization_id": user.organization_id}
    }




@router.post("/2fa/backup-codes", summary="Regenerate 2FA backup codes")
async def regenerate_backup_codes(
    request: Request,
    body: DisableTOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == int(current_user.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid password")
    plain_codes, hashed_codes = generate_backup_codes(10)
    user.totp_backup_codes = json.dumps(hashed_codes)
    await db.commit()
    return {"backup_codes": plain_codes, "message": "New backup codes generated. Previous codes are now invalid."}



class PasswordScoreRequest(BaseModel):
    password: str

@router.post("/password-strength", summary="Score password strength")
async def password_strength_score(body: PasswordScoreRequest):
    return score_password(body.password)


@router.put("/profile", summary="Update user profile")
async def update_profile(
    updates: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update user profile (name, organization)"""
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if updates.full_name is not None:
        user.full_name = updates.full_name.strip()
    if updates.organization is not None:
        user.organization = updates.organization.strip()
        org_slug = updates.organization.lower().strip().replace(' ', '-').replace(',', '').replace('.', '')
        if org_slug:
            existing_org = await db.execute(select(Organization).where(Organization.slug == org_slug))
            org = existing_org.scalar_one_or_none()
            if not org:
                org = Organization(name=updates.organization.strip(), slug=org_slug)
                db.add(org)
                await db.flush()
            user.organization_id = org.id
    
    await db.commit()
    await db.refresh(user)
    
    await write_audit_log(db, action="profile_updated", resource_type="user", resource_id=user.id,
        user_email=user.email, details={"full_name": user.full_name, "organization": user.organization})
    return {
        "message": "Profile updated",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "organization": user.organization,
            "organization_id": user.organization_id
        }
    }

@router.get("/me", summary="Get current user profile")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "organization": user.organization, "role": user.role, "totp_enabled": user.totp_enabled or False}

@router.post("/forgot-password", summary="Request password reset email")
@limiter.limit("3/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset email"""
    result = await db.execute(select(User).where(User.email == req.email))
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


@router.post("/reset-password", summary="Reset password with token")
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
    valid, msg = validate_password_strength(request.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    breached, breach_count = await check_password_breach(request.new_password)
    if breached:
        raise HTTPException(status_code=400, detail=f"This password appeared in {breach_count:,} data breaches — choose a different one")
    
    # Update password and clear token
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    
    await db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.get("/verify-reset-token/{token}", summary="Verify reset token validity")
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

