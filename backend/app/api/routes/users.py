"""User Management routes (Admin only)."""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_password_hash, get_current_user, require_admin
from app.models.models import User, UserRole

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company: Optional[str] = None
    organization: Optional[str] = None
    role: str = "applicant"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    company: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    company: Optional[str] = None
    organization: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to require admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/", response_model=List[UserResponse], summary="List all users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """List all users (admin only)."""
    result = await db.execute(select(User).order_by(User.id.desc()))
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            company=u.organization,
            organization=u.organization,
            role=u.role.value if hasattr(u.role, 'value') else str(u.role),
            is_active=u.is_active if u.is_active is not None else True
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse, summary="Get user by ID")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Get a specific user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company=user.organization,
        organization=user.organization,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        is_active=user.is_active if user.is_active is not None else True
    )


@router.post("/", response_model=UserResponse, summary="Create user")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Create a new user (admin only)."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Map role string to enum
    role = UserRole.ADMIN if user_data.role == "admin" else UserRole.APPLICANT
    
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        organization=user_data.company or user_data.organization,
        role=role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company=user.organization,
        organization=user.organization,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        is_active=user.is_active if user.is_active is not None else True
    )


@router.patch("/{user_id}", response_model=UserResponse, summary="Update user")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Update a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.company is not None:
        user.organization = user_data.company
    if user_data.organization is not None:
        user.organization = user_data.organization
    if user_data.role is not None:
        user.role = UserRole.ADMIN if user_data.role == "admin" else UserRole.APPLICANT
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password is not None:
        user.hashed_password = get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company=user.organization,
        organization=user.organization,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        is_active=user.is_active if user.is_active is not None else True
    )


@router.delete("/{user_id}", summary="Delete user")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Delete a user (admin only)."""
    # Prevent self-deletion
    if int(current_user.get("sub")) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "User deleted", "id": user_id}


@router.post("/{user_id}/reset-password", summary="Admin: reset user password")
async def reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Generate a new password for a user (admin only)."""
    import secrets
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate temporary password
    new_password = secrets.token_urlsafe(8) + "A1!"
    user.hashed_password = get_password_hash(new_password)
    
    await db.commit()
    
    return {"message": "Password reset", "temporary_password": new_password}


# ═══ Email Preferences ═══

DEFAULT_EMAIL_PREFS = {
    "application_updates": True, "test_notifications": True,
    "certificate_alerts": True, "agent_alerts": True, "marketing": False,
}



@router.post("/{user_id}/approve", summary="Approve pending user")
async def approve_user(user_id: int, db: AsyncSession = Depends(get_db), admin: dict = Depends(get_current_user)):
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.role = UserRole.APPLICANT
    await db.commit()
    await db.refresh(user)
    return {"message": "User approved", "id": user.id, "email": user.email}


@router.post("/{user_id}/reject", summary="Reject pending user")
async def reject_user(user_id: int, db: AsyncSession = Depends(get_db), admin: dict = Depends(get_current_user)):
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"message": "User rejected", "id": user.id, "email": user.email}

@router.get("/email-preferences", summary="Get email preferences")
async def get_email_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get email notification preferences"""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"preferences": user.email_preferences or DEFAULT_EMAIL_PREFS}


@router.put("/email-preferences", summary="Update email preferences")
async def update_email_preferences(
    preferences: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update email notification preferences"""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    valid_keys = set(DEFAULT_EMAIL_PREFS.keys())
    filtered = {k: bool(v) for k, v in preferences.items() if k in valid_keys}
    current = user.email_preferences or DEFAULT_EMAIL_PREFS.copy()
    current.update(filtered)
    user.email_preferences = current
    await db.commit()
    return {"preferences": current, "message": "Preferences updated"}
