"""
chat.py — Sentinel Authority AI Chat Endpoint
Add this to your Railway FastAPI backend.

Setup:
  1. Copy this file into your backend directory
  2. Import and include the router in your main.py:
       from chat import router as chat_router
       app.include_router(chat_router)
  3. Add ANTHROPIC_API_KEY to Railway environment variables
  4. Deploy

Anthropic API key: https://console.anthropic.com/settings/keys
"""

import os
import json
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter()

# ─── Request model ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    system: str
    messages: list[ChatMessage]
    stream: bool = True
    model: str = "claude-haiku-4-5-20251001"
    max_tokens: int = 1024

# ─── Auth dependency ───────────────────────────────────────────────────────────
# Re-use your existing auth dependency. Replace with your actual import:
# from auth import get_current_user
# For now, a permissive passthrough — replace in production:

async def get_current_user_optional():
    """Replace with your actual auth dependency."""
    return None  # Remove this and use your real auth

# ─── Streaming endpoint ────────────────────────────────────────────────────────

@router.post("/api/chat")
async def chat(req: ChatRequest):
    """
    Proxy chat requests to Anthropic with streaming.
    Requires ANTHROPIC_API_KEY env var.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured. Add it to Railway environment variables.")

    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed. Run: pip install anthropic")

    client = anthropic.Anthropic(api_key=api_key)

    # Validate and clean messages
    messages = [{"role": m.role, "content": m.content} for m in req.messages if m.content.strip()]
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Ensure alternating user/assistant turns (Anthropic requirement)
    cleaned = []
    for msg in messages:
        if cleaned and cleaned[-1]["role"] == msg["role"]:
            # Merge consecutive same-role messages
            cleaned[-1]["content"] += "\n\n" + msg["content"]
        else:
            cleaned.append(msg)

    # Must start with user
    if cleaned[0]["role"] != "user":
        cleaned = [{"role": "user", "content": "Hello"}] + cleaned

    async def generate():
        try:
            with client.messages.stream(
                model=req.model,
                max_tokens=req.max_tokens,
                system=req.system,
                messages=cleaned,
            ) as stream:
                for text in stream.text_stream:
                    chunk = {"delta": {"type": "text_delta", "text": text}}
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
        except anthropic.APIError as e:
            log.error(f"Anthropic API error: {e}")
            error_chunk = {"error": str(e)}
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            log.error(f"Chat streaming error: {e}")
            yield f"data: {json.dumps({'error': 'Internal error'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ─── Non-streaming fallback ────────────────────────────────────────────────────

@router.post("/api/chat/sync")
async def chat_sync(req: ChatRequest):
    """Non-streaming fallback."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed")

    client = anthropic.Anthropic(api_key=api_key)
    messages = [{"role": m.role, "content": m.content} for m in req.messages if m.content.strip()]

    try:
        response = client.messages.create(
            model=req.model,
            max_tokens=req.max_tokens,
            system=req.system,
            messages=messages,
        )
        return {"content": response.content[0].text, "role": "assistant"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
