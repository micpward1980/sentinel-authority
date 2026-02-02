#!/usr/bin/env python3
"""Particles freeze bright red at boundary for 1 second then vanish"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Replace the boundary logic
old_boundary = '''// Hard boundary - particles freeze, turn red, then disappear
              if (dist > boundaryRadius - 10 && !p.frozen) {
                // Freeze at boundary
                const angle = Math.atan2(dy, dx);
                p.x = centerX + Math.cos(angle) * (boundaryRadius - 12);
                p.y = centerY + Math.sin(angle) * (boundaryRadius - 12);
                p.vx = 0;
                p.vy = 0;
                p.frozen = true;
                p.frozenTime = Date.now();
                p.rogue = false;
              }
              
              // Check if frozen particle should respawn (after 1 second)
              if (p.frozen && Date.now() - p.frozenTime > 1000) {
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 0.8;
                p.vy = (Math.random() - 0.5) * 0.8;
                p.frozen = false;
                p.frozenTime = 0;
                p.radius = Math.random() * 2 + 1;
              }'''

new_boundary = '''// Hard boundary - hit, freeze bright red, vanish after 1 second
              if (dist > boundaryRadius - 10 && !p.frozen) {
                // Stop right at boundary
                const angle = Math.atan2(dy, dx);
                p.x = centerX + Math.cos(angle) * (boundaryRadius - 10);
                p.y = centerY + Math.sin(angle) * (boundaryRadius - 10);
                p.vx = 0;
                p.vy = 0;
                p.frozen = true;
                p.frozenTime = Date.now();
                p.rogue = false;
              }
              
              // After 1 second frozen, respawn from center
              if (p.frozen && Date.now() - p.frozenTime > 1000) {
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 0.8;
                p.vy = (Math.random() - 0.5) * 0.8;
                p.frozen = false;
                p.frozenTime = 0;
                p.radius = Math.random() * 2 + 1;
              }'''

content = content.replace(old_boundary, new_boundary)

# Update particle drawing - bright red when frozen, no fade
old_draw = '''ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              if (p.frozen) {
                // Fade out over the 1 second
                const fadeProgress = (Date.now() - p.frozenTime) / 1000;
                ctx.fillStyle = 'rgba(214,92,92,' + (1 - fadeProgress * 0.5) + ')';
              } else {
                ctx.fillStyle = 'rgba(92,214,133,0.8)';
              }
              ctx.fill();'''

new_draw = '''ctx.beginPath();
              ctx.arc(p.x, p.y, p.frozen ? p.radius * 1.5 : p.radius, 0, Math.PI * 2);
              if (p.frozen) {
                // Bright red, solid
                ctx.fillStyle = 'rgba(255,60,60,1)';
                ctx.shadowColor = 'rgba(255,60,60,0.8)';
                ctx.shadowBlur = 10;
              } else {
                ctx.fillStyle = 'rgba(92,214,133,0.8)';
                ctx.shadowBlur = 0;
              }
              ctx.fill();
              ctx.shadowBlur = 0;'''

content = content.replace(old_draw, new_draw)

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
