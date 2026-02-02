#!/usr/bin/env python3
"""
Add accessibility and performance improvements to Sentinel Authority website
- ARIA labels
- Skip links
- Focus indicators
- Lazy loading
- Preload hints
"""

def add_accessibility_perf(html):
    """Add accessibility attributes and performance optimizations"""
    
    # 1. Add skip link at top of body (after <body>)
    skip_link = '''
    <!-- Skip to main content link for accessibility -->
    <a href="#main" class="skip-link">Skip to content</a>
    '''
    html = html.replace('<body>', '<body>' + skip_link, 1)
    
    # 2. Add skip link CSS
    skip_css = '''
    /* Accessibility - Skip Link */
    .skip-link {
      position: absolute;
      top: -50px;
      left: 16px;
      background: var(--purple-primary);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: var(--mono);
      font-size: 12px;
      z-index: 9999;
      transition: top 0.2s ease;
    }
    .skip-link:focus {
      top: 16px;
      outline: 2px solid var(--purple-bright);
      outline-offset: 2px;
    }
    
    /* Focus indicators */
    a:focus, button:focus, input:focus, select:focus, textarea:focus {
      outline: 2px solid var(--purple-bright);
      outline-offset: 2px;
    }
    
    /* Focus visible only for keyboard navigation */
    :focus:not(:focus-visible) {
      outline: none;
    }
    :focus-visible {
      outline: 2px solid var(--purple-bright);
      outline-offset: 2px;
    }
    '''
    
    # Insert CSS before mobile responsive section or before </style>
    mobile_marker = '/* ============================================\n       MOBILE RESPONSIVE'
    if mobile_marker in html:
        html = html.replace(mobile_marker, skip_css + '\n    ' + mobile_marker)
    else:
        html = html.replace('</style>', skip_css + '\n    </style>', 1)
    
    # 3. Add ARIA labels to buttons/links that need them
    # Hamburger menu button
    html = html.replace(
        '<button class="nav-hamburger"',
        '<button class="nav-hamburger" aria-label="Open navigation menu" aria-expanded="false"'
    )
    
    # Close button in modal
    html = html.replace(
        '<button onclick="closeDownloadModal()"',
        '<button onclick="closeDownloadModal()" aria-label="Close modal"'
    )
    
    # Verify button
    html = html.replace(
        '<button id="verify-btn"',
        '<button id="verify-btn" aria-label="Verify certificate"'
    )
    
    # Search button
    html = html.replace(
        '<button id="search-btn"',
        '<button id="search-btn" aria-label="Search registry"'
    )
    
    # 4. Add role="main" to main content area
    if 'id="main"' in html and 'role="main"' not in html:
        html = html.replace('id="main"', 'id="main" role="main"')
    
    # 5. Add aria-label to nav
    html = html.replace(
        '<nav class="nav-links"',
        '<nav class="nav-links" aria-label="Main navigation"'
    )
    
    # 6. Add lang attribute if missing
    if '<html>' in html:
        html = html.replace('<html>', '<html lang="en">')
    
    # 7. Add preload hints for fonts in head
    preload_hints = '''
    <!-- Performance: Preload critical fonts -->
    <link rel="preload" href="https://fonts.gstatic.com/s/sourceserif4/v7/vEF42_tTDB4M7-auWDN0ahZJW1ge-w.woff2" as="font" type="font/woff2" crossorigin>
    '''
    
    # Insert after existing preconnect
    if 'preconnect' in html and preload_hints not in html:
        preconnect_end = html.find('crossorigin />')
        if preconnect_end > 0:
            insert_pos = html.find('\n', preconnect_end)
            html = html[:insert_pos] + preload_hints + html[insert_pos:]
    
    # 8. Add loading="lazy" to images (if any exist without it)
    import re
    html = re.sub(r'<img(?![^>]*loading=)', '<img loading="lazy"', html)
    
    # 9. Add meta description if missing
    if '<meta name="description"' not in html:
        desc_tag = '  <meta name="description" content="Sentinel Authority - Independent conformance determination for autonomous systems. ODDC attestation with ENVELO enforcement.">\n'
        html = html.replace('<title>', desc_tag + '  <title>')
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 add_a11y_perf.py <input.html>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    html = add_accessibility_perf(html)
    
    with open(input_file, 'w') as f:
        f.write(html)
    
    print(f"✓ Added accessibility & performance improvements to {input_file}")
