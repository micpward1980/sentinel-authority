"""
Sentinel Authority — Autonomous LinkedIn Poster (w_member_social)
Posts as Mike Ward (personal profile) Mon–Fri at 8 AM ET via Railway APScheduler.

ENV VARS:
  LINKEDIN_ACCESS_TOKEN     — OAuth token with w_member_social scope
  LINKEDIN_POSTING_ENABLED  — "true" to activate
  ANTHROPIC_API_KEY         — already set on Railway
"""

import os
import json
import logging
import httpx
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("sentinel.linkedin")

WEEKLY_ROTATION = [
    (0, "thought_leadership"),
    (1, "news_commentary"),
    (2, "oddc_education"),
    (3, "thought_leadership"),
    (4, "milestone_or_proof"),
]

SYSTEM_PROMPT = """You are the voice of Mike Ward, Co-Founder of Sentinel Authority — the first independent ODDC (Operational Design Domain Conformance) certification body for autonomous systems.

VOICE: First-person, builder perspective. Authoritative but direct. You've spent years watching autonomous systems operate without any third-party conformance verification and you're doing something about it.

SENTINEL AUTHORITY CONTEXT:
- ODDC = Operational Design Domain Conformance
- ENVELO Interlock = Enforced Non-Violable Execution-Limit Override (runtime boundary enforcement)
- CAT-72 = Conformance Assessment Test (72-hour protocol)
- SA verifies enforcement mechanisms — never claims to guarantee safety or enforce behavior
- B2G first: regulators, policymakers, insurers — then industry
- Core positioning: cuts both ways — protects compliant operators, exposes non-compliant ones
- Website: www.sentinelauthority.org

POST RULES:
- First-person (I, we've, what I've found)
- Opening line: provocative hook — question, stark fact, or bold claim
- Max 5 short paragraphs, generous line breaks
- End with a clear POV or observation — not a pitch
- 3-5 hashtags from: AutonomousSystems ODDC AVSafety Robotics Regulation AV AutonomousVehicles AIRegulation

OUTPUT: Return ONLY valid JSON, no markdown fences:
{
  "body": "full post text with \\n for line breaks",
  "hashtags": ["tag1", "tag2", "tag3"],
  "hook_preview": "first 80 chars for logging"
}"""

TYPE_PROMPTS = {
    "thought_leadership": (
        "Write a thought leadership LinkedIn post from Mike Ward about the regulatory accountability gap "
        "in autonomous systems. Angle: most operators have never been verified against their own declared "
        "operational boundaries. The question is not whether the system is safe in the abstract — "
        "it's whether it did what the operator claimed it would do."
    ),
    "news_commentary": (
        "Write a LinkedIn post from Mike Ward commenting on the current state of autonomous vehicle regulation. "
        "Angle: without conformance verification, investigators cannot determine whether a system was operating "
        "within its declared ODD at the time of an incident. Reference NHTSA, UNECE WP.29, or EU AI Act."
    ),
    "oddc_education": (
        "Write an educational LinkedIn post from Mike Ward explaining one aspect of ODDC conformance. "
        "Choose one: what the ENVELO Interlock enforces at runtime, what CAT-72 measures over 72 hours, "
        "the difference between safety certification and conformance assessment, or why operators rarely "
        "define their ODD with enough precision to be verified."
    ),
    "milestone_or_proof": (
        "Write a LinkedIn post from Mike Ward building credibility for Sentinel Authority. "
        "Frame the absence of any ODDC standard as a structural gap — not a startup claim but an observable fact. "
        "Draw a parallel to how UL Laboratories or aviation ICAO emerged. "
        "End with: operators should understand their conformance posture before a regulator asks."
    ),
}


async def get_member_urn(access_token: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        data = r.json()
        sub = data.get("sub", "")
        if sub.startswith("urn:li:person:"):
            return sub
        return f"urn:li:person:{sub}"


async def generate_post(post_type: str) -> dict:
    prompt = TYPE_PROMPTS.get(post_type, TYPE_PROMPTS["thought_leadership"])
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1000,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        data = r.json()
    text = data["content"][0]["text"].strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def post_to_linkedin(body: str, hashtags: list) -> bool:
    access_token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    if not access_token:
        logger.error("[LINKEDIN] No LINKEDIN_ACCESS_TOKEN set")
        return False

    try:
        author_urn = await get_member_urn(access_token)
        logger.info(f"[LINKEDIN] Posting as {author_urn}")
    except Exception as e:
        logger.error(f"[LINKEDIN] Failed to get member URN: {e}")
        return False

    hashtag_str = " ".join(f"#{h.lstrip('#')}" for h in hashtags)
    full_text = f"{body}\n\n{hashtag_str}"

    payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": full_text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            json=payload,
        )

    if r.status_code in (200, 201):
        logger.info(f"[LINKEDIN] Posted. ID: {r.headers.get('x-restli-id', 'unknown')}")
        return True
    else:
        logger.error(f"[LINKEDIN] Failed {r.status_code}: {r.text}")
        return False


async def run_daily_post():
    if os.environ.get("LINKEDIN_POSTING_ENABLED", "false").lower() != "true":
        logger.info("[LINKEDIN] Disabled")
        return

    today_dow = datetime.now().weekday()
    if today_dow > 4:
        return

    post_type = WEEKLY_ROTATION[today_dow][1]
    logger.info(f"[LINKEDIN] Generating {post_type}")

    try:
        result = await generate_post(post_type)
        logger.info(f"[LINKEDIN] Hook: {result.get('hook_preview', '')[:80]}")
        await post_to_linkedin(result["body"], result["hashtags"])
    except Exception as e:
        logger.error(f"[LINKEDIN] Error: {e}", exc_info=True)


def start_linkedin_scheduler(scheduler: AsyncIOScheduler):
    scheduler.add_job(
        run_daily_post,
        trigger="cron",
        hour=13,
        minute=0,
        day_of_week="mon-fri",
        id="linkedin_daily_post",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("[LINKEDIN] Scheduler registered — Mon–Fri 8:00 AM ET")
