import re

# Read the current status.html
with open('status.html', 'r') as f:
    content = f.read()

# Read index.html to get the exact CSS
with open('index.html', 'r') as f:
    index_content = f.read()

# Extract :root and common styles from index (up through brand-name)
index_style = re.search(r'<style>(.*?)</style>', index_content, re.DOTALL).group(1)

# Get everything from :root through brand-name including animation
common_match = re.search(r'(:root\{.*?\.brand-name\{[^}]+\})', index_style, re.DOTALL)
common_css = common_match.group(1)

# Extract page-specific CSS from status.html (everything after the header/brand styles)
# Find where the page-specific styles start (after brand stuff)
status_style = re.search(r'<style>(.*?)</style>', content, re.DOTALL).group(1)

# Get everything after the nav/brand section - look for .main or similar
page_specific_match = re.search(r'(/\* Main.*|\.main\s*\{.*)', status_style, re.DOTALL)
if page_specific_match:
    page_specific = page_specific_match.group(0)
else:
    # Try to find where page content styles start
    page_specific_match = re.search(r'(\s+main\s*\{.*)', status_style, re.DOTALL)
    if page_specific_match:
        page_specific = page_specific_match.group(0)
    else:
        # Just get everything after brand-mark-inner
        page_specific_match = re.search(r'\.brand-mark-inner\s*\{[^}]+\}(.*)', status_style, re.DOTALL)
        page_specific = page_specific_match.group(1) if page_specific_match else ''

# Build new style
new_style = common_css + '\n' + page_specific

# Replace in content
new_content = re.sub(r'<style>.*?</style>', '<style>\n' + new_style + '\n  </style>', content, flags=re.DOTALL)

with open('status.html', 'w') as f:
    f.write(new_content)

print("✓ Fixed status.html")
