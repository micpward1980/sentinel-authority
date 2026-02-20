"""
content_scraper.py — Live website knowledge for SentinelChatbot
Place in: backend/app/services/content_scraper.py

Scrapes sentinelauthority.org on startup and every 6 hours.
Returns cleaned text for injection into chat system prompt.
"""

import asyncio
import httpx
import re
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

WEBSITE_PAGES = [
    ("MAIN", "https://www.sentinelauthority.org/"),
    ("CONFORMANCE", "https://www.sentinelauthority.org/conformance.html"),
    ("SCENARIOS", "https://www.sentinelauthority.org/scenarios.html"),
    ("SECURITY", "https://www.sentinelauthority.org/security.html"),
    ("RESEARCH", "https://www.sentinelauthority.org/research.html"),
    ("TERMS", "https://www.sentinelauthority.org/terms.html"),
    ("PRIVACY", "https://www.sentinelauthority.org/privacy.html"),
]

REFRESH_INTERVAL_HOURS = 6
MAX_CHARS_PER_PAGE = 3000

_store = {
    "content": "",
    "last_updated": None,
    "page_count": 0,
    "status": "not_started",
}


def _strip_html(html: str) -> str:
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    return text.strip()


async def scrape_website() -> bool:
    _store["status"] = "scraping"
    pages = []
    success = 0

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for name, url in WEBSITE_PAGES:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    cleaned = _strip_html(resp.text)[:MAX_CHARS_PER_PAGE]
                    pages.append(f"--- {name} ({url}) ---\n{cleaned}")
                    success += 1
                    logger.info(f"Scraped {name}: OK")
                else:
                    logger.warning(f"Scrape {name}: HTTP {resp.status_code}")
            except Exception as e:
                logger.warning(f"Scrape {name} error: {e}")

    if pages:
        _store["content"] = "\n\n".join(pages)
        _store["last_updated"] = datetime.utcnow()
        _store["page_count"] = success
        _store["status"] = "ready"
        logger.info(f"Knowledge store updated: {success} pages, {len(_store['content'])} chars")
        return True

    _store["status"] = "error"
    return False


def get_knowledge() -> dict:
    """Return knowledge store state — used by /api/content/knowledge endpoint."""
    return {
        "content": _store["content"],
        "last_updated": _store["last_updated"].isoformat() if _store["last_updated"] else None,
        "page_count": _store["page_count"],
        "status": _store["status"],
    }


async def scraper_loop():
    """Background task: scrape on boot, refresh every 6 hours."""
    logger.info("Content scraper starting initial fetch...")
    await scrape_website()
    while True:
        await asyncio.sleep(REFRESH_INTERVAL_HOURS * 3600)
        logger.info("Content scraper: refreshing...")
        await scrape_website()
