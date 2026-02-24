#!/usr/bin/env python3
import re

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Find and replace the hero mark section
old_mark = r'<!-- ENVELO Mark -->.*?</div>\s*</div>\s*</div>'

new_mark = '''<!-- ENVELO Mark -->
        <div style="width: 70px; height: 70px; margin: 0 auto 32px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(157,140,207,0.5);">
          <div style="width: 22px; height: 22px; background: radial-gradient(circle, #fff 0%, #c4b8e8 100%); border-radius: 50%; box-shadow: 0 0 15px rgba(255,255,255,0.5);"></div>
        </div>'''

# Use re.DOTALL to match across lines
result = re.sub(old_mark, new_mark, content, count=1, flags=re.DOTALL)

if result != content:
    with open(filepath, 'w') as f:
        f.write(result)
    print("Fixed hero icon")
else:
    print("Could not find hero mark to replace")
