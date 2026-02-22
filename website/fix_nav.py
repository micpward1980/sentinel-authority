#!/usr/bin/env python3
"""
fix_nav.py
Scrubs the nav bar CSS and HTML. Replaces with clean institutional version.

Run from the website directory:
  python3 fix_nav.py
"""

import re, shutil, glob
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
SKIP = {'draft.html', 'mobile-diag.html'}

# ── Clean nav CSS ─────────────────────────────────────────────────────────────
NEW_NAV_CSS = """
    /* ── Nav bar ── */
    .site-header {
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 50;
      height: var(--nav-height, 72px);
      background: #ffffff;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      padding: 0 24px;
    }
    .nav-inner {
      max-width: var(--max, 1320px);
      margin: 0 auto;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      text-decoration: none;
    }
    .brand:hover { opacity: 0.8; }
    .brand-mark { display: none; }
    .brand-name { display: none; }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 32px;
      flex: 1;
      justify-content: center;
    }
    .nav-links a {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 1.5px;
      color: rgba(15,16,33,0.6);
      text-decoration: none;
      white-space: nowrap;
      transition: color 150ms ease;
    }
    .nav-links a:hover,
    .nav-links a.active { color: var(--ink); }
    .nav-signin {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 1.5px;
      color: var(--ink);
      text-decoration: none;
      border: 1px solid rgba(15,16,33,0.25);
      padding: 7px 14px;
      border-radius: 4px;
      flex-shrink: 0;
      transition: border-color 150ms ease;
      white-space: nowrap;
    }
    .nav-signin:hover { border-color: rgba(15,16,33,0.6); }
    .nav-signin > i { display: none; }
    .nav-toggle {
      display: none;
      appearance: none;
      background: none;
      border: 1px solid rgba(15,16,33,0.2);
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      flex-direction: column;
      gap: 4px;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
    }
    .nav-toggle span {
      display: block;
      width: 16px;
      height: 1.5px;
      background: var(--ink);
      border-radius: 1px;
    }
    .nav-badge { display: none; }
"""

# ── Clean nav HTML ────────────────────────────────────────────────────────────
NEW_NAV_HTML = '''  <header class="site-header">
    <div class="nav-inner">

      <a href="/" class="brand" aria-label="Sentinel Authority home">
        <svg width="220" height="48" viewBox="0 0 460 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="62" cy="60" r="50" stroke="#0f1021" stroke-width="3.4"/>
          <circle cx="62" cy="60" r="43" stroke="#0f1021" stroke-width="1.1" stroke-opacity="0.20"/>
          <text x="62" y="74" text-anchor="middle" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="40" fill="#0f1021" letter-spacing="-1.1">SA</text>
          <text x="132" y="54" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="34" fill="#0f1021" letter-spacing="-0.15">SENTINEL</text>
          <text x="132" y="84" font-family="'League Spartan', Arial, sans-serif" font-weight="900" font-size="34" fill="#0f1021" letter-spacing="-0.25">AUTHORITY</text>
        </svg>
      </a>

      <nav class="nav-links" aria-label="Main navigation">
        <a href="/#envelo" data-section="envelo">STANDARD</a>
        <a href="/#cat72" data-section="cat72">CONFORMANCE</a>
        <a href="/#verify" data-section="verify">REGISTRY</a>
        <a href="/research.html">PUBLICATIONS</a>
      </nav>

      <a href="https://app.sentinelauthority.org" class="nav-signin">APPLICANT PORTAL</a>

      <button class="nav-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="nav-drawer">
        <span></span>
        <span></span>
        <span></span>
      </button>

    </div>
  </header>'''

# ── Old nav CSS pattern to replace ───────────────────────────────────────────
OLD_NAV_CSS_PATTERN = re.compile(
    r'/\* ={3,}.*?Nav.*?={3,} \*/.*?\.nav-toggle\s*\{[^}]+\}',
    re.DOTALL
)

# ── Old nav HTML pattern ──────────────────────────────────────────────────────
OLD_NAV_HTML_PATTERN = re.compile(
    r'<header class="site-header">.*?</header>',
    re.DOTALL
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

    # Replace nav HTML
    if OLD_NAV_HTML_PATTERN.search(html):
        html = OLD_NAV_HTML_PATTERN.sub(NEW_NAV_HTML, html)
        changes.append('nav HTML replaced')

    # Nuke old nav CSS block and inject clean one before </style>
    # Find the site-header CSS block and replace it
    html = re.sub(
        r'/\*\s*[=─]+\s*Nav.*?\.nav-badge\s*\{[^}]*\}',
        '',
        html,
        flags=re.DOTALL
    )

    # Also strip any lingering corrupted backdrop lines
    html = re.sub(r'\s*backdrop-\s*\n', '\n', html)
    html = re.sub(r'\s*-webkit-backdrop-\s*\n', '\n', html)

    # Inject clean nav CSS before first </style>
    if 'site-header' not in html and NEW_NAV_CSS.strip() not in html:
        html = html.replace('</style>', NEW_NAV_CSS + '\n    </style>', 1)
        changes.append('nav CSS injected')
    elif NEW_NAV_CSS.strip() not in html:
        html = html.replace('</style>', NEW_NAV_CSS + '\n    </style>', 1)
        changes.append('nav CSS injected')

    if html != original:
        shutil.copy(fname, fname + f'.backup-nav3-{STAMP}')
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'  ✓ {fname}: {", ".join(changes) if changes else "cleaned"}')
    else:
        print(f'  – {fname}: no changes')

print(f'\n✅ Done. Run ./deploy.sh')
