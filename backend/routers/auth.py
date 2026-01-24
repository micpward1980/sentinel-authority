"""
Authentication router and utilities for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, Annotated
from uuid import UUID
import secrets
import hashlib
import logging

from database import get_db, User, Account, APIKey
from schemas import TokenRequest, TokenResponse, UserResponse
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Security schemes
bearer_scheme = HTTPBearer(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key.
    
    Returns:
        Tuple of (full_key, key_prefix, key_hash)
    """
    # Generate a secure random key
    key_bytes = secrets.token_bytes(32)
    full_key = f"sa_{secrets.token_urlsafe(32)}"
    key_prefix = full_key[:10]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    
    return full_key, key_prefix, key_hash


def verify_api_key(api_key: str, key_hash: str) -> bool:
    """Verify an API key against its hash."""
    computed_hash = hashlib.sha256(api_key.encode()).hexdigest()
    return secrets.compare_digest(computed_hash, key_hash)


class CurrentUser:
    """Dependency class for authenticated user context."""
    
    def __init__(
        self,
        user_id: UUID,
        account_id: Optional[UUID],
        email: str,
        role: str,
        is_api_key: bool = False
    ):
        self.user_id = user_id
        self.account_id = account_id
        self.email = email
        self.role = role
        self.is_api_key = is_api_key
    
    def has_permission(self, required_role: str) -> bool:
        """Check if user has the required role."""
        role_hierarchy = {
            "viewer": 1,
            "member": 2,
            "admin": 3,
            "super_admin": 4
        }
        return role_hierarchy.get(self.role, 0) >= role_hierarchy.get(required_role, 0)


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Security(bearer_scheme)],
    db: AsyncSession = Depends(get_db)
) -> CurrentUser:
    """Get the current authenticated user from token or API key."""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Check if it's an API key
    if token.startswith("sa_"):
        return await _authenticate_api_key(token, db)
    
    # Otherwise, treat as JWT
    return await _authenticate_jwt(token, db)


async def _authenticate_jwt(token: str, db: AsyncSession) -> CurrentUser:
    """Authenticate using JWT token."""
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Get user from database
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.commit()
    
    return CurrentUser(
        user_id=user.id,
        account_id=user.account_id,
        email=user.email,
        role=user.role,
        is_api_key=False
    )


async def _authenticate_api_key(api_key: str, db: AsyncSession) -> CurrentUser:
    """Authenticate using API key."""
    key_prefix = api_key[:10]
    
    # Find API key by prefix
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_prefix == key_prefix,
            APIKey.is_active == True
        )
    )
    db_key = result.scalar_one_or_none()
    
    if not db_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Verify key hash
    if not verify_api_key(api_key, db_key.key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Check expiration
    if db_key.expires_at and db_key.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
        )
    
    # Update last used
    db_key.last_used_at = datetime.utcnow()
    await db.commit()
    
    # Get associated account
    result = await db.execute(
        select(Account).where(Account.id == db_key.account_id)
    )
    account = result.scalar_one_or_none()
    
    return CurrentUser(
        user_id=db_key.created_by or db_key.id,  # Use creator or key ID
        account_id=db_key.account_id,
        email=f"api-key-{key_prefix}@system",
        role="api_only",
        is_api_key=True
    )


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """Ensure the current user is active."""
    return current_user


def require_role(required_role: str):
    """Dependency factory for role-based access control."""
    
    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user)
    ) -> CurrentUser:
        if not current_user.has_permission(required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {required_role}"
            )
        return current_user
    
    return role_checker


# ============================================================================
# ROUTES
# ============================================================================

@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT token."""
    
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # In production, verify password hash
    # For demo, accept any password for existing users
    # if not verify_password(request.password, user.password_hash):
    #     raise HTTPException(...)
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "account_id": str(user.account_id) if user.account_id else None
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRATION_HOURS * 3600
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user information."""
    
    result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.post("/logout")
async def logout(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Logout current user (invalidate token - client-side)."""
    # In a production system with refresh tokens, you would:
    # 1. Revoke the refresh token
    # 2. Add the access token to a blacklist (if using Redis)
    
    return {"message": "Successfully logged out"}
