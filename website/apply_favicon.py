#!/usr/bin/env python3
"""
apply_favicon.py
Replaces favicon files and updates all HTML pages with correct link tags.

Run from the website directory after copying favicon files here:
  python3 apply_favicon.py
"""

import re, shutil, glob
from datetime import datetime

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
SKIP = {'draft.html', 'mobile-diag.html'}

# New favicon link block
NEW_FAVICON_LINKS = '''  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-192.png">'''

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

    # Remove all existing favicon link tags (icon, apple-touch-icon)
    html = re.sub(r'\s*<link[^>]+rel="(icon|apple-touch-icon|shortcut icon)"[^>]*>\n?', '\n', html)
    # Also remove inline SVG favicon data URIs
    html = re.sub(r'\s*<link[^>]+href="data:image/svg[^"]*"[^>]*>\n?', '\n', html)

    # Inject new favicon links after <meta charset> or first <meta> tag
    html = re.sub(
        r'(<meta[^>]+charset[^>]*>)',
        r'\1\n' + NEW_FAVICON_LINKS,
        html, count=1
    )

    if html != original:
        shutil.copy(fname, fname + f'.backup-favicon-{STAMP}')
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'  ✓ {fname}')
    else:
        print(f'  – {fname}: no changes')

print(f'\n✅ Done. Run ./deploy.sh')
