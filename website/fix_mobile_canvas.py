#!/usr/bin/env python3
"""Hide canvas on mobile portrait, use gradient background instead"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

MOBILE_CANVAS_CSS = '''
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

if '@media (max-width: 600px) and (orientation: portrait)' not in content:
    content = content.replace('/* ===== END MOBILE FIXES =====', MOBILE_CANVAS_CSS + '\n    /* ===== END MOBILE FIXES =====')
    with open(filepath, 'w') as f:
        f.write(content)
    print("Done")
else:
    print("Already present")
