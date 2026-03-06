"""
Sentinel Authority — Autonomous X (Twitter) Poster
Posts as @SentinelAuth Mon–Fri at 9 AM ET via Railway APScheduler.

ENV VARS:
  X_CONSUMER_KEY        — API Key
  X_CONSUMER_SECRET     — API Key Secret
  X_ACCESS_TOKEN        — Access Token (Read+Write)
  X_ACCESS_TOKEN_SECRET — Access Token Secret
  X_POSTING_ENABLED     — "true" to activate
  ANTHROPIC_API_KEY     — already set on Railway
"""

import os
import json
import logging
import tweepy
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("sentinel.x")

WEEKLY_ROTATION = [
    (0, "thought_leadership"),
    (1, "news_commentary"),
    (2, "oddc_education"),
    (3, "thought_leadership"),
    (4, "milestone_or_proof"),
]

SYSTEM_PROMPT = """You are the voice of Sentinel Authority (@SentinelAuth) — the first independent ODDC (Operational Design Domain Conformance) certification body for autonomous systems.

VOICE: Authoritative, institutional, direct. Built for regulators and policymakers first. No hype, no startup energy.

SENTINEL AUTHORITY CONTEXT:
- ODDC = Operational Design Domain Conformance
- ENVELO Interlock = Enforced Non-Violable Execution-Limit Override (runtime boundary enforcement)
- CAT-72 = Conformance Assessment Test (72-hour protocol)
- SA verifies enforcement mechanisms — never claims to guarantee safety or enforce behavior
- Core positioning: cuts both ways — protects compliant operators, exposes non-compliant ones
- Website: www.sentinelauthority.org

X/TWITTER POST RULES:
- Max 280 characters total including hashtags
- No threads — single punchy post only
- Opening: bold declarative statement or uncomfortable question
- End with 1-2 hashtags max: #ODDC #AutonomousSystems #AVSafety #Robotics #AIRegulation
- No emojis unless they add meaning
- No "we" — institutional voice, not cheerleader

OUTPUT: Return ONLY valid JSON, no markdown fences:
{
  "text": "full post text under 260 chars",
  "hashtags": ["tag1", "tag2"],
  "hook_preview": "first 60 chars for logging"
}"""

TYPE_PROMPTS = {
    "thought_leadership": (
        "Write a single punchy X post from Sentinel Authority about the accountability gap in autonomous systems. "
        "Core message: operators claim systems operate within declared boundaries. Nobody verifies that claim. "
        "Under 260 characters before hashtags."
    ),
    "news_commentary": (
        "Write a single punchy X post from Sentinel Authority commenting on autonomous vehicle regulation. "
        "Angle: incident investigators cannot determine ODD conformance without independent verification records. "
        "Under 260 characters before hashtags."
    ),
    "oddc_education": (
        "Write a single punchy X post from Sentinel Authority explaining one core concept: "
        "ODD conformance, ENVELO Interlock enforcement, CAT-72 testing, or the difference between "
        "safety certification and conformance assessment. Under 260 characters before hashtags."
    ),
    "milestone_or_proof": (
        "Write a single punchy X post from Sentinel Authority positioning ODDC as the missing standard. "
        "Draw a parallel to UL Laboratories or ICAO. "
        "End with: operators should know their conformance posture. Under 260 characters before hashtags."
    ),
}


def _oauth1_header(method: str, url: str, params: dict) -> str:
    consumer_key = os.environ["X_CONSUMER_KEY"]
    consumer_secret = os.environ["X_CONSUMER_SECRET"]
    access_token = os.environ["X_ACCESS_TOKEN"]
    token_secret = os.environ["X_ACCESS_TOKEN_SECRET"]

    oauth_params = {
        "oauth_consumer_key": consumer_key,
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }

    all_params = {**params, **oauth_params}
    sorted_params = sorted(all_params.items())
    param_string = "&".join(f"{quote(k, safe='')}={quote(str(v), safe='')}" for k, v in sorted_params)
    base_string = f"{method.upper()}&{quote(url, safe='')}&{quote(param_string, safe='')}"
    signing_key = f"{quote(consumer_secret, safe='')}&{quote(token_secret, safe='')}"
    signature = hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1)
    oauth_params["oauth_signature"] = __import__("base64").b64encode(signature.digest()).decode()

    header_parts = ", ".join(
        f'{quote(k, safe="")}="{quote(str(v), safe="")}"'
        for k, v in sorted(oauth_params.items())
    )
    return f"OAuth {header_parts}"


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
                "max_tokens": 500,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        data = r.json()
    text = data["content"][0]["text"].strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def post_to_x(text: str, hashtags: list) -> bool:
    hashtag_str = " ".join(f"#{h.lstrip('#')}" for h in hashtags)
    full_text = f"{text} {hashtag_str}".strip()
    if len(full_text) > 280:
        full_text = full_text[:277] + "..."

    try:
        client = tweepy.Client(
            consumer_key=os.environ["X_CONSUMER_KEY"],
            consumer_secret=os.environ["X_CONSUMER_SECRET"],
            access_token=os.environ["X_ACCESS_TOKEN"],
            access_token_secret=os.environ["X_ACCESS_TOKEN_SECRET"],
        )
        response = client.create_tweet(text=full_text)
        tweet_id = response.data["id"]
        logger.info(f"[X] Posted tweet ID: {tweet_id}")
        logger.info(f"[X] Text: {full_text[:80]}")
        return True
    except Exception as e:
        logger.error(f"[X] Failed: {e}")
        return False


async def run_daily_x_post():
    if os.environ.get("X_POSTING_ENABLED", "false").lower() != "true":
        logger.info("[X] Disabled — set X_POSTING_ENABLED=true to activate")
        return

    today_dow = datetime.now().weekday()
    if today_dow > 4:
        return

    post_type = WEEKLY_ROTATION[today_dow][1]
    logger.info(f"[X] Generating {post_type}")

    try:
        result = await generate_post(post_type)
        logger.info(f"[X] Hook: {result.get('hook_preview', '')[:60]}")
        await post_to_x(result["text"], result["hashtags"])
    except Exception as e:
        logger.error(f"[X] Error: {e}", exc_info=True)


def start_x_scheduler(scheduler: AsyncIOScheduler):
    scheduler.add_job(
        run_daily_x_post,
        trigger="cron",
        hour=14,
        minute=0,
        day_of_week="mon-fri",
        id="x_daily_post",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("[X] Scheduler registered — Mon–Fri 9:00 AM ET")
