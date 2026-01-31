"""
Simple caching service using Redis or in-memory fallback
"""

import os
import json
from typing import Optional, Any
import time

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# In-memory fallback cache
_memory_cache: dict = {}

class CacheService:
    def __init__(self):
        self.redis_client = None
        if REDIS_AVAILABLE and REDIS_URL:
            try:
                self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            except Exception as e:
                print(f"Redis connection failed, using memory cache: {e}")
    
    async def get(self, key: str) -> Optional[Any]:
        try:
            if self.redis_client:
                value = await self.redis_client.get(key)
                return json.loads(value) if value else None
            else:
                item = _memory_cache.get(key)
                if item and item.get("expires", 0) > time.time():
                    return item["value"]
                return None
        except Exception:
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        try:
            if self.redis_client:
                await self.redis_client.setex(key, ttl, json.dumps(value))
            else:
                _memory_cache[key] = {"value": value, "expires": time.time() + ttl}
            return True
        except Exception:
            return False
    
    async def delete(self, key: str) -> bool:
        try:
            if self.redis_client:
                await self.redis_client.delete(key)
            else:
                _memory_cache.pop(key, None)
            return True
        except Exception:
            return False

cache = CacheService()

def cached(key_prefix: str, ttl: int = 60):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix}:{hash(str(args) + str(kwargs))}"
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator
