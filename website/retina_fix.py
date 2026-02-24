import re

with open('index.html', 'r') as f:
    content = f.read()

# Find the resize function and add devicePixelRatio support
old_resize = """function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;"""

new_resize = """function resize() {
            const dpr = window.devicePixelRatio || 1;
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);"""

content = content.replace(old_resize, new_resize)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Added Retina/HiDPI canvas support")
