import re

with open('index.html', 'r') as f:
    content = f.read()

# Remove ALL backdrop-filter and -webkit-backdrop-filter
content = re.sub(r'\s*backdrop-filter:\s*blur\([^)]+\);', '', content)
content = re.sub(r'\s*-webkit-backdrop-filter:\s*blur\([^)]+\);', '', content)

# Count removals
print("✓ Removed all backdrop-filter blur effects")

with open('index.html', 'w') as f:
    f.write(content)
