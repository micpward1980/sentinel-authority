"""
SA Exposure Agent — Autonomous Exposure Engine for Sentinel Authority
=====================================================================
Drops into ~/Downloads/sentinel-authority/backend/app/exposure_agent.py

Schedule: runs daily at 7:00 AM ET via APScheduler in main.py

ENV VARS NEEDED (add to Railway):
  ANTHROPIC_API_KEY          — already set
  LINKEDIN_ACCESS_TOKEN      — from linkedin.com/developers
  LINKEDIN_COMPANY_ID        — numeric ID of SA company page
  TWITTER_API_KEY            — from developer.twitter.com
  TWITTER_API_SECRET
  TWITTER_ACCESS_TOKEN
  TWITTER_ACCESS_SECRET
  RESEND_API_KEY             — already set
  DIGEST_EMAIL               — micpward@gmail.com
  SA_INTERNAL_API_URL        — https://your-railway-backend.up.railway.app
  SA_INTERNAL_API_KEY        — any secret string
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional
import httpx
import anthropic

logger = logging.getLogger("exposure_agent")

ANTHROPIC_API_KEY     = os.getenv("ANTHROPIC_API_KEY")
LINKEDIN_ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN")
LINKEDIN_COMPANY_ID   = os.getenv("LINKEDIN_COMPANY_ID")
TWITTER_API_KEY       = os.getenv("TWITTER_API_KEY")
TWITTER_API_SECRET    = os.getenv("TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN  = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_SECRET = os.getenv("TWITTER_ACCESS_SECRET")
RESEND_API_KEY        = os.getenv("RESEND_API_KEY")
DIGEST_EMAIL          = os.getenv("DIGEST_EMAIL", "micpward@gmail.com")
SA_INTERNAL_API_URL   = os.getenv("SA_INTERNAL_API_URL", "")
SA_INTERNAL_API_KEY   = os.getenv("SA_INTERNAL_API_KEY", "")

client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

SA_SYSTEM = """You are the voice of Sentinel Authority — the world's first independent ODDC
(Operational Design Domain Conformance) certification body for autonomous systems.

SA positioning:
- We verify enforcement mechanisms work, not that systems are "safe"
- Independent body: cuts both ways — protects compliant operators, exposes non-compliant ones
- B2G-first: regulators are our primary market
- Core: CAT-72 (Conformance Assessment Test — 72 hours) + ENVELO Interlock (Enforced Non-Violable Execution-Limit Override)
- Founded by Mike Ward and Doug Ward, Ontario, Canada

Voice: authoritative, institutional, measured. Never startup-y or hype-driven."""

INTEL_SOURCES = [
    {"id": "faa",         "label": "FAA Dockets",       "query": "FAA autonomous systems certification rulemaking BVLOS 2025 2026"},
    {"id": "sam",         "label": "SAM.gov RFPs",       "query": "SAM.gov autonomous systems certification conformance assessment RFP 2026"},
    {"id": "nhtsa",       "label": "NHTSA",              "query": "NHTSA autonomous vehicle regulation guidance 2025 2026"},
    {"id": "tc",          "label": "Transport Canada",   "query": "Transport Canada autonomous systems drone certification RPAS 2025 2026"},
    {"id": "easa",        "label": "EASA",               "query": "EASA autonomous systems drone U-space certification 2026"},
    {"id": "incidents",   "label": "AV Incidents",       "query": "autonomous vehicle crash incident accountability self-driving failure 2026"},
    {"id": "congress",    "label": "Congress",           "query": "congressional hearing autonomous vehicles AI legislation bill 2026"},
    {"id": "conferences", "label": "Conferences",        "query": "autonomous systems safety certification conference call for papers 2026"},
]


async def scan_source(source: dict) -> dict:
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=SA_SYSTEM + "\n\nReturn ONLY valid JSON, no markdown.",
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": f"""Search: {source['query']}

Return JSON only:
{{"hits": [{{"title": "", "summary": "", "source": "", "date": "", "relevance": "HIGH|MEDIUM|LOW", "action": ""}}]}}

Find 1-3 specific recent actionable items."""}]
        )
        import json
        text = "".join(b.text for b in response.content if b.type == "text")
        clean = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean)
        hits = parsed.get("hits", [])
        for h in hits:
            h["source_label"] = source["label"]
        logger.info(f"[{source['id']}] {len(hits)} hits")
        return {"source": source["label"], "hits": hits}
    except Exception as e:
        logger.error(f"[{source['id']}] scan failed: {e}")
        return {"source": source["label"], "hits": []}


async def generate_linkedin_post(top_hits: list) -> str:
    context = "\n\n".join([
        f"STORY: {h['title']}\nSUMMARY: {h['summary']}\nSOURCE: {h['source']}"
        for h in top_hits[:3]
    ])
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=SA_SYSTEM,
        messages=[{"role": "user", "content": f"""Write a LinkedIn post for Sentinel Authority's company page.

