#!/usr/bin/env python3
"""Change hero animation - particles pop and disappear at boundary instead of bouncing"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Find and replace the particle boundary logic
old_logic = '''if (dist > boundaryRadius - 15) {
                const angle = Math.atan2(dy, dx);
                const normalX = Math.cos(angle);
                const normalY = Math.sin(angle);
                const dot = p.vx * normalX + p.vy * normalY;
                p.vx -= 2 * dot * normalX;
                p.vy -= 2 * dot * normalY;
                p.x = centerX + normalX * (boundaryRadius - 20);
                p.y = centerY + normalY * (boundaryRadius - 20);
                blockedParticles.push({ x: centerX + normalX * boundaryRadius, y: centerY + normalY * boundaryRadius, life: 1 });
              }'''

new_logic = '''if (dist > boundaryRadius - 15) {
                // Pop effect at boundary
                const angle = Math.atan2(dy, dx);
                blockedParticles.push({ 
                  x: p.x, 
                  y: p.y, 
                  life: 1,
                  size: p.radius * 3
                });
                
                // Respawn particle from center area
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 2;
                p.vy = (Math.random() - 0.5) * 2;
              }'''

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    print("Replaced particle boundary logic")
else:
    print("Could not find boundary logic")

# Update the blocked particle rendering to show a pop effect
old_render = '''blockedParticles = blockedParticles.filter(bp => {
              bp.life -= 0.04;
              if (bp.life <= 0) return false;
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, 12 * (1 - bp.life) + 4, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(214,92,92,' + (bp.life * 0.9) + ')';
              ctx.fill();
              return true;
            });'''

new_render = '''blockedParticles = blockedParticles.filter(bp => {
              bp.life -= 0.06;
              if (bp.life <= 0) return false;
              const popSize = (bp.size || 8) * (1 + (1 - bp.life) * 2);
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, popSize, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(214,92,92,' + (bp.life * 0.7) + ')';
              ctx.fill();
              // Add ring effect
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, popSize * 1.5, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(214,92,92,' + (bp.life * 0.3) + ')';
              ctx.lineWidth = 1;
              ctx.stroke();
              return true;
            });'''

if old_render in content:
    content = content.replace(old_render, new_render)
    print("Updated pop effect rendering")
else:
    print("Could not find render logic")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
