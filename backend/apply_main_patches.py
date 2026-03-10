#!/usr/bin/env python3
"""
Apply targeted security patches to main.py.
Run from backend/ directory: python apply_main_patches.py
"""

import re
import sys

TARGET = "main.py"

with open(TARGET, "r") as f:
    src = f.read()

original = src
patches_applied = []

# ─── 1. Fix malformed nested except in org migration ──────────────────────────
# The original has a bad try/except structure that would be a SyntaxError
old_org_block = '''        except Exception as e:
            logger.warning(f"Org table migration: {e}")
        
            logger.info("Org schema migration complete")
        except Exception as e:
            logger.warning(f"Org schema note: {e}")'''

new_org_block = '''        except Exception as e:
            logger.warning(f"Org table migration: {e}")
        else:
            logger.info("Org schema migration complete")'''

if old_org_block in src:
    src = src.replace(old_org_block, new_org_block)
    patches_applied.append("1. Fixed malformed nested except in org migration")

# ─── 2. Fix hardcoded audit anchor secret fallback ────────────────────────────
old_anchor_secret = 'secret = os.environ.get("SECRET_KEY", "sentinel-authority-secret")'
new_anchor_secret = '''secret = (os.environ.get("SECRET_KEY") or "").strip()
                if not secret:
                    logger.warning("SECRET_KEY not set — skipping auto audit anchor")
                    need_anchor = False'''

# Only patch the first occurrence (in lifespan, not in audit.py)
if old_anchor_secret in src:
    src = src.replace(old_anchor_secret, new_anchor_secret, 1)
    patches_applied.append("2. Fixed hardcoded audit anchor secret fallback")

# ─── 3. Remove second duplicate start_x_scheduler call ───────────────────────
# There are two calls to start_x_scheduler(renewal_scheduler) in the lifespan block
# and two more in start_backup_scheduler. Remove the duplicates.
old_dup_x = '''            from x_poster import start_x_scheduler
            start_x_scheduler(renewal_scheduler)
            logger.info("[EXPOSURE] Agent scheduled — 7am Toronto daily")
            logger.info("[ENGAGEMENT] Agent scheduled — every 30 minutes")
            logger.info("[RENEWAL] Daily cron scheduled — 6am UTC")'''

new_dup_x = '''            logger.info("[RENEWAL] Daily cron scheduled — 6am UTC")'''

if old_dup_x in src:
    src = src.replace(old_dup_x, new_dup_x)
    patches_applied.append("3. Removed duplicate start_x_scheduler call in start_backup_scheduler")

# Also remove the duplicate in the @on_event block
old_dup_x2 = '''        from x_poster import start_x_scheduler
        start_x_scheduler(renewal_scheduler)
        logger.info("[EXPOSURE] Agent scheduled — 7am Toronto daily")
        logger.info("[ENGAGEMENT] Agent scheduled — every 30 minutes")'''

# Only if there are two occurrences
count_x = src.count("start_x_scheduler(renewal_scheduler)")
if count_x > 1:
    # Find last occurrence index and remove the block around it
    idx = src.rfind("start_x_scheduler(renewal_scheduler)")
    # Remove the two lines containing the duplicate import + call
    lines = src.split("\n")
    new_lines = []
    skip_next = False
    seen_x = 0
    for line in lines:
        if "start_x_scheduler(renewal_scheduler)" in line:
            seen_x += 1
            if seen_x > 1:
                # Remove this line and the import line before it
                if new_lines and "from x_poster import start_x_scheduler" in new_lines[-1]:
                    new_lines.pop()
                continue
        new_lines.append(line)
    src = "\n".join(new_lines)
    patches_applied.append("3b. Removed second duplicate start_x_scheduler in on_event block")

# ─── 4. Remove duplicate health_check route definition ───────────────────────
# There are two @app.get("/health") decorators — one with the full implementation
# and one with just {"status": "healthy"}. Remove the second bare one.
old_bare_health = '''@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "healthy"}'''

if old_bare_health in src:
    src = src.replace(old_bare_health, "")
    patches_applied.append("4. Removed duplicate bare health_check route")

# ─── 5. Remove duplicate test_x_post route definition ────────────────────────
# Count occurrences
x_post_count = src.count('@app.post("/api/admin/x/test-post"')
if x_post_count > 1:
    # Find and remove the second occurrence (last one)
    idx = src.rfind('@app.post("/api/admin/x/test-post"')
    # Find end of this function
    end_idx = src.find("\n\n", idx)
    if end_idx == -1:
        end_idx = len(src)
    # Also find the decorated function end
    next_decorator = src.find("\n@", idx + 1)
    if next_decorator != -1 and next_decorator < end_idx + 200:
        end_idx = next_decorator
    src = src[:idx] + src[end_idx:]
    patches_applied.append("5. Removed duplicate test_x_post route")

# ─── 6. Add production startup guard at top of lifespan ──────────────────────
startup_guard = '''    # Production startup guard — fail fast if misconfigured
    import os as _os_guard
    if _os_guard.environ.get("ENVIRONMENT", "development") == "production":
        _secret = (_os_guard.environ.get("SECRET_KEY") or "").strip()
        if not _secret or len(_secret) < 32:
            raise RuntimeError(
                "FATAL: SECRET_KEY must be set to at least 32 characters in production. "
                "Set the SECRET_KEY environment variable and redeploy."
            )
        if _os_guard.environ.get("DEBUG", "").lower() in ("1", "true", "yes"):
            raise RuntimeError(
                "FATAL: DEBUG=True in production is not allowed."
            )
    logger.info("Startup checks passed")

'''

target_for_guard = '    logger.info("Starting Sentinel Authority Platform...")\n    await init_db()'
if startup_guard.strip() not in src and target_for_guard in src:
    src = src.replace(
        '    logger.info("Starting Sentinel Authority Platform...")\n    await init_db()',
        '    logger.info("Starting Sentinel Authority Platform...")\n' + startup_guard + '    await init_db()',
    )
    patches_applied.append("6. Added production startup guard (SECRET_KEY + DEBUG check)")

# ─── Report ────────────────────────────────────────────────────────────────────
if not patches_applied:
    print("No patches applied — patterns may have already been fixed or changed.")
    sys.exit(0)

with open(TARGET, "w") as f:
    f.write(src)

print(f"Patched {TARGET} successfully:")
for p in patches_applied:
    print(f"  ✓ {p}")
print(f"\n{len(patches_applied)} patches applied.")
