import re

with open('index.html', 'r') as f:
    content = f.read()

# Replace nav backdrop-filter with solid background (much faster)
# Find the nav styling and replace blur with solid bg
content = re.sub(
    r'(\.nav\s*\{[^}]*?)backdrop-filter:\s*blur\([^)]+\);',
    r'\1/* backdrop-filter removed for performance */',
    content
)
content = re.sub(
    r'(\.nav\s*\{[^}]*?)-webkit-backdrop-filter:\s*blur\([^)]+\);',
    r'\1',
    content
)

# Make nav background more opaque to compensate for no blur
content = re.sub(
    r'(\.nav\s*\{[^}]*background:\s*)rgba\(26,\s*29,\s*39,\s*0\.\d+\)',
    r'\1rgba(26, 29, 39, 0.97)',
    content
)

# Also fix header if it has blur
content = re.sub(
    r'(header[^{]*\{[^}]*?)backdrop-filter:\s*blur\([^)]+\);',
    r'\1/* backdrop-filter removed for performance */',
    content
)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Removed backdrop-filter blur from nav")
print("✓ Increased nav opacity to compensate")
