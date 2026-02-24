"""Authentication and security."""

from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    sid = payload.get("sid")
    if sid:
        from app.models.models import UserSession
        result = await db.execute(
            select(UserSession).where(UserSession.session_id == sid, UserSession.is_active == True)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=401, detail="Session expired or revoked")
        session.last_active_at = datetime.utcnow()
        await db.commit()
    if payload.get("role") == "pending":
        raise HTTPException(status_code=403, detail="Account pending approval")
    return payload


def require_role(allowed_roles: list):
    async def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


def get_user_org_id(user: dict) -> int:
    """Extract organization_id from JWT payload. Returns None for admins or unset."""
    return user.get("organization_id")


def org_filter(user: dict, model_class):
    """Return a SQLAlchemy filter clause for org isolation.
    Admins see everything. Regular users see only their org's data.
    Returns None if no filter needed (admin or no org)."""
    if user.get("role") == "admin":
        return None
    org_id = user.get("organization_id")
    if org_id is None:
        # No org — filter to only their own user_id submissions
        if hasattr(model_class, 'applicant_id'):
            from sqlalchemy import and_
            return model_class.applicant_id == int(user.get("sub", 0))
        return None
    if hasattr(model_class, 'organization_id'):
        return model_class.organization_id == org_id
    return None


def require_admin():
    """Dependency that requires admin role."""
    return require_role(["admin"])
