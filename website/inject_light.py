#!/usr/bin/env python3
"""Add light mode CSS to index-light.html"""

filepath = "index-light.html"

with open(filepath, 'r') as f:
    content = f.read()

light_css = '''
    /* LIGHT MODE OVERRIDE */
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f7f8fa;
      --surface: #ffffff;
      --surface-elevated: #f7f8fa;
      --text-primary: #1a1d27;
      --text-secondary: #4a5568;
      --text-tertiary: #718096;
      --border-subtle: rgba(0,0,0,0.08);
      --purple-primary: #5B4B8A;
      --purple-bright: #7c6bae;
      --green-primary: #2d8a4e;
    }
    body {
      background: #ffffff !important;
      color: #1a1d27 !important;
    }
    header {
      background: rgba(255,255,255,0.95) !important;
      border-bottom-color: rgba(0,0,0,0.08) !important;
    }
    .brand-name {
      color: #1a1d27 !important;
    }
    nav a, .nav-link {
      color: #4a5568 !important;
    }
    .hero-title, h1, h2, h3, h4 {
      color: #1a1d27 !important;
    }
    .section-title {
      color: #1a1d27 !important;
    }
    footer {
      background: #f7f8fa !important;
      border-top-color: rgba(0,0,0,0.08) !important;
    }
    footer, footer * {
      color: #718096 !important;
    }
'''

# Insert light CSS after opening <style> tag
content = content.replace('<style>', '<style>\n' + light_css, 1)

with open(filepath, 'w') as f:
    f.write(content)

print("✓ Created light mode version")
