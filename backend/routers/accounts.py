"""
Accounts router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
import logging

from database import get_db, Account, User, System
from schemas import (
    AccountCreate, AccountUpdate, AccountResponse, AccountSummary,
    UserCreate, UserResponse, PaginatedResponse
)
from routers.auth import get_current_user, require_role, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_accounts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """List all accounts with pagination and filters."""
    
    # Build query
    query = select(Account)
    
    # Apply filters
    if status_filter:
        query = query.where(Account.status == status_filter)
    
    if type_filter:
        query = query.where(Account.account_type == type_filter)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Account.name.ilike(search_term)) |
            (Account.account_number.ilike(search_term))
        )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    # Apply pagination
    query = query.order_by(Account.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Execute
    result = await db.execute(query)
    accounts = result.scalars().all()
    
    return PaginatedResponse(
        items=[AccountSummary.model_validate(a) for a in accounts],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new account."""
    
    # Create account
    account = Account(
        name=account_data.name,
        legal_name=account_data.legal_name,
        account_type=account_data.account_type,
        primary_contact_name=account_data.primary_contact_name,
        primary_contact_email=account_data.primary_contact_email,
        primary_contact_phone=account_data.primary_contact_phone,
        billing_email=account_data.billing_email,
        address_line1=account_data.address_line1,
        address_line2=account_data.address_line2,
        city=account_data.city,
        state_province=account_data.state_province,
        postal_code=account_data.postal_code,
        country=account_data.country,
        notes=account_data.notes,
        metadata=account_data.metadata or {},
        created_by=current_user.user_id
    )
    
    db.add(account)
    await db.commit()
    await db.refresh(account)
    
    logger.info(f"Created account {account.account_number} by user {current_user.user_id}")
    
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get account by ID."""
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this account"
        )
    
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    account_data: AccountUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an account."""
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this account"
        )
    
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Update fields
    update_data = account_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    
    await db.commit()
    await db.refresh(account)
    
    logger.info(f"Updated account {account.account_number} by user {current_user.user_id}")
    
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Delete an account (soft delete by setting status to terminated)."""
    
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Soft delete
    account.status = "terminated"
    await db.commit()
    
    logger.info(f"Deleted account {account.account_number} by user {current_user.user_id}")


# ============================================================================
# ACCOUNT USERS
# ============================================================================

@router.get("/{account_id}/users", response_model=List[UserResponse])
async def list_account_users(
    account_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List users for an account."""
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this account"
        )
    
    result = await db.execute(
        select(User).where(User.account_id == account_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    
    return users


@router.post("/{account_id}/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_account_user(
    account_id: UUID,
    user_data: UserCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user for an account."""
    
    # Check access - must be admin or account admin
    if current_user.role != "admin":
        if current_user.account_id != account_id or current_user.role not in ["admin", "member"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to create users for this account"
            )
    
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        account_id=account_id
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Created user {user.email} for account {account_id}")
    
    return user


# ============================================================================
# ACCOUNT STATISTICS
# ============================================================================

@router.get("/{account_id}/stats")
async def get_account_stats(
    account_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics for an account."""
    
    # Check access
    if current_user.role != "admin" and current_user.account_id != account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this account"
        )
    
    # Get system counts by state
    result = await db.execute(
        select(
            System.certification_state,
            func.count(System.id)
        )
        .where(System.account_id == account_id)
        .group_by(System.certification_state)
    )
    state_counts = dict(result.all())
    
    # Get user count
    user_count = (await db.execute(
        select(func.count(User.id)).where(User.account_id == account_id)
    )).scalar()
    
    return {
        "systems": {
            "total": sum(state_counts.values()),
            "by_state": state_counts
        },
        "users": {
            "total": user_count
        }
    }
