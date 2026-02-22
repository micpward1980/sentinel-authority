#!/usr/bin/env python3
"""
apply_logo.py
Replaces the old brand-mark + brand-name HTML with the new SVG logo.
Also injects League Spartan font where missing.

Run from the website directory:
  python3 apply_logo.py
"""

import re, shutil, glob
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
SKIP = {'draft.html', 'mobile-diag.html'}

# ── New logo SVG (nav size) ───────────────────────────────────────────────────
# Scaled to 44px tall, preserves viewBox proportions
NEW_LOGO_SVG = '''<svg width="207" height="44" viewBox="0 0 460 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Sentinel Authority">
        <circle cx="62" cy="60" r="50" stroke="#0f1021" stroke-width="3.4"/>
        <circle cx="62" cy="60" r="43" stroke="#0f1021" stroke-width="1.1" stroke-opacity="0.20"/>
        <text x="62" y="74" text-anchor="middle" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="40" fill="#0f1021" letter-spacing="-1.1">SA</text>
        <text x="132" y="54" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="34" fill="#0f1021" letter-spacing="-0.15">SENTINEL</text>
        <text x="132" y="84" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="34" fill="#0f1021" letter-spacing="-0.25">AUTHORITY</text>
      </svg>'''

# ── Font tag to inject ────────────────────────────────────────────────────────
LEAGUE_SPARTAN_LINK = '<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap" rel="stylesheet">'

# ── Old brand patterns to replace ────────────────────────────────────────────
# index.html style: <div class="brand-mark"...><div class="brand-mark-inner"></div></div><div class="brand-name">Sentinel Authority</div>
OLD_BRAND_PATTERN = re.compile(
    r'<div class="brand-mark"[^>]*>.*?</div>\s*<div class="brand-name">[^<]*</div>',
    re.DOTALL
)

# Some subpages may use different brand markup — also catch plain text brand
OLD_BRAND_TEXT_PATTERN = re.compile(
    r'<span class="brand-name">[^<]*</span>|<div class="brand-name">[^<]*</div>'
)

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

    # 1. Inject League Spartan if not already present
    if 'League+Spartan' not in html and 'League Spartan' not in html:
        # Insert after first google fonts preconnect, or before </head>
        if 'fonts.googleapis.com' in html:
            html = re.sub(
                r'(<link[^>]+fonts\.googleapis\.com[^>]+>)',
                r'\1\n  ' + LEAGUE_SPARTAN_LINK,
                html, count=1
            )
        else:
            html = html.replace('</head>', f'  {LEAGUE_SPARTAN_LINK}\n</head>', 1)
        changes.append('League Spartan font injected')

    # 2. Replace old brand-mark div structure
    if OLD_BRAND_PATTERN.search(html):
        html = OLD_BRAND_PATTERN.sub(NEW_LOGO_SVG, html)
        changes.append('brand-mark replaced with SVG')

    # 3. Strip old brand CSS that sized the square mark
    # (brand-mark, brand-mark-inner styles are now unused)
    html = re.sub(
        r'\.brand-mark\s*\{[^}]+\}',
        '.brand-mark { display: none; }',
        html
    )
    html = re.sub(
        r'\.brand-mark-inner\s*\{[^}]+\}',
        '',
        html
    )

    # 4. Reset brand-name CSS since we're using SVG now
    # Remove font-size overrides that would affect the SVG text
    html = re.sub(
        r'\.brand-name\s*\{[^}]+\}',
        '.brand-name { display: none; }',
        html
    )

    if html != original:
        shutil.copy(fname, fname + f'.backup-logo-{STAMP}')
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'  ✓ {fname}: {", ".join(changes) if changes else "brand CSS cleaned"}')
    else:
        print(f'  – {fname}: no changes needed')

print(f'\n✅ Done. Run ./deploy.sh')
