#!/usr/bin/env python3
"""Fix canvas to always draw a proper circle, not an ellipse"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Replace the problematic resize function
old_resize = '''function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
            centerX = width / 2;
            centerY = height / 2;
            boundaryRadius = Math.min(width, height) * 0.35; if (height > width * 1.5) { centerY = height * 0.4; boundaryRadius = width * 0.4; }
          }'''

new_resize = '''function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
            centerX = width / 2;
            centerY = height / 2;
            // Always use width-based radius to keep circle round on tall screens
            boundaryRadius = Math.min(width * 0.4, height * 0.35);
            // On very tall screens (mobile portrait), center the circle higher
            if (height > width * 1.3) {
              centerY = height * 0.35;
              boundaryRadius = width * 0.38;
            }
          }'''

if old_resize in content:
    content = content.replace(old_resize, new_resize)
    print("✓ Replaced resize function")
else:
    # Try the original version
    old_resize2 = '''function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
            centerX = width / 2;
            centerY = height / 2;
            boundaryRadius = Math.min(width, height) * 0.4;
          }'''
    if old_resize2 in content:
        content = content.replace(old_resize2, new_resize)
        print("✓ Replaced original resize function")
    else:
        print("✗ Could not find resize function to replace")

with open(filepath, 'w') as f:
    f.write(content)
