#!/usr/bin/env python3
"""
fix_inline_styles.py
Sentinel Authority — Fix inline <style> overrides on all subpages.

Targets:
  - html/body background: #f5f5f7 → #ffffff
  - body::before radial-gradient backgrounds → plain white
  - --purple-bright remaining uses
  - body background: #f5f5f7 inline

Run from the website directory:
  python3 fix_inline_styles.py
"""

import re, shutil, glob
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
SKIP = {'draft.html', 'mobile-diag.html'}

html_files = sorted([
    f for f in glob.glob("*.html")
    if not any(f.endswith(p) for p in SKIP)
    and not re.search(r'\.(backup|bak\d*|save|clean|broken|golden|good)', f)
    and not f.startswith('google')
])

print(f"Processing {len(html_files)} files...\n")

for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        html = f.read()

    original = html
    changes = []

    # ── 1. html/body background #f5f5f7 → #ffffff ──────────────────────────
    for pattern, replacement in [
        ('background:#f5f5f7;', 'background:#ffffff;'),
        ('background: #f5f5f7;', 'background: #ffffff;'),
        ('background:#f5f5f7 ', 'background:#ffffff '),
        ('background: #f5f5f7 ', 'background: #ffffff '),
    ]:
        if pattern in html:
            html = html.replace(pattern, replacement)
            changes.append(f'#f5f5f7 → #ffffff')

    # ── 2. body::before radial-gradient → plain white ──────────────────────
    # Matches body::before { ... background: radial-gradient(...) ... }
    before_pattern = re.compile(
        r'(body::before\s*\{[^}]*background\s*:\s*)radial-gradient\([^;]+\)',
        re.DOTALL
    )
    if before_pattern.search(html):
        html = before_pattern.sub(r'\1var(--bg)', html)
        changes.append('body::before radial-gradient stripped')

    # Also catch the fixed background on body::before
    html = re.sub(
        r'(body::before\s*\{[^}]*background\s*:\s*)#f9fafb',
        r'\1var(--bg)',
        html
    )
    html = re.sub(
        r'(body::before\s*\{[^}]*background\s*:\s*)#f5f5f7',
        r'\1var(--bg)',
        html
    )

    # ── 3. --purple-bright remaining uses → institutional indigo ───────────
    html = html.replace('--purple-bright:#6b5a9e', '--purple-bright:#2a2560')
    html = html.replace('--purple-bright: #6b5a9e', '--purple-bright: #2a2560')

    # ── 4. skip-link border using var(--purple-bright) is fine now ─────────
    # (it'll resolve to #2a2560 which is correct)

    # ── 5. bg-deep overrides that set non-white ─────────────────────────────
    html = re.sub(r'--bg-deep\s*:\s*#f5f5f7', '--bg-deep: #ffffff', html)

    # ── 6. Inline html { background: ... } that sets gray ──────────────────
    html = re.sub(
        r'(html\s*\{[^}]*)background\s*:\s*#f5f5f7',
        r'\1background: #ffffff',
        html
    )
    html = re.sub(
        r'(html\s*\{[^}]*)background\s*:\s*#f9fafb',
        r'\1background: #ffffff',
        html
    )

    # ── 7. Inline body { background: ... } that sets gray ──────────────────
    html = re.sub(
        r'(body\s*\{[^}]*)background\s*:\s*#f5f5f7',
        r'\1background: #ffffff',
        html,
        flags=re.DOTALL
    )
    html = re.sub(
        r'(body\s*\{[^}]*)background\s*:\s*#f9fafb',
        r'\1background: #ffffff',
        html,
        flags=re.DOTALL
    )

    if html != original:
        bak = fname + f'.backup-inline-{STAMP}'
        shutil.copy(fname, bak)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'  ✓ {fname}: {", ".join(set(changes))}')
    else:
        print(f'  – {fname}: no changes needed')

print(f'\n✅ Done. Run ./deploy.sh')
