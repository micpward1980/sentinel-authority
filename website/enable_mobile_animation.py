#!/usr/bin/env python3
"""Remove the CSS that hides the canvas on mobile"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Remove the mobile portrait canvas hiding CSS
mobile_hide_css = '''
    /* Hide canvas on mobile portrait - prevents distortion */
    @media (max-width: 600px) and (orientation: portrait) {
      #hero-canvas {
        display: none !important;
      }
      .hero::before {
        content: '';
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translateX(-50%);
        width: 280px;
        height: 280px;
        border: 2px solid rgba(157,140,207,0.35);
        border-radius: 50%;
        pointer-events: none;
        z-index: 1;
      }
    }
'''

if mobile_hide_css in content:
    content = content.replace(mobile_hide_css, '')
    with open(filepath, 'w') as f:
        f.write(content)
    print("Enabled canvas animation on mobile")
else:
    print("CSS not found - checking for variations")
    # Try to find and remove any #hero-canvas display:none rules for mobile
    import re
    pattern = r'@media[^{]*\(max-width:\s*600px\)[^{]*\{[^}]*#hero-canvas[^}]*display:\s*none[^}]*\}[^}]*\}'
    if re.search(pattern, content):
        content = re.sub(pattern, '', content)
        with open(filepath, 'w') as f:
            f.write(content)
        print("Removed canvas hiding via regex")
    else:
        print("No mobile canvas hiding found")
