"""
Middleware for Sentinel Authority API
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from fastapi import status
import time
import uuid
import logging
from typing import Callable, Optional
from datetime import datetime
import hashlib

from config import settings

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware for request auditing and logging."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        # Record start time
        start_time = time.time()
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        request.state.client_ip = client_ip
        
        # Log request
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Client: {client_ip} - User-Agent: {request.headers.get('User-Agent', 'unknown')[:50]}"
        )
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"[{request_id}] Unhandled exception: {str(e)}")
            raise
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{duration:.3f}"
        
        # Log response
        logger.info(
            f"[{request_id}] Response: {response.status_code} - "
            f"Duration: {duration:.3f}s"
        )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting middleware.
    
    In production, use Redis for distributed rate limiting.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict = {}  # IP -> list of timestamps
        self._cleanup_interval = 60  # seconds
        self._last_cleanup = time.time()
    
    def _get_rate_limit(self, request: Request) -> int:
        """Get rate limit based on client tier."""
        # In production, look up the account's billing tier
        # For now, use standard limit
        return settings.RATE_LIMIT_STANDARD
    
    def _cleanup_old_requests(self):
        """Remove old request timestamps."""
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        cutoff = current_time - 3600  # 1 hour window
        for ip in list(self._requests.keys()):
            self._requests[ip] = [
                ts for ts in self._requests[ip] 
                if ts > cutoff
            ]
            if not self._requests[ip]:
                del self._requests[ip]
        
        self._last_cleanup = current_time
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Get client identifier
        client_ip = getattr(request.state, 'client_ip', request.client.host if request.client else "unknown")
        
        # Cleanup old requests periodically
        self._cleanup_old_requests()
        
        # Get current request count
        current_time = time.time()
        cutoff = current_time - 3600  # 1 hour window
        
        if client_ip not in self._requests:
            self._requests[client_ip] = []
        
        # Filter to requests within the window
        recent_requests = [
            ts for ts in self._requests[client_ip] 
            if ts > cutoff
        ]
        
        # Check rate limit
        rate_limit = self._get_rate_limit(request)
        
        if len(recent_requests) >= rate_limit:
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit of {rate_limit} requests per hour exceeded",
                    "retry_after": 3600 - int(current_time - recent_requests[0])
                },
                headers={
                    "Retry-After": str(3600 - int(current_time - recent_requests[0])),
                    "X-RateLimit-Limit": str(rate_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(recent_requests[0] + 3600))
                }
            )
        
        # Record this request
        recent_requests.append(current_time)
        self._requests[client_ip] = recent_requests
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(rate_limit - len(recent_requests))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + 3600))
        
        return response


class AuthContextMiddleware(BaseHTTPMiddleware):
    """Middleware to extract and validate authentication context."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Initialize auth context
        request.state.user_id = None
        request.state.account_id = None
        request.state.user_role = None
        
        # Auth is handled by the auth dependency in routes
        # This middleware just ensures the state exists
        
        return await call_next(request)
