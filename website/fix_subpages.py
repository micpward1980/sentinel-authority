#!/usr/bin/env python3
"""
fix_subpages.py
Sentinel Authority — Three-fix pass:
  1. Add mobile.css to any page missing it
  2. Fix global.css nav underline bleed
  3. Fix URL-encoded purple colors in favicons / inline SVGs

Run from the website directory:
  python3 fix_subpages.py
"""

import re, shutil, glob, os
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')

SKIP = {'draft.html', 'mobile-diag.html'}

html_files = sorted([
    f for f in glob.glob("*.html")
    if not any(f.endswith(p) for p in SKIP)
    and not re.search(r'\.(backup|bak\d*|save|clean|broken|golden|good)', f)
    and not f.startswith('google')
])

print(f"Processing {len(html_files)} HTML files...\n")

# ─── Fix 1 + 3: HTML files ───────────────────────────────────────────────────
for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        html = f.read()

    original = html
    changes = []

    # Fix 3: URL-encoded purple in inline SVGs / favicons
    # %237B6BAE → %230f1021 (ink)
    # %237b6bae → %230f1021
    # %234a3d75 → %232a2560 (accent)
    # %23e0d8f0 → %23e6e8ec (border gray)
    url_swaps = [
        ('%237B6BAE', '%232a2560'),
        ('%237b6bae', '%232a2560'),
        ('%234a3d75', '%232a2560'),
        ('%234A3D75', '%232a2560'),
        ('%23e0d8f0', '%23e6e8ec'),
        ('%23E0D8F0', '%23e6e8ec'),
        ('%233d3262', '%231d1a3b'),
        ('%233D3262', '%231d1a3b'),
    ]
    for old, new in url_swaps:
        if old in html:
            html = html.replace(old, new)
            changes.append(f'URL-encoded color {old} → {new}')

    # Fix 1: Add mobile.css if missing
    # Determine injection point — after global.css if present, else before </head>
    if 'mobile.css' not in html:
        mobile_tag = '<link rel="stylesheet" href="mobile.css">'
        if 'href="global.css"' in html:
            html = html.replace(
                '<link rel="stylesheet" href="global.css">',
                '<link rel="stylesheet" href="global.css">\n  ' + mobile_tag
            )
            changes.append('Added mobile.css (after global.css)')
        elif 'href="type.css"' in html:
            html = html.replace(
                '<link rel="stylesheet" href="type.css">',
                '<link rel="stylesheet" href="type.css">\n  ' + mobile_tag
            )
            changes.append('Added mobile.css (after type.css)')
        elif '</head>' in html:
            html = html.replace('</head>', f'  {mobile_tag}\n</head>', 1)
            changes.append('Added mobile.css (before </head>)')

    if changes:
        bak = fname + f'.backup-fix-{STAMP}'
        shutil.copy(fname, bak)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        for c in changes:
            print(f'  ✓ {fname}: {c}')
    else:
        print(f'  – {fname}: no changes needed')

# ─── Fix 2: Rewrite global.css ───────────────────────────────────────────────
GLOBAL_CSS = """/*
 * ═══════════════════════════════════════════════════
 * SENTINEL AUTHORITY — Global Institutional System
 * Supreme Court × ISO Tier
 * ═══════════════════════════════════════════════════
 * Load order: type.css → global.css → mobile.css
 */

/* ── 1. Base typography + layout ── */
html, body {
  background: var(--bg);
  color: var(--ink);
}

h1, h2, h3 {
  color: var(--ink);
  letter-spacing: -0.01em;
}

p, li {
  color: var(--ink);
}

.small, .meta {
  color: var(--muted);
}

.section {
  background: var(--bg);
}

.section--soft {
  background: var(--bg-soft);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

/* ── 2. Links — NO global underline, never touch nav ── */
a {
  text-decoration: none;
}

/* ── 3. Buttons (no glow, no bounce) ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  padding: 12px 18px;
  border-radius: var(--radius);
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  text-decoration: none;
  border-bottom: none;
  transition: background var(--ease), color var(--ease), border-color var(--ease);
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}

.btn-secondary {
  background: transparent;
  color: var(--ink);
  border: 1px solid rgba(15,16,33,0.55);
}

.btn-secondary:hover {
  border-color: rgba(15,16,33,0.85);
}

/* ── 4. Cards / panels (matte, registry-like) ── */
.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
}

.rule {
  height: 1px;
  background: rgba(15,16,33,0.14);
  border: none;
}

.section-rule {
  height: 1px;
  background: var(--border);
  margin: 0;
}

/* ── 5. Font smoothing ── */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
"""

if os.path.exists('global.css'):
    shutil.copy('global.css', f'global.css.backup-fix-{STAMP}')

with open('global.css', 'w', encoding='utf-8') as f:
    f.write(GLOBAL_CSS)

print(f'\n  ✓ global.css rewritten (nav underline fix)')
print(f'\n✅ All done. Run ./deploy.sh')
