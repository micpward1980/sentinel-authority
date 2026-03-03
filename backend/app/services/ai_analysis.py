"""
AI Analysis Service for Quote Engine.
Server-side Claude API calls — API key stays on Railway, never in browser.
"""

import os
import json
import httpx
import logging

logger = logging.getLogger("sentinel.ai_analysis")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-20250514"
API_URL = "https://api.anthropic.com/v1/messages"

ANALYSIS_PROMPT = """You are the AI analysis engine for Sentinel Authority, an independent ODDC certification body.
Respond ONLY in JSON: {"recommendedSystems":<n>,"recommendedSector":"<s>","oddBreakdown":["<odd1>"],"summary":"<text>","flags":["<f1>"]}
Pricing: $15,000 initial/system, $12,000 annual/system. Enterprise: 6+ systems.
Be specific about WHY each ODD is distinct. Flag edge cases. Never inflate system count."""

SUMMARY_PROMPT = """You write executive summaries for Sentinel Authority fee proposals. Authoritative, precise, institutional. 2-3 paragraphs. Use their specific systems and ODDs. Reference ENVELO and CAT-72 naturally. No markdown. Under 200 words."""


async def _call_claude(system_prompt: str, user_msg: str) -> str:
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — AI analysis unavailable")
        return ""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(API_URL, headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"},
            json={"model": MODEL, "max_tokens": 1000,
                  "system": system_prompt,
                  "messages": [{"role": "user", "content": user_msg}]})
        resp.raise_for_status()
        return "".join(b["text"] for b in resp.json().get("content", []) if b.get("type") == "text")


async def analyze_prospect(company, sector, system_description, odd_description="",
                           estimated_systems=1, expedited=False, notes=""):
    """Analyze a prospect's system profile. Returns structured recommendation."""
    msg = (f"Company: {company}\nSector: {sector}\nSystem: {system_description}\n"
           f"ODDs: {odd_description or 'N/A'}\nEstimated: {estimated_systems}\n"
           f"Expedited: {'Yes' if expedited else 'No'}\nNotes: {notes or 'None'}")
    text = await _call_claude(ANALYSIS_PROMPT, msg)
    if not text:
        return {"recommendedSystems": estimated_systems, "recommendedSector": sector,
                "oddBreakdown": [], "summary": "AI unavailable — configure ANTHROPIC_API_KEY.",
                "flags": ["API key missing"]}
    try:
        return json.loads(text.replace("```json", "").replace("```", "").strip())
    except json.JSONDecodeError:
        return {"recommendedSystems": estimated_systems, "recommendedSector": sector,
                "oddBreakdown": [], "summary": text[:500], "flags": ["Parse failed"]}


async def generate_executive_summary(company, sector, system_count, system_description,
                                     odd_breakdown=None, odd_description="", is_enterprise=False,
                                     year_one_total=0, annual_total=0, expedited=False):
    """Generate an executive summary for a certification fee proposal."""
    odds = ", ".join(odd_breakdown) if odd_breakdown else odd_description or "N/A"
    msg = (f"Company: {company}\nSector: {sector}\nSystems: {system_count}\nODDs: {odds}\n"
           f"System: {system_description}\nEnterprise: {'Yes-MCA' if is_enterprise else 'Standard'}\n"
           f"Year one: ${year_one_total:,}\nAnnual: ${annual_total:,}")
    return (await _call_claude(SUMMARY_PROMPT, msg)).strip() or "Summary unavailable."
