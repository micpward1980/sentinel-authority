import os

BASE = os.path.expanduser('~/Downloads/sentinel-authority')

# ═══════════════════════════════════════════════════
# 1. index.css — nuclear scrollbar fix
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/index.css')
with open(path) as f:
    css = f.read()

# Remove previous failed attempts
css = css.replace('\n/* Force scrollbar always present — prevents macOS overlay scrollbar shift */\n.sa-main-content {\n  min-height: calc(100vh - 72px + 1px);\n}\n', '')

# Add the nuclear fix — 100vw causes jumps on scrollbar toggle, use 100% instead
# Also force body to always scroll
nuclear = """
/* ─── Anti-jank: prevent scrollbar layout shift ─────────────────────────── */
html, body {
  overflow-y: scroll !important;
  width: 100% !important;
  overscroll-behavior: none;
}
/* Kill any 100vw usage — it includes scrollbar width on some browsers */
"""
if 'Anti-jank' not in css:
    css += nuclear

with open(path, 'w') as f:
    f.write(css)
print('1. CSS nuclear scrollbar fix')

# ═══════════════════════════════════════════════════
# 2. Layout.jsx — scroll to top on route change
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/components/Layout.jsx')
with open(path) as f:
    code = f.read()

# Add scroll-to-top on route change
if 'scrollTo(0, 0)' not in code:
    # Find the useEffect imports area and add scroll reset
    code = code.replace(
        'const location = useLocation();',
        'const location = useLocation();\n\n  // Scroll to top on route change — prevents mid-page landing\n  React.useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);'
    )
    print('2. Added scroll-to-top on route change')
else:
    print('2. Scroll-to-top already present')

with open(path, 'w') as f:
    f.write(code)

# ═══════════════════════════════════════════════════
# 3. Remove page-enter animation — it adds perceived jank
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/index.css')
with open(path) as f:
    css = f.read()

# Disable the fadeIn on page-enter — instant render is smoother
css = css.replace(
    """.page-enter {
  animation: fadeIn 0.18s var(--ease) both;
}""",
    """.page-enter {
  /* animation disabled — instant render feels smoother than delayed fade */
}"""
)

# Also disable staggered table rows — they add delay perception
css = css.replace(
    """/* Smooth table row appearance */
.data-table tbody tr {
  animation: fadeIn 0.12s ease both;
}""",
    """/* Table rows render instantly */
.data-table tbody tr {
}"""
)

with open(path, 'w') as f:
    f.write(css)
print('3. Disabled fade animations (instant render)')

print('\nDone. Build and deploy.')
