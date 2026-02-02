import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Add will-change to nav only (helps GPU composite the blur)
if "will-change: transform" not in content:
    nav_perf = '''
    /* GPU hints for fixed elements with blur */
    .nav { will-change: transform; }
'''
    # Insert before first @keyframes
    content = re.sub(r'(@keyframes)', nav_perf + r'\n    \1', content, count=1)

# 2. Throttle scroll handler with rAF (doesn't change layout)
old_scroll = "window.addEventListener('scroll', updateActiveSection, { passive: true });"
new_scroll = """let scrollTick = false;
    window.addEventListener('scroll', () => {
      if (!scrollTick) {
        requestAnimationFrame(() => { updateActiveSection(); scrollTick = false; });
        scrollTick = true;
      }
    }, { passive: true });"""

if old_scroll in content and "scrollTick" not in content:
    content = content.replace(old_scroll, new_scroll)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Added GPU hint for nav")
print("✓ Throttled scroll handler")
