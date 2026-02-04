"""Authentication routes."""
from app.services.email_service import notify_admin_new_registration

from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.models.models import User, UserRole

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def validate_password_strength(password: str) -> tuple:
    """Validate password meets security requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, ""


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: str = None


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


@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    valid, msg = validate_password_strength(user_data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        organization=user_data.organization,
        role=UserRole.PENDING,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    await notify_admin_new_registration(user.email, user.full_name)
    
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value, "organization": user.organization})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role.value, "organization": user.organization}
    }


@router.post("/login", response_model=TokenResponse)
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
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()
    
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value, "organization": user.organization})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role.value, "organization": user.organization}
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "organization": user.organization, "role": user.role.value}

@router.post("/forgot-password")
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

