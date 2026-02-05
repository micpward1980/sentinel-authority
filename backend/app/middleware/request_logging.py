"""Request logging middleware - logs all API calls"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("sentinel.requests")
logging.basicConfig(level=logging.INFO)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        
        # Extract user from JWT if present
        user_email = "-"
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            try:
                import jwt
                from app.core.config import Settings
                settings = Settings()
                payload = jwt.decode(auth[7:], settings.SECRET_KEY, algorithms=["HS256"])
                user_email = payload.get("email", "-")
            except Exception:
                pass
        
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 1)
        
        # Skip health checks and static assets from logging
        path = request.url.path
        if path not in ("/health", "/favicon.ico"):
            logger.info(
                f"{request.method} {path} {response.status_code} "
                f"{duration}ms user={user_email} ip={request.client.host if request.client else '-'}"
            )
        
        return response
