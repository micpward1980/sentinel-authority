"""Authentication and security."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=True)


def _require_secret_key() -> str:
    secret = (settings.SECRET_KEY or "").strip()
    if not secret:
        raise RuntimeError("SECRET_KEY is not configured — cannot issue or verify tokens")
    return secret


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    *,
    expires_minutes: Optional[int] = None,
    token_type: str = "access",
) -> str:
    now = datetime.now(timezone.utc)
    ttl = expires_delta or timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = data.copy()
    payload.update({
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "type": token_type,
    })
    return jwt.encode(payload, _require_secret_key(), algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, _require_secret_key(), algorithms=[settings.ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type not in (None, "access", "temp"):
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid credentials") from exc


def create_refresh_token(data: dict) -> str:
    return create_access_token(
        data, expires_delta=timedelta(days=7), token_type="refresh"
    )


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, _require_secret_key(), algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    sid = payload.get("sid")
    if sid:
        from app.models.models import UserSession
        result = await db.execute(
            select(UserSession).where(
                UserSession.session_id == sid,
                UserSession.is_active == True,
            )
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
    return user.get("organization_id")


def org_filter(user: dict, model_class):
    if user.get("role") == "admin":
        return None
    org_id = user.get("organization_id")
    if org_id is None:
        if hasattr(model_class, "applicant_id"):
            return model_class.applicant_id == int(user.get("sub", 0))
        return None
    if hasattr(model_class, "organization_id"):
        return model_class.organization_id == org_id
    return None


def require_admin():
    return require_role(["admin"])
