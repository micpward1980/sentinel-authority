import os, httpx, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.routes.auth import get_current_user
from collections import defaultdict

router = APIRouter()

# Simple in-memory rate limit: 10 requests per user per 60 seconds
_rate_cache: dict = defaultdict(list)
RATE_LIMIT = 10
RATE_WINDOW = 60

class ReviewRequest(BaseModel):
    prompt: str

def check_rate_limit(user_id: str):
    now = time.time()
    hits = [t for t in _rate_cache[user_id] if now - t < RATE_WINDOW]
    if len(hits) >= RATE_LIMIT:
        raise HTTPException(429, f"Rate limit: max {RATE_LIMIT} AI review calls per minute")
    hits.append(now)
    _rate_cache[user_id] = hits

@router.post("/ai-review")
async def ai_review(req: ReviewRequest, user: dict = Depends(get_current_user)):
    # Admin only
    if user.get("role") not in ("admin", "operator"):
        raise HTTPException(403, "AI review access requires admin or operator role")

    # Rate limit per user
    check_rate_limit(str(user.get("id", "anon")))

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 1000, "messages": [{"role": "user", "content": req.prompt}]},
            timeout=60
        )
        return r.json()
