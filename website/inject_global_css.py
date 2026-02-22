#!/usr/bin/env python3
"""
inject_global_css.py
Sentinel Authority — Injects global.css <link> into all HTML pages.

Run from the website directory:
  python3 inject_global_css.py
"""

import re, shutil, glob
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
LINK_TAG = '  <link rel="stylesheet" href="global.css">\n'

SKIP_PATTERNS = {'draft.html', 'mobile-diag.html'}

html_files = sorted([
    f for f in glob.glob("*.html")
    if not any(f.endswith(pat) for pat in SKIP_PATTERNS)
    and not re.search(r'\.(backup|bak\d*|save|clean|broken|golden|good)', f)
    and not f.startswith('google')
])

print(f"Found {len(html_files)} HTML files:")
for f in html_files:
    print(f"  {f}")
print()

patched = 0
skipped = 0

for fname in html_files:
    with open(fname, "r", encoding="utf-8") as f:
        html = f.read()

    # Skip if already injected
    if 'href="global.css"' in html:
        print(f"  – {fname} (already has global.css, skipped)")
        skipped += 1
        continue

    # Backup
    bak = fname + f".backup-globalcss-{STAMP}"
    shutil.copy(fname, bak)

    # Inject before closing </head> or before first <link> tag — prefer after type.css
    if 'href="type.css"' in html:
        # Insert right after the type.css link
        html = html.replace(
            '<link rel="stylesheet" href="type.css">',
            '<link rel="stylesheet" href="type.css">\n' + LINK_TAG.rstrip('\n')
        )
    elif '</head>' in html:
        html = html.replace('</head>', LINK_TAG + '</head>', 1)
    elif '<link' in html:
        # Insert before first <link> tag
        html = re.sub(r'(<link)', LINK_TAG + r'\1', html, count=1)
    else:
        print(f"  ✗ {fname} — couldn't find injection point, skipped")
        skipped += 1
        continue

    with open(fname, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  ✓ {fname}")
    patched += 1

print(f"\n✅ Done. {patched} files updated, {skipped} skipped.")
print(f"Next step: ./deploy.sh")
