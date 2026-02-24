"""
content_routes.py — Knowledge endpoint for SentinelChatbot
Place in: backend/app/api/routes/content.py
"""

from fastapi import APIRouter, Depends
from app.core.security import require_role
from app.services.content_scraper import get_knowledge, scrape_website
import asyncio

router = APIRouter()


@router.get("/api/content/knowledge")
async def get_website_knowledge():
    """Returns live scraped website content for chatbot system prompt injection."""
    return get_knowledge()


@router.post("/api/content/refresh")
async def refresh_knowledge(user: dict = Depends(require_role(["admin"]))):
    """Manually trigger a knowledge refresh (admin use)."""
    asyncio.create_task(scrape_website())
    return {"status": "refresh triggered"}
