#!/usr/bin/env python3
"""
Add light mode toggle to Sentinel Authority website
- CSS variables for light theme
- Toggle button in header
- localStorage persistence
"""

def add_light_mode(html):
    """Add light mode CSS and toggle functionality"""
    
    # Light mode CSS
    light_mode_css = '''
    /* ============================================
       LIGHT MODE
       ============================================ */
    
    :root {
      --bg-light-base: #f8f9fc;
      --bg-light-panel: #ffffff;
      --text-light-primary: #1a1d24;
      --text-light-secondary: #4a5568;
      --text-light-tertiary: #718096;
      --border-light: rgba(0,0,0,0.08);
      --border-light-glass: rgba(0,0,0,0.06);
    }
    
    [data-theme="light"] {
      --bg-deep: var(--bg-light-base);
      --bg-panel: var(--bg-light-panel);
      --text-primary: var(--text-light-primary);
      --text-secondary: var(--text-light-secondary);
      --text-tertiary: var(--text-light-tertiary);
      --border-glass: var(--border-light);
      --border-subtle: var(--border-light-glass);
      color-scheme: light;
    }
    
    [data-theme="light"] body {
      background: var(--bg-light-base);
      color: var(--text-light-primary);
    }
    
    [data-theme="light"] .site-header {
      background: rgba(248,249,252,0.9);
      border-bottom-color: rgba(0,0,0,0.06);
    }
    
    [data-theme="light"] .brand-name {
      color: var(--text-light-primary);
    }
    
    [data-theme="light"] .nav-links a {
      color: var(--text-light-secondary);
    }
    
    [data-theme="light"] .nav-links a:hover,
    [data-theme="light"] .nav-links a.active {
      color: var(--purple-primary);
    }
    
    [data-theme="light"] .grid-overlay {
      background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
    }
    
    [data-theme="light"] .section-title,
    [data-theme="light"] h1, [data-theme="light"] h2, [data-theme="light"] h3 {
      color: var(--text-light-primary);
    }
    
    [data-theme="light"] .section-lead,
    [data-theme="light"] p {
      color: var(--text-light-secondary);
    }
    
    /* Cards and panels */
    [data-theme="light"] [style*="background: rgba(255,255,255,0.0"],
    [data-theme="light"] [style*="background: rgba(0,0,0,0."] {
      background: var(--bg-light-panel) !important;
      border-color: var(--border-light) !important;
    }
    
    [data-theme="light"] [style*="rgba(157,140,207,0.1"],
    [data-theme="light"] [style*="rgba(157,140,207,0.12"] {
      background: rgba(91,75,138,0.06) !important;
    }
    
    [data-theme="light"] [style*="rgba(92,214,133,0.1"],
    [data-theme="light"] [style*="rgba(92,214,133,0.15"] {
      background: rgba(74,157,107,0.08) !important;
    }
    
    /* Buttons */
    [data-theme="light"] .btn.primary {
      background: linear-gradient(135deg, var(--purple-primary) 0%, #7a6aad 100%);
      color: #fff;
    }
    
    [data-theme="light"] .btn:not(.primary) {
      background: var(--bg-light-panel);
      border-color: var(--border-light);
      color: var(--text-light-primary);
    }
    
    /* Badges */
    [data-theme="light"] .badge {
      background: rgba(91,75,138,0.08);
      border-color: rgba(91,75,138,0.2);
      color: var(--purple-primary);
    }
    
    /* Code/mono elements */
    [data-theme="light"] [style*="font-family: var(--mono)"] {
      color: var(--text-light-secondary);
    }
    
    /* Terminal/verify widget */
    [data-theme="light"] [style*="background: rgba(0,0,0,0.3)"] {
      background: var(--bg-light-panel) !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    
    /* SVG icons */
    [data-theme="light"] svg[stroke="currentColor"] {
      stroke: var(--text-light-secondary);
    }
    
    /* Footer */
    [data-theme="light"] footer {
      background: rgba(0,0,0,0.02);
    }
    
    /* Theme toggle button */
    .theme-toggle {
      background: none;
      border: 1px solid var(--border-glass);
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      color: var(--text-tertiary);
    }
    
    .theme-toggle:hover {
      border-color: var(--purple-bright);
      color: var(--purple-bright);
    }
    
    .theme-toggle .icon-sun,
    .theme-toggle .icon-moon {
      width: 18px;
      height: 18px;
    }
    
    .theme-toggle .icon-sun { display: none; }
    .theme-toggle .icon-moon { display: block; }
    
    [data-theme="light"] .theme-toggle .icon-sun { display: block; }
    [data-theme="light"] .theme-toggle .icon-moon { display: none; }
    
    /* Legal pages adjustments */
    [data-theme="light"] .page-title {
      color: var(--text-light-primary);
    }
    
    [data-theme="light"] .content-section h2 {
      color: var(--purple-primary);
    }
    
    [data-theme="light"] .info-card {
      background: rgba(91,75,138,0.04);
      border-color: rgba(91,75,138,0.1);
    }
    
    [data-theme="light"] .highlight-box {
      background: rgba(74,157,107,0.06);
      border-color: rgba(74,157,107,0.2);
    }
    
    [data-theme="light"] .contact-card {
      background: rgba(91,75,138,0.04);
      border-color: rgba(91,75,138,0.15);
    }
    '''
    
    # Theme toggle button HTML
    toggle_button = '''<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle light/dark mode" title="Toggle theme">
          <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>'''
    
    # Theme toggle JavaScript
    toggle_js = '''
    // Theme Toggle
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }
    
    // Initialize theme from localStorage or system preference
    (function() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
    '''
    
    # Insert CSS before MOBILE RESPONSIVE STYLES
    insertion_marker = "/* ============================================\n       MOBILE RESPONSIVE STYLES"
    if insertion_marker in html:
        html = html.replace(insertion_marker, light_mode_css + "\n    " + insertion_marker)
    else:
        # Fallback
        html = html.replace("</style>\n  </head>", light_mode_css + "\n    </style>\n  </head>", 1)
    
    # Insert toggle button in header (before SIGN IN link or at end of nav)
    # Look for the nav area
    if 'class="nav-links"' in html:
        # Desktop nav - insert before last link or sign in
        old_signin = '<a href="https://app.sentinelauthority.org" class="btn">Sign In</a>'
        if old_signin in html:
            html = html.replace(old_signin, toggle_button + '\n        ' + old_signin)
        else:
            # Try alternate pattern
            old_signin2 = '<a href="https://app.sentinelauthority.org" class="btn primary">Sign In</a>'
            if old_signin2 in html:
                html = html.replace(old_signin2, toggle_button + '\n        ' + old_signin2)
    
    # Also add to mobile nav drawer if exists
    if 'nav-drawer' in html and 'SIGN IN' in html:
        old_mobile_signin = '<a href="https://app.sentinelauthority.org">SIGN IN</a>'
        new_mobile_signin = old_mobile_signin + '\n          <button class="theme-toggle" onclick="toggleTheme()" style="margin-top: 16px; width: 100%; justify-content: center;">\n            <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>\n            <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>\n            <span style="margin-left: 8px;">Toggle Theme</span>\n          </button>'
        html = html.replace(old_mobile_signin, new_mobile_signin)
    
    # Insert JavaScript before </body>
    html = html.replace('</body>', f'<script>{toggle_js}</script>\n</body>')
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 add_light_mode.py <input.html> [output.html]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    original = html
    html = add_light_mode(html)
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    if original != html:
        print(f"✓ Light mode added to {output_file}")
    else:
        print(f"⚠ No changes made")
