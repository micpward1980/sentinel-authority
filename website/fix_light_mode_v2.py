#!/usr/bin/env python3
"""
AGGRESSIVE light mode fix - override ALL problematic colors
"""

def fix_light_mode_aggressive(html):
    """Nuclear option - override everything with high specificity"""
    
    aggressive_css = '''
    /* ============================================
       LIGHT MODE - AGGRESSIVE OVERRIDE
       ============================================ */
    
    html[data-theme="light"],
    html[data-theme="light"] body {
      background: #f0f2f5 !important;
      color: #111827 !important;
    }
    
    /* Kill the dark radial gradient */
    html[data-theme="light"] body {
      background: #f0f2f5 !important;
      background-image: none !important;
    }
    
    /* Make grid subtle */
    html[data-theme="light"] .grid-overlay {
      opacity: 0.08 !important;
    }
    
    /* ===== HEADER ===== */
    html[data-theme="light"] .site-header {
      background: rgba(255,255,255,0.95) !important;
      border-bottom-color: #e5e7eb !important;
    }
    
    html[data-theme="light"] .brand-name {
      color: #111827 !important;
    }
    
    html[data-theme="light"] .nav-links a,
    html[data-theme="light"] .nav-drawer a {
      color: #374151 !important;
    }
    
    html[data-theme="light"] .nav-links a:hover,
    html[data-theme="light"] .nav-links a.active {
      color: #5B4B8A !important;
    }
    
    /* ===== ALL TEXT - BRUTE FORCE ===== */
    html[data-theme="light"] h1,
    html[data-theme="light"] h2,
    html[data-theme="light"] h3,
    html[data-theme="light"] h4,
    html[data-theme="light"] h5,
    html[data-theme="light"] h6,
    html[data-theme="light"] .section-title,
    html[data-theme="light"] .page-title {
      color: #111827 !important;
    }
    
    html[data-theme="light"] p,
    html[data-theme="light"] li,
    html[data-theme="light"] span,
    html[data-theme="light"] div,
    html[data-theme="light"] td,
    html[data-theme="light"] th,
    html[data-theme="light"] label {
      color: #374151 !important;
    }
    
    /* Section labels stay purple */
    html[data-theme="light"] .section-label {
      color: #5B4B8A !important;
    }
    
    /* Tertiary/muted text */
    html[data-theme="light"] .section-lead,
    html[data-theme="light"] small,
    html[data-theme="light"] .text-muted {
      color: #6b7280 !important;
    }
    
    /* ===== PURPLE ACCENT TEXT ===== */
    html[data-theme="light"] [style*="color: var(--purple"],
    html[data-theme="light"] [style*="color: rgba(157,140,207"],
    html[data-theme="light"] [style*="color: rgba(157, 140, 207"] {
      color: #5B4B8A !important;
    }
    
    /* ===== GREEN ACCENT TEXT ===== */
    html[data-theme="light"] [style*="color: rgba(92,214,133"],
    html[data-theme="light"] [style*="color: rgba(92, 214, 133"] {
      color: #047857 !important;
    }
    
    /* ===== ALL CARDS & PANELS ===== */
    html[data-theme="light"] section > div > div,
    html[data-theme="light"] [style*="border-radius: 20px"],
    html[data-theme="light"] [style*="border-radius: 16px"],
    html[data-theme="light"] [style*="border-radius: 14px"],
    html[data-theme="light"] [style*="border-radius: 12px"] {
      background: #ffffff !important;
      border-color: #e5e7eb !important;
    }
    
    /* Cards with purple gradient */
    html[data-theme="light"] [style*="rgba(157,140,207"] {
      background: rgba(91,75,138,0.06) !important;
      border-color: rgba(91,75,138,0.15) !important;
    }
    
    /* Cards with green gradient (ENVELO highlight) */
    html[data-theme="light"] [style*="rgba(92,214,133"] {
      background: rgba(4,120,87,0.06) !important;
      border-color: rgba(4,120,87,0.2) !important;
    }
    
    /* ===== TERMINAL/VERIFY WIDGET ===== */
    html[data-theme="light"] [style*="background: rgba(0,0,0,0.3)"],
    html[data-theme="light"] [style*="background: rgba(0,0,0,0.25)"] {
      background: #ffffff !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
    }
    
    /* ===== BUTTONS ===== */
    html[data-theme="light"] .btn.primary,
    html[data-theme="light"] a.btn.primary {
      background: linear-gradient(135deg, #5B4B8A 0%, #7a68b3 100%) !important;
      border-color: #5B4B8A !important;
      color: #ffffff !important;
    }
    
    html[data-theme="light"] .btn:not(.primary),
    html[data-theme="light"] a.btn:not(.primary) {
      background: #ffffff !important;
      border: 1px solid #d1d5db !important;
      color: #374151 !important;
    }
    
    html[data-theme="light"] .btn:not(.primary):hover {
      border-color: #5B4B8A !important;
      color: #5B4B8A !important;
    }
    
    /* ===== BADGES ===== */
    html[data-theme="light"] .badge {
      background: rgba(91,75,138,0.08) !important;
      border-color: rgba(91,75,138,0.2) !important;
      color: #5B4B8A !important;
    }
    
    html[data-theme="light"] .badge svg {
      stroke: #5B4B8A !important;
      color: #5B4B8A !important;
    }
    
    /* ===== INPUTS ===== */
    html[data-theme="light"] input,
    html[data-theme="light"] textarea,
    html[data-theme="light"] select {
      background: #ffffff !important;
      border-color: #d1d5db !important;
      color: #111827 !important;
    }
    
    html[data-theme="light"] input::placeholder {
      color: #9ca3af !important;
    }
    
    /* ===== SVGS ===== */
    html[data-theme="light"] svg {
      color: #374151;
    }
    
    html[data-theme="light"] svg[stroke="currentColor"] {
      stroke: #374151 !important;
    }
    
    html[data-theme="light"] svg text {
      fill: #374151 !important;
    }
    
    /* Purple SVG elements */
    html[data-theme="light"] svg [fill*="rgba(157,140,207"],
    html[data-theme="light"] svg [stroke*="rgba(157,140,207"] {
      fill: #5B4B8A !important;
      stroke: #5B4B8A !important;
    }
    
    /* Green SVG elements */
    html[data-theme="light"] svg [fill*="rgba(92,214,133"],
    html[data-theme="light"] svg [stroke*="rgba(92,214,133"] {
      fill: #047857 !important;
      stroke: #047857 !important;
    }
    
    /* Gate icons in cards */
    html[data-theme="light"] [style*="margin-bottom: 4px"] svg {
      stroke: #5B4B8A !important;
    }
    
    /* ===== RED/WARNING ===== */
    html[data-theme="light"] [style*="rgba(214,92,92"] {
      color: #dc2626 !important;
      background-color: rgba(220,38,38,0.06) !important;
      border-color: rgba(220,38,38,0.2) !important;
    }
    
    /* ===== AMBER/WARNING ===== */
    html[data-theme="light"] [style*="rgba(214,160,92"],
    html[data-theme="light"] [style*="amber"] {
      color: #b45309 !important;
    }
    
    /* ===== DRAFT BANNER ===== */
    html[data-theme="light"] [style*="linear-gradient"][style*="rgba(214,160,92"] {
      background: rgba(180,83,9,0.08) !important;
      border-color: rgba(180,83,9,0.2) !important;
    }
    
    /* ===== FOOTER ===== */
    html[data-theme="light"] footer {
      background: #f9fafb !important;
      border-top-color: #e5e7eb !important;
    }
    
    html[data-theme="light"] footer * {
      color: #6b7280 !important;
    }
    
    html[data-theme="light"] footer a:hover {
      color: #5B4B8A !important;
    }
    
    /* ===== MOBILE DRAWER ===== */
    html[data-theme="light"] .nav-drawer {
      background: #ffffff !important;
      border-left-color: #e5e7eb !important;
    }
    
    /* ===== LINKS ===== */
    html[data-theme="light"] a {
      color: #5B4B8A !important;
    }
    
    html[data-theme="light"] a:hover {
      color: #7a68b3 !important;
    }
    
    /* But not buttons or nav */
    html[data-theme="light"] .btn,
    html[data-theme="light"] .nav-links a,
    html[data-theme="light"] .nav-drawer a,
    html[data-theme="light"] footer a {
      color: inherit !important;
    }
    
    /* ===== LEGAL PAGES ===== */
    html[data-theme="light"] .content-section h2::before {
      background: #5B4B8A !important;
    }
    
    html[data-theme="light"] .info-card,
    html[data-theme="light"] .highlight-box,
    html[data-theme="light"] .contact-card {
      background: #ffffff !important;
      border-color: #e5e7eb !important;
    }
    
    html[data-theme="light"] .contact-link {
      color: #5B4B8A !important;
      border-color: rgba(91,75,138,0.3) !important;
    }
    
    html[data-theme="light"] .back-link {
      color: #6b7280 !important;
    }
    
    /* ===== THEME TOGGLE ===== */
    .theme-toggle {
      background: transparent !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .theme-toggle:hover {
      border-color: var(--purple-bright) !important;
    }
    
    .theme-toggle svg {
      width: 18px;
      height: 18px;
    }
    
    .theme-toggle .icon-sun { display: none; }
    .theme-toggle .icon-moon { display: block; }
    
    html[data-theme="light"] .theme-toggle {
      border-color: #d1d5db !important;
    }
    
    html[data-theme="light"] .theme-toggle:hover {
      border-color: #5B4B8A !important;
    }
    
    html[data-theme="light"] .theme-toggle .icon-sun { display: block; }
    html[data-theme="light"] .theme-toggle .icon-moon { display: none; }
    
    html[data-theme="light"] .theme-toggle svg {
      stroke: #374151 !important;
    }
    '''
    
    # Find the LIGHT MODE section and replace it entirely
    start_marker = '/* ============================================\n       LIGHT MODE'
    
    if start_marker in html:
        start_idx = html.find(start_marker)
        
        # Find the end - look for next major section or theme-toggle CSS
        search_start = start_idx + 100
        
        # Look for theme-toggle which should come after
        toggle_start = html.find('.theme-toggle {', search_start)
        
        if toggle_start > 0:
            # Find where toggle CSS ends (next major section or enhanced animations)
            toggle_section_end = html.find('/* ===', toggle_start + 50)
            if toggle_section_end == -1:
                toggle_section_end = html.find('/* ---', toggle_start + 50)
            if toggle_section_end == -1:
                toggle_section_end = toggle_start + 2000
            
            # Replace from LIGHT MODE start to end of theme-toggle section
            html = html[:start_idx] + aggressive_css + '\n    ' + html[toggle_section_end:]
        else:
            # No toggle found, just replace light mode section
            next_section = html.find('/* ============================================', start_idx + 50)
            if next_section > 0:
                html = html[:start_idx] + aggressive_css + '\n    ' + html[next_section:]
    else:
        # Light mode not found, insert before mobile responsive
        mobile_marker = '/* ============================================\n       MOBILE RESPONSIVE'
        if mobile_marker in html:
            html = html.replace(mobile_marker, aggressive_css + '\n    ' + mobile_marker)
        else:
            # Last resort - insert before </style>
            html = html.replace('</style>', aggressive_css + '\n    </style>', 1)
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 fix_light_mode_v2.py <input.html>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    original_len = len(html)
    html = fix_light_mode_aggressive(html)
    
    with open(input_file, 'w') as f:
        f.write(html)
    
    print(f"✓ Aggressive light mode fix applied to {input_file}")