INTELLIGENCE:
{context}

- 180-260 words
- Hook first line, no clichés
- Reference the specific regulatory development
- Connect to ODDC conformance certification
- Close with sharp observation, not a sales pitch
- Max 3 hashtags: #AutonomousSystems #ODDConformance #Certification

Post only, no explanation."""}]
    )
    return response.content[0].text.strip()


async def generate_x_thread(top_hits: list) -> list:
    context = "\n\n".join([f"STORY: {h['title']}\nSUMMARY: {h['summary']}" for h in top_hits[:2]])
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=SA_SYSTEM,
        messages=[{"role": "user", "content": f"""Write a 4-tweet X thread for @SentinelAuth.

INTELLIGENCE:
{context}

1/4: Hook
2/4: What's happening in regulation
3/4: What ODDC conformance solves
4/4: Sharp close

Each tweet under 275 chars. Number as 1/4 etc. Separate with ---"""}]
    )
    raw = response.content[0].text.strip()
    return [t.strip() for t in raw.split("---") if t.strip()][:4]


async def generate_blog_post(top_hits: list) -> dict:
    if not top_hits:
        return {}
    best = top_hits[0]
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=900,
        system=SA_SYSTEM,
        messages=[{"role": "user", "content": f"""Write a blog post for sentinelauthority.org.

STORY: {best['title']}
SUMMARY: {best['summary']}
SOURCE: {best['source']}

- Title + 400-500 word post
- Institutional tone
- Frame regulatory gap, connect to ODDC conformance
- End with CTA: contact SA for a briefing

Format:
TITLE: [title]
BODY:
[body]"""}]
    )
    text = response.content[0].text.strip()
    lines = text.split("\n", 2)
    title = lines[0].replace("TITLE:", "").strip()
    body = "\n".join(lines[1:]).replace("BODY:", "").strip()
    return {"title": title, "body": body}


async def post_to_linkedin(text: str) -> Optional[str]:
    if not LINKEDIN_ACCESS_TOKEN or not LINKEDIN_COMPANY_ID:
        logger.warning("LinkedIn credentials not set — skipping")
        return None
    try:
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                "https://api.linkedin.com/v2/ugcPosts",
                headers={
                    "Authorization": f"Bearer {LINKEDIN_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                },
                json={
                    "author": f"urn:li:organization:{LINKEDIN_COMPANY_ID}",
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {"text": text},
                            "shareMediaCategory": "NONE"
                        }
                    },
                    "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
                },
                timeout=15
            )
            if resp.status_code in (200, 201):
                return resp.json().get("id", "ok")
            logger.error(f"LinkedIn {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"LinkedIn failed: {e}")
        return None


async def post_to_x(tweets: list) -> Optional[str]:
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET]):
        logger.warning("X credentials not set — skipping")
        return None
    try:
        from requests_oauthlib import OAuth1Session
        oauth = OAuth1Session(
            TWITTER_API_KEY, client_secret=TWITTER_API_SECRET,
            resource_owner_key=TWITTER_ACCESS_TOKEN, resource_owner_secret=TWITTER_ACCESS_SECRET
        )
        reply_to = None
        first_id = None
        for tweet in tweets:
            payload = {"text": tweet[:275]}
            if reply_to:
                payload["reply"] = {"in_reply_to_tweet_id": reply_to}
            resp = oauth.post("https://api.twitter.com/2/tweets", json=payload)
            if resp.status_code == 201:
                tid = resp.json()["data"]["id"]
                if not first_id:
                    first_id = tid
                reply_to = tid
                await asyncio.sleep(1)
            else:
                logger.error(f"X {resp.status_code}: {resp.text[:200]}")
                break
        return first_id
    except Exception as e:
        logger.error(f"X failed: {e}")
        return None


async def send_digest(all_hits, linkedin_post, tweets, blog_post, linkedin_id, x_id, blog_id):
    if not RESEND_API_KEY:
        logger.warning("Resend not set — skipping digest")
        return
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        high = [h for h in all_hits if h.get("relevance") == "HIGH"]
        date_str = datetime.now().strftime("%A, %B %-d, %Y")

        def status(label, id_val):
            icon = "✅" if id_val else "⚠️"
            note = f"posted (ID: {id_val})" if id_val else "not posted — credentials needed"
            return f"<div style='margin-bottom:6px'>{icon} <strong>{label}</strong> — {note}</div>"

        html = f"""<div style="font-family:system-ui;max-width:680px;margin:0 auto;color:#0f1021">
  <div style="background:#2a2560;padding:20px 28px">
    <div style="font-size:10px;font-family:monospace;letter-spacing:3px;color:rgba(255,255,255,0.5)">SENTINEL AUTHORITY</div>
    <div style="font-size:18px;font-weight:600;color:white;margin-top:4px">Daily Exposure Digest</div>
    <div style="font-size:10px;font-family:monospace;color:rgba(255,255,255,0.4);margin-top:4px">{date_str}</div>
  </div>
  <div style="padding:16px 28px;background:#F2F1F6;border-bottom:1px solid #D4D2DE">
    <strong>{len(all_hits)}</strong> intel items &nbsp;·&nbsp; <strong style="color:#c0392b">{len(high)} HIGH priority</strong>
  </div>
  <div style="padding:16px 28px;background:white;border-bottom:1px solid #eee">
    <div style="font-size:10px;font-family:monospace;letter-spacing:2px;color:#999;margin-bottom:10px">POSTED TODAY</div>
    {status("LinkedIn", linkedin_id)}
    {status("X/Twitter", x_id)}
    {status("Blog", blog_id)}
  </div>
  <div style="padding:16px 28px;background:white;border-bottom:1px solid #eee">
    <div style="font-size:10px;font-family:monospace;letter-spacing:2px;color:#999;margin-bottom:8px">LINKEDIN POST</div>
    <div style="background:#F2F1F6;padding:14px;font-size:13px;line-height:1.7;white-space:pre-wrap">{linkedin_post}</div>
  </div>
  <div style="padding:16px 28px;background:white;border-bottom:1px solid #eee">
    <div style="font-size:10px;font-family:monospace;letter-spacing:2px;color:#999;margin-bottom:8px">X THREAD</div>
    {"".join(f'<div style="background:#F2F1F6;padding:10px;font-size:13px;line-height:1.6;margin-bottom:6px">{t}</div>' for t in tweets)}
  </div>
  {"" if not blog_post else f'<div style="padding:16px 28px;background:white"><div style="font-size:10px;font-family:monospace;letter-spacing:2px;color:#999;margin-bottom:8px">BLOG POST</div><div style="font-size:15px;font-weight:600;margin-bottom:8px">{blog_post.get("title","")}</div><div style="font-size:13px;line-height:1.7;color:#444">{blog_post.get("body","")[:500]}...</div></div>'}
  <div style="padding:12px 28px;background:#F2F1F6;font-size:9px;font-family:monospace;color:#aaa">SENTINEL AUTHORITY EXPOSURE AGENT · {date_str.upper()}</div>
