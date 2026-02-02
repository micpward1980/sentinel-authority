#!/usr/bin/env python3
"""Fix mobile hero issues - logo distortion, overlapping text"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Fix 1: Hide scroll indicator on mobile and fix disclaimer positioning
MOBILE_HERO_FIX = '''
    /* ===== MOBILE HERO FIXES ===== */
    @media (max-width: 768px) {
      /* Hide scroll indicator completely on mobile */
      .scroll-line,
      [style*="SCROLL"] {
        display: none !important;
      }
      
      /* Fix hero disclaimer - not absolute positioned on mobile */
      .hero > [style*="position: absolute"][style*="bottom: 10px"] {
        position: relative !important;
        bottom: auto !important;
        left: auto !important;
        transform: none !important;
        margin-top: 40px;
      }
      
      /* Fix hero canvas aspect ratio */
      #hero-canvas {
        max-height: 100vh;
      }
      
      /* More padding at bottom of hero content */
      .hero > [style*="z-index: 10"][style*="text-align: center"] {
        padding-bottom: 60px !important;
      }
    }
    /* ===== END MOBILE HERO FIXES ===== */
'''

# Insert the fix
if '/* ===== MOBILE HERO FIXES =====' not in content:
    content = content.replace('/* ===== COMPREHENSIVE MOBILE FIXES =====' , MOBILE_HERO_FIX + '\n    /* ===== COMPREHENSIVE MOBILE FIXES =====')
    
# Fix 2: Update the hero section - hide scroll indicator div on mobile
old_scroll = '''      <!-- Scroll Indicator -->
      <div style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div class="scroll-line" style="width: 1px; height: 30px; background: linear-gradient(to bottom, rgba(157,140,207,0.5), transparent);"></div>
        <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 2px; color: rgba(255,255,255,0.35);">SCROLL</span>
      </div>'''

new_scroll = '''      <!-- Scroll Indicator - hidden on mobile -->
      <div class="scroll-indicator-desktop" style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div class="scroll-line" style="width: 1px; height: 30px; background: linear-gradient(to bottom, rgba(157,140,207,0.5), transparent);"></div>
        <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 2px; color: rgba(255,255,255,0.35);">SCROLL</span>
      </div>'''

content = content.replace(old_scroll, new_scroll)

# Fix 3: Update disclaimer to not be absolute on mobile  
old_disclaimer = '''      <!-- Disclaimer at bottom -->
      <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 10; text-align: center; padding: 0 20px;">
        <p style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px; margin: 0; max-width: 600px;">
          Independent conformance determination. Not a regulator. ODDC does not attest safety or compliance.
        </p>
      </div>'''

new_disclaimer = '''      <!-- Disclaimer at bottom -->
      <div class="hero-disclaimer" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 10; text-align: center; padding: 0 20px;">
        <p style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px; margin: 0; max-width: 600px;">
          Independent conformance determination. Not a regulator. ODDC does not attest safety or compliance.
        </p>
      </div>'''

content = content.replace(old_disclaimer, new_disclaimer)

# Fix 4: Add CSS to hide scroll and fix disclaimer on mobile
ADDITIONAL_CSS = '''
    /* Mobile hero element fixes */
    @media (max-width: 768px) {
      .scroll-indicator-desktop {
        display: none !important;
      }
      .hero-disclaimer {
        position: relative !important;
        bottom: auto !important;
        left: auto !important;
        transform: none !important;
        margin-top: 32px !important;
        padding: 0 16px !important;
      }
      .hero {
        padding-bottom: 40px !important;
      }
    }
'''

if '.scroll-indicator-desktop' not in content:
    content = content.replace('/* ===== MOBILE HERO FIXES =====' , ADDITIONAL_CSS + '\n    /* ===== MOBILE HERO FIXES =====')

with open(filepath, 'w') as f:
    f.write(content)

print("✓ Fixed mobile hero issues")
