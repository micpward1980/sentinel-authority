#!/usr/bin/env python3

with open('index.html', 'r') as f:
    content = f.read()

# Replace the body background color directly
content = content.replace('background:#1a1d27', 'background:#ffffff')
content = content.replace('background: #1a1d27', 'background: #ffffff')

# Replace CSS variable definitions
content = content.replace('--bg-primary:#1a1d27', '--bg-primary:#ffffff')
content = content.replace('--bg-primary: #1a1d27', '--bg-primary: #ffffff')

# Replace text colors (white to dark)
content = content.replace('color:#dbdbdb', 'color:#1a1d27')
content = content.replace('color: #dbdbdb', 'color: #1a1d27')

# Replace rgba white text with dark
replacements = [
    ('rgba(255,255,255,0.94)', 'rgba(26,29,39,0.94)'),
    ('rgba(255,255,255,0.86)', 'rgba(26,29,39,0.86)'),
    ('rgba(255,255,255,0.7)', 'rgba(26,29,39,0.7)'),
    ('rgba(255,255,255,0.6)', 'rgba(26,29,39,0.6)'),
    ('rgba(255,255,255,0.5)', 'rgba(26,29,39,0.5)'),
    ('rgba(255,255,255,0.4)', 'rgba(26,29,39,0.4)'),
    ('rgba(255,255,255,0.35)', 'rgba(26,29,39,0.35)'),
    ('rgba(255,255,255,0.3)', 'rgba(26,29,39,0.3)'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open('index-light.html', 'w') as f:
    f.write(content)

print("✓ Created index-light.html")
print(f"  - Replaced {content.count('#ffffff')} instances of white bg")
