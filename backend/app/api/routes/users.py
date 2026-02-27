"""User Management routes (Admin only)."""

from fastapi import Query,  APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
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
            role=u.role,
            is_active=u.is_active if u.is_active is not None else True
        )
        for u in users
    ]



@router.get("/notifications", summary="Get user notifications")
async def get_notifications(
    current_user: dict = Depends(get_current_user),
):
    return {"notifications": [], "unread_count": 0}


@router.post("/notifications/mark-read", summary="Mark notifications as read")
async def mark_notifications_read(
    current_user: dict = Depends(get_current_user),
):
    return {"status": "ok"}

@router.get("/email-preferences", summary="Get email preferences")
async def get_email_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get email notification preferences"""
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
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
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
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
        role=user.role,
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
    role = "admin" if user_data.role == "admin" else "applicant"
    
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
        role=user.role,
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
        user.role = "admin" if user_data.role == "admin" else "applicant"
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
        role=user.role,
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
    
    # Delete/nullify FK references, then hard-delete or soft-delete
    try:
        await db.execute(text("DELETE FROM application_comments WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(text("DELETE FROM violations WHERE session_id IN (SELECT id FROM envelo_sessions WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = :uid))"), {"uid": user_id})
        await db.execute(text("DELETE FROM telemetry_records WHERE session_id IN (SELECT id FROM envelo_sessions WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = :uid))"), {"uid": user_id})
        await db.execute(text("DELETE FROM envelo_sessions WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = :uid)"), {"uid": user_id})
        await db.execute(text("DELETE FROM api_keys WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(text("DELETE FROM user_sessions WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(text("UPDATE applications SET applicant_id = NULL WHERE applicant_id = :uid"), {"uid": user_id})
        await db.execute(text("UPDATE cat72_tests SET operator_id = NULL WHERE operator_id = :uid"), {"uid": user_id})
        await db.execute(text("UPDATE certificates SET issued_by = NULL WHERE issued_by = :uid"), {"uid": user_id})
        # audit_log is tamper-proof — check if user has entries
        has_audit = await db.execute(text("SELECT COUNT(*) FROM audit_log WHERE user_id = :uid"), {"uid": user_id})
        audit_count = has_audit.scalar()
        if audit_count and audit_count > 0:
            # Soft-delete: deactivate user, preserve audit trail integrity
            user.is_active = False
            user.email = f"deleted_{user_id}_{user.email}"
            await db.commit()
            return {"message": "User deactivated (audit trail preserved)", "id": user_id, "soft_delete": True}
        else:
            await db.delete(user)
            await db.commit()
            return {"message": "User deleted", "id": user_id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    
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
    user.role = "applicant"
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



@router.get("/list", summary="List users with pagination")
async def list_users_paginated(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    role: str = Query(None),
    search: str = Query(None),
):
    from app.models.models import User
    from sqlalchemy import func
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if search:
        term = f"%{search}%"
        query = query.where(
            (User.email.ilike(term)) | (User.full_name.ilike(term)) | (User.organization.ilike(term))
        )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    sort_col = getattr(User, sort_by, User.created_at)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    users = result.scalars().all()
    return {
        "items": [{
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "organization": u.organization,
            "organization_id": getattr(u, "organization_id", None),
            "is_active": u.is_active,
            "created_at": str(u.created_at) if u.created_at else None,
            "last_login_at": str(u.last_login_at) if hasattr(u, "last_login_at") and u.last_login_at else None,
        } for u in users],
        "total": total, "limit": limit, "offset": offset,
    }
