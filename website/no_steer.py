import re

with open('index.html', 'r') as f:
    content = f.read()

# Comment out the steering logic
content = re.sub(
    r'(const steerStrength = .*?\n\s+p\.vx -= .*?\n\s+p\.vy -= .*?steerStrength;)',
    '// steering disabled for fast particles',
    content,
    flags=re.DOTALL
)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Removed boundary steering")
