#!/usr/bin/env python3
"""Add faint Earth image to hero background"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Add CSS for Earth background
earth_css = '''
    /* Earth background in hero */
    .hero {
      background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/The_Blue_Marble_%28remastered%29.jpg/1200px-The_Blue_Marble_%28remastered%29.jpg');
      background-size: 600px 600px;
      background-position: center 40%;
      background-repeat: no-repeat;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(ellipse at center, rgba(26,29,39,0.85) 0%, rgba(26,29,39,0.95) 40%, var(--bg-deep) 70%);
      z-index: 0;
      pointer-events: none;
    }
'''

# Insert after the hero eye animation CSS
if 'Earth background in hero' not in content:
    content = content.replace('.hero-eye {', earth_css + '\n    .hero-eye {')
    print("Added Earth background")
else:
    print("Earth background already exists")

with open(filepath, 'w') as f:
    f.write(content)