</div>"""

        resend.Emails.send({
            "from": "SA Exposure Agent <noreply@sentinelauthority.org>",
            "to": [e.strip() for e in DIGEST_EMAIL.split(",")],
            "subject": f"SA Daily Digest — {len(all_hits)} hits, {len(high)} HIGH · {datetime.now().strftime('%b %-d')}",
            "html": html
        })
        logger.info(f"Digest sent to {DIGEST_EMAIL}")
    except Exception as e:
        logger.error(f"Digest failed: {e}")


async def run_exposure_agent():
    """Main entry point — called by APScheduler daily at 7am Toronto."""
    logger.info("=== SA Exposure Agent starting ===")
    start = datetime.utcnow()

    # 1. Scan all sources concurrently
    results = await asyncio.gather(*[scan_source(s) for s in INTEL_SOURCES], return_exceptions=True)
    all_hits = []
    for r in results:
        if isinstance(r, dict):
            all_hits.extend(r.get("hits", []))

    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_hits.sort(key=lambda h: order.get(h.get("relevance", "LOW"), 2))

    if not all_hits:
        logger.warning("No hits — aborting")
        return

    logger.info(f"{len(all_hits)} hits total")

    # 2. Generate content
    top = all_hits[:5]
    linkedin_post, tweets, blog_post = await asyncio.gather(
        generate_linkedin_post(top),
        generate_x_thread(top),
        generate_blog_post(top),
    )

    # 3. Post
    linkedin_id, x_id, blog_id = await asyncio.gather(
        post_to_linkedin(linkedin_post),
        post_to_x(tweets),
        asyncio.coroutine(lambda: None)() if True else None,
    )

    # 4. Digest
    await send_digest(all_hits, linkedin_post, tweets, blog_post, linkedin_id, x_id, None)

    elapsed = (datetime.utcnow() - start).total_seconds()
    logger.info(f"=== SA Exposure Agent done in {elapsed:.1f}s ===")

# ─── Tier 1: Mention Monitoring ──────────────────────────────────────────────

_replied_ids: set = set()
_quoted_ids: set = set()
_last_mention_id: str = ""

async def check_mentions() -> None:
    global _last_mention_id
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET]):
        return
    try:
        from requests_oauthlib import OAuth1Session
        oauth = OAuth1Session(TWITTER_API_KEY, client_secret=TWITTER_API_SECRET, resource_owner_key=TWITTER_ACCESS_TOKEN, resource_owner_secret=TWITTER_ACCESS_SECRET)
        params = {"max_results": 10, "tweet.fields": "author_id,text"}
        if _last_mention_id:
            params["since_id"] = _last_mention_id
        resp = oauth.get("https://api.twitter.com/2/tweets/search/recent", params={"query": "@SentinelAuthority -is:retweet", **params})
        if resp.status_code != 200:
            return
        data = resp.json()
        mentions = data.get("data", [])
        if not mentions:
            return
        _last_mention_id = mentions[0]["id"]
        replied = 0
        for mention in mentions:
            tid = mention["id"]
            text = mention.get("text", "")
            if tid in _replied_ids or replied >= 5:
                continue
            response = await client.messages.create(model="claude-sonnet-4-20250514", max_tokens=200, system=SA_SYSTEM + "\n\nWrite a single reply tweet under 260 chars. Authoritative, adds value, no hashtags, no emojis. Never promotional.", messages=[{"role": "user", "content": f"Someone mentioned @SentinelAuthority with: '{text}'\n\nWrite a reply that adds genuine insight about autonomous systems conformance or regulation."}])
            reply_text = response.content[0].text.strip()[:260]
            post_resp = oauth.post("https://api.twitter.com/2/tweets", json={"text": reply_text, "reply": {"in_reply_to_tweet_id": tid}})
            if post_resp.status_code == 201:
                _replied_ids.add(tid)
                replied += 1
                await asyncio.sleep(2)
    except Exception as e:
        logger.error(f"Mention check failed: {e}")

ENGAGEMENT_KEYWORDS = ["autonomous vehicle crash","self-driving accident","AV regulation","drone certification","autonomous systems safety","BVLOS certification","self-driving accountability","autonomous vehicle legislation","AV safety standards","robotaxi incident"]

async def check_keywords() -> None:
    global _quoted_ids
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET]):
        return
    try:
        import random
        from requests_oauthlib import OAuth1Session
        oauth = OAuth1Session(TWITTER_API_KEY, client_secret=TWITTER_API_SECRET, resource_owner_key=TWITTER_ACCESS_TOKEN, resource_owner_secret=TWITTER_ACCESS_SECRET)
        keywords = random.sample(ENGAGEMENT_KEYWORDS, min(2, len(ENGAGEMENT_KEYWORDS)))
        quoted_this_run = 0
        for keyword in keywords:
            if quoted_this_run >= 3:
                break
            resp = oauth.get("https://api.twitter.com/2/tweets/search/recent", params={"query": f'"{keyword}" -is:retweet -is:reply lang:en min_faves:10', "max_results": 10, "tweet.fields": "author_id,text,public_metrics", "expansions": "author_id", "user.fields": "public_metrics"})
            if resp.status_code != 200:
                continue
            data = resp.json()
            tweets = data.get("data", [])
            users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}
            for tweet in tweets:
                tid = tweet["id"]
                if tid in _quoted_ids or quoted_this_run >= 3:
                    continue
                author = users.get(tweet.get("author_id", ""), {})
                followers = author.get("public_metrics", {}).get("followers_count", 0)
                if followers < 500:
                    continue
                tweet_text = tweet.get("text", "")
                response = await client.messages.create(model="claude-sonnet-4-20250514", max_tokens=200, system=SA_SYSTEM + "\n\nWrite a quote tweet under 240 chars. Add genuine insight. Reference the gap that independent ODDC conformance certification fills. No hashtags. No self-promotion. Authoritative.", messages=[{"role": "user", "content": f"Quote tweet this with SA perspective:\n\n'{tweet_text}'\n\nKeyword: {keyword}"}])
                qt_text = response.content[0].text.strip()[:240]
                post_resp = oauth.post("https://api.twitter.com/2/tweets", json={"text": f"{qt_text} https://twitter.com/i/web/status/{tid}"})
                if post_resp.status_code == 201:
                    _quoted_ids.add(tid)
                    quoted_this_run += 1
                    await asyncio.sleep(3)
                    break
    except Exception as e:
        logger.error(f"Keyword engagement failed: {e}")

async def run_engagement_agent() -> None:
    logger.info("=== SA Engagement Agent running ===")
    await asyncio.gather(check_mentions(), check_keywords())
    logger.info("=== SA Engagement Agent done ===")
