#!/usr/bin/env python3
"""Remove earth background completely"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Remove earth bg div
content = content.replace('      <!-- Earth background layer -->\n      <div class="hero-earth-bg"></div>\n', '')

# Remove earth bg CSS - find and remove the whole block
import re
pattern = r'/\* Flat world map background in hero.*?\n    \}'
content = re.sub(pattern, '', content, flags=re.DOTALL)

with open(filepath, 'w') as f:
    f.write(content)

print("Removed earth background")
