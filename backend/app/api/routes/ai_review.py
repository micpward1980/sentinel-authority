import os, httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.routes.auth import get_current_user

router = APIRouter()

class ReviewRequest(BaseModel):
    prompt: str

@router.post("/ai-review")
async def ai_review(req: ReviewRequest, user: dict = Depends(get_current_user)):
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
