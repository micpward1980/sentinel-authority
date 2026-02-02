import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Make particles larger (radius 2-5 instead of 1.5-4)
content = content.replace("radius: Math.random() * 2.5 + 1.5", "radius: Math.random() * 3 + 2")

# 2. Add crisp stroke outline to particles - find the particle fill and add stroke
old_fill = """ctx.fill();
              ctx.shadowBlur = 0;"""

new_fill = """ctx.fill();
              ctx.shadowBlur = 0;
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.lineWidth = 0.5;
              ctx.stroke();"""

content = content.replace(old_fill, new_fill)

# 3. Make boundary circle crisper - increase opacity
content = content.replace("rgba(157,140,207,0.35)", "rgba(157,140,207,0.5)")
content = content.replace("rgba(157,140,207,0.12)", "rgba(157,140,207,0.25)")

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Made particles larger with crisp edges")
print("✓ Increased boundary circle opacity")
