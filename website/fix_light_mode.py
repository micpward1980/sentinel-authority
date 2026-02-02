#!/usr/bin/env python3
"""
Fix light mode contrast issues
"""

def fix_light_mode(html):
    """Replace light mode CSS with higher contrast version"""
    
    # Find and replace the light mode CSS block
    old_light_css_start = '''/* ============================================
       LIGHT MODE
       ============================================ */'''
    
    # New high-contrast light mode
    new_light_mode_css = '''/* ============================================
       LIGHT MODE - HIGH CONTRAST
       ============================================ */
    
    :root {
      --bg-light-base: #f5f6fa;
      --bg-light-panel: #ffffff;
      --text-light-primary: #0f1419;
      --text-light-secondary: #2d3748;
      --text-light-tertiary: #4a5568;
      --border-light: rgba(0,0,0,0.12);
      --border-light-glass: rgba(0,0,0,0.08);
      --purple-light-mode: #5B4B8A;
      --green-light-mode: #2f855a;
    }
    
    [data-theme="light"] {
      color-scheme: light;
    }
    
    [data-theme="light"] body {
      background: linear-gradient(135deg, #f5f6fa 0%, #eef0f5 100%);
      color: #0f1419;
    }
    
    [data-theme="light"] .grid-overlay {
      opacity: 0.15;
      background-image: linear-gradient(rgba(91,75,138,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(91,75,138,0.1) 1px, transparent 1px);
    }
    
    /* Header */
    [data-theme="light"] .site-header {
      background: rgba(255,255,255,0.95);
      border-bottom: 1px solid rgba(0,0,0,0.08);
      backdrop-filter: blur(20px);
    }
    
    [data-theme="light"] .brand-name {
      color: #0f1419;
    }
    
    [data-theme="light"] .nav-links a {
      color: #4a5568;
    }
    
    [data-theme="light"] .nav-links a:hover,
    [data-theme="light"] .nav-links a.active {
      color: #5B4B8A;
    }
    
    /* Typography */
    [data-theme="light"] .section-title,
    [data-theme="light"] h1, 
    [data-theme="light"] h2, 
    [data-theme="light"] h3,
    [data-theme="light"] h4 {
      color: #0f1419 !important;
    }
    
    [data-theme="light"] .section-lead,
    [data-theme="light"] p {
      color: #2d3748 !important;
    }
    
    [data-theme="light"] .section-label {
      color: #5B4B8A !important;
    }
    
    /* All inline text colors */
    [data-theme="light"] [style*="color: var(--text-primary)"],
    [data-theme="light"] [style*="color: var(--text-secondary)"] {
      color: #2d3748 !important;
    }
    
    [data-theme="light"] [style*="color: var(--text-tertiary)"] {
      color: #4a5568 !important;
    }
    
    [data-theme="light"] [style*="color: rgba(255,255,255"] {
      color: #2d3748 !important;
    }
    
    /* Mono/code text */
    [data-theme="light"] [style*="font-family: var(--mono)"] {
      color: #4a5568 !important;
    }
    
    /* Purple text elements */
    [data-theme="light"] [style*="color: rgba(157,140,207"] {
      color: #5B4B8A !important;
    }
    
    [data-theme="light"] [style*="color: var(--purple-bright)"] {
      color: #5B4B8A !important;
    }
    
    /* Green text elements */
    [data-theme="light"] [style*="color: rgba(92,214,133"] {
      color: #2f855a !important;
    }
    
    /* Cards and panels - purple themed */
    [data-theme="light"] [style*="background: rgba(157,140,207"],
    [data-theme="light"] [style*="background: linear-gradient(135deg, rgba(157,140,207"],
    [data-theme="light"] [style*="background: linear-gradient(180deg, rgba(157,140,207"] {
      background: linear-gradient(135deg, rgba(91,75,138,0.08) 0%, rgba(91,75,138,0.03) 100%) !important;
      border-color: rgba(91,75,138,0.2) !important;
    }
    
    /* Cards and panels - green themed */
    [data-theme="light"] [style*="background: rgba(92,214,133"],
    [data-theme="light"] [style*="background: linear-gradient(135deg, rgba(92,214,133"],
    [data-theme="light"] [style*="background: linear-gradient(180deg, rgba(92,214,133"] {
      background: linear-gradient(135deg, rgba(47,133,90,0.1) 0%, rgba(47,133,90,0.04) 100%) !important;
      border-color: rgba(47,133,90,0.25) !important;
    }
    
    /* Cards - dark bg to white */
    [data-theme="light"] [style*="background: rgba(0,0,0,"],
    [data-theme="light"] [style*="background: rgba(255,255,255,0.0"],
    [data-theme="light"] [style*="background: rgba(255,255,255,0.03)"],
    [data-theme="light"] [style*="background: rgba(255,255,255,0.04)"],
    [data-theme="light"] [style*="background: rgba(255,255,255,0.05)"] {
      background: #ffffff !important;
      border-color: rgba(0,0,0,0.1) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    
    /* Terminal/verify widget */
    [data-theme="light"] [style*="background: rgba(0,0,0,0.3)"] {
      background: #ffffff !important;
      border-color: rgba(91,75,138,0.2) !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1) !important;
    }
    
    [data-theme="light"] [style*="background: rgba(91,75,138,0.15)"] {
      background: rgba(91,75,138,0.1) !important;
    }
    
    /* Buttons */
    [data-theme="light"] .btn.primary {
      background: linear-gradient(135deg, #5B4B8A 0%, #7a6aad 100%) !important;
      color: #fff !important;
      border-color: #5B4B8A !important;
    }
    
    [data-theme="light"] .btn:not(.primary) {
      background: #ffffff !important;
      border: 1px solid rgba(0,0,0,0.15) !important;
      color: #2d3748 !important;
    }
    
    [data-theme="light"] .btn:not(.primary):hover {
      border-color: #5B4B8A !important;
      color: #5B4B8A !important;
    }
    
    /* Badges */
    [data-theme="light"] .badge,
    [data-theme="light"] [style*="border-radius: 30px"][style*="background: rgba"] {
      background: rgba(91,75,138,0.1) !important;
      border-color: rgba(91,75,138,0.25) !important;
      color: #5B4B8A !important;
    }
    
    [data-theme="light"] .badge svg {
      color: #5B4B8A !important;
    }
    
    /* Input fields */
    [data-theme="light"] input[type="text"],
    [data-theme="light"] input[type="email"],
    [data-theme="light"] select {
      background: #ffffff !important;
      border-color: rgba(0,0,0,0.15) !important;
      color: #0f1419 !important;
    }
    
    [data-theme="light"] input::placeholder {
      color: #a0aec0 !important;
    }
    
    /* SVG icons */
    [data-theme="light"] svg {
      --text-primary: #2d3748;
      --text-secondary: #4a5568;
      --text-tertiary: #718096;
    }
    
    [data-theme="light"] svg[stroke="currentColor"] {
      stroke: #4a5568;
    }
    
    [data-theme="light"] svg[stroke="rgba(255,255,255"] {
      stroke: #4a5568 !important;
    }
    
    /* Gate icons */
    [data-theme="light"] [style*="color: rgba(157,140,207,0.7)"] svg {
      stroke: #5B4B8A !important;
    }
    
    [data-theme="light"] [style*="color: rgba(92,214,133,0.8)"] svg {
      stroke: #2f855a !important;
    }
    
    /* Footer */
    [data-theme="light"] footer {
      background: rgba(91,75,138,0.03);
      border-top-color: rgba(0,0,0,0.08) !important;
    }
    
    [data-theme="light"] .footer-copy,
    [data-theme="light"] .footer-links a {
      color: #4a5568 !important;
    }
    
    /* Red/warning elements */
    [data-theme="light"] [style*="rgba(214,92,92"] {
      color: #c53030 !important;
    }
    
    [data-theme="light"] [style*="background: rgba(214,92,92"] {
      background: rgba(197,48,48,0.08) !important;
      border-color: rgba(197,48,48,0.2) !important;
    }
    
    /* Draft banner */
    [data-theme="light"] [style*="background: linear-gradient"][style*="amber"] {
      background: linear-gradient(90deg, rgba(180,130,50,0.15), rgba(180,130,50,0.05)) !important;
    }
    
    /* Mobile drawer */
    [data-theme="light"] .nav-drawer {
      background: #ffffff !important;
    }
    
    [data-theme="light"] .nav-drawer a {
      color: #2d3748 !important;
    }
    
    /* Legal pages */
    [data-theme="light"] .page-title {
      color: #0f1419 !important;
    }
    
    [data-theme="light"] .content-section h2 {
      color: #5B4B8A !important;
    }
    
    [data-theme="light"] .content-section h2::before {
      background: #5B4B8A !important;
    }
    
    [data-theme="light"] .info-card {
      background: #ffffff !important;
      border-color: rgba(0,0,0,0.1) !important;
    }
    
    [data-theme="light"] .highlight-box {
      background: rgba(47,133,90,0.08) !important;
      border-color: rgba(47,133,90,0.2) !important;
    }
    
    [data-theme="light"] .contact-card {
      background: rgba(91,75,138,0.06) !important;
      border-color: rgba(91,75,138,0.15) !important;
    }
    
    [data-theme="light"] .contact-link {
      color: #5B4B8A !important;
      border-color: rgba(91,75,138,0.3) !important;
    }
    
    /* Back link */
    [data-theme="light"] .back-link {
      color: #4a5568 !important;
    }
    
    [data-theme="light"] .back-link:hover {
      color: #5B4B8A !important;
    }'''
    
    # Find the old light mode section and replace it
    import re
    
    # Pattern to match the entire light mode CSS block
    pattern = r'/\* =+\s*\n\s*LIGHT MODE[^*]*=+ \*/.*?(?=/\* =|\Z)'
    
    # Check if there's existing light mode CSS
    if 'LIGHT MODE' in html:
        # Replace from "LIGHT MODE" header to next section or end
        # Find start
        start_marker = '/* ============================================\n       LIGHT MODE'
        if start_marker in html:
            start_idx = html.find(start_marker)
            # Find next section marker or theme toggle
            next_section = html.find('/* ============================================', start_idx + 50)
            theme_toggle = html.find('.theme-toggle', start_idx)
            
            if theme_toggle > start_idx and (next_section == -1 or theme_toggle < next_section):
                end_idx = theme_toggle
            elif next_section > start_idx:
                end_idx = next_section
            else:
                end_idx = start_idx + 5000  # fallback
            
            html = html[:start_idx] + new_light_mode_css + '\n    \n    ' + html[end_idx:]
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 fix_light_mode.py <input.html> [output.html]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    original = html
    html = fix_light_mode(html)
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    if original != html:
        print(f"✓ Light mode contrast fixed in {output_file}")
    else:
        print(f"⚠ No changes made")
