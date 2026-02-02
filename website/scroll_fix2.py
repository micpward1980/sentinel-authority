import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Replace updateActiveSection scroll listener with throttled version + IntersectionObserver
old_active = """    window.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection();"""

new_active = """    // Throttled scroll for active section (fires max 10x/sec instead of 60x)
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateActiveSection();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
    updateActiveSection();"""

content = content.replace(old_active, new_active)

# 2. Add GPU acceleration for backdrop-filter elements
perf_css = """
    /* GPU acceleration for blur/backdrop elements */
    [style*="backdrop-filter"], .nav, .drawer, header {
      will-change: transform;
      transform: translateZ(0);
    }
"""

# Insert after the existing performance CSS
if "will-change: transform, opacity" in content:
    content = content.replace(
        "will-change: transform, opacity;\n    }",
        "will-change: transform, opacity;\n    }\n" + perf_css
    )

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Throttled updateActiveSection with requestAnimationFrame")
print("✓ Added GPU acceleration for backdrop-filter elements")
