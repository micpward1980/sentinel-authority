import os

BASE = os.path.expanduser('~/Downloads/sentinel-authority')

# ═══════════════════════════════════════════════════
# 1. Layout.jsx — contained scroll architecture
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/components/Layout.jsx')
with open(path) as f:
    code = f.read()

# Make the outer wrapper fill the viewport exactly, no body scroll
code = code.replace(
    "<div style={{minHeight: '100vh', color: styles.textPrimary, fontFamily: styles.sans, background: styles.bgDeep}}>",
    "<div style={{height: '100vh', overflow: 'hidden', color: styles.textPrimary, fontFamily: styles.sans, background: styles.bgDeep}}>"
)

# Make the main content column a scroll container
code = code.replace(
    "<div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10, minHeight: '100vh'}}>",
    "<div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10, height: '100vh', display: 'flex', flexDirection: 'column'}}>"
)

# If the above didn't match (no minHeight variant), try without
if "height: '100vh', display: 'flex'" not in code:
    code = code.replace(
        "<div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10}}>",
        "<div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10, height: '100vh', display: 'flex', flexDirection: 'column'}}>"
    )

# Make the <main> area the scroll container
code = code.replace(
    '<main className="sa-main-content" style={{padding: \'clamp(16px, 3vw, 32px)\', position: \'relative\', zIndex: 1}}>',
    '<main className="sa-main-content" style={{padding: \'clamp(16px, 3vw, 32px)\', position: \'relative\', zIndex: 1, flex: 1, overflowY: \'auto\', overflowX: \'hidden\'}}>'
)

with open(path, 'w') as f:
    f.write(code)
print('1. Layout: contained scroll architecture')

# ═══════════════════════════════════════════════════
# 2. CSS — kill body scroll, style the main scroller
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/index.css')
with open(path) as f:
    css = f.read()

# Remove previous failed fixes
css = css.replace("""
/* ─── Anti-jank: prevent scrollbar layout shift ─────────────────────────── */
html, body {
  overflow-y: scroll !important;
  width: 100% !important;
  overscroll-behavior: none;
}
/* Kill any 100vw usage — it includes scrollbar width on some browsers */
""", '')

css = css.replace("""
/* Force scrollbar always present — prevents macOS overlay scrollbar shift */
.sa-main-content {
  min-height: calc(100vh - 72px + 1px);
}
""", '')

# Add the contained scroll approach
css += """
/* ─── Contained scroll — Salesforce pattern ─────────────────────────────── */
html, body, #root {
  height: 100%;
  overflow: hidden;
  margin: 0;
}

/* Main content scrollbar styling */
.sa-main-content::-webkit-scrollbar { width: 6px; }
.sa-main-content::-webkit-scrollbar-track { background: transparent; }
.sa-main-content::-webkit-scrollbar-thumb { background: var(--hairline-2); border-radius: 3px; }
.sa-main-content::-webkit-scrollbar-thumb:hover { background: rgba(29,26,59,0.30); }
"""

with open(path, 'w') as f:
    f.write(css)
print('2. CSS: body locked, main content scrolls')

# ═══════════════════════════════════════════════════
# 3. Remove scroll-to-top (no longer needed — main
#    content container resets automatically)
# ═══════════════════════════════════════════════════
path = os.path.join(BASE, 'frontend/src/components/Layout.jsx')
with open(path) as f:
    code = f.read()

# Update scrollTo to target the main container
code = code.replace(
    "// Scroll to top on route change — prevents mid-page landing\n  React.useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);",
    "// Scroll to top on route change\n  React.useEffect(() => { const el = document.querySelector('.sa-main-content'); if (el) el.scrollTo(0, 0); }, [location.pathname]);"
)

with open(path, 'w') as f:
    f.write(code)
print('3. Scroll-to-top targets main container')

print('\nDone. Build and deploy.')
