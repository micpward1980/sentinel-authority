import re

with open('index.html', 'r') as f:
    content = f.read()

# Remove the tail/trail drawing
old_tail = """ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
              ctx.strokeStyle = 'rgba(92,214,133,0.25)';
              ctx.lineWidth = p.radius * 0.8;
              ctx.stroke();"""

content = content.replace(old_tail, "// tail removed")

with open('index.html', 'w') as f:
    f.write(content)

print("done")
