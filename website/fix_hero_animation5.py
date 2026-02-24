#!/usr/bin/env python3
"""Particles freeze at boundary, turn red for 1 second, then disappear"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Replace the hard boundary pop logic
old_boundary = '''// Hard boundary - rare particles that break through pop
              if (dist > boundaryRadius - 10) {
                // Pop effect
                blockedParticles.push({ 
                  x: p.x, 
                  y: p.y, 
                  life: 1,
                  size: p.radius * 3
                });
                
                // Respawn from center
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 0.8;
                p.vy = (Math.random() - 0.5) * 0.8;
                p.rogue = false;
                p.radius = Math.random() * 2 + 1;
              }'''

new_boundary = '''// Hard boundary - particles freeze, turn red, then disappear
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

if old_boundary in content:
    content = content.replace(old_boundary, new_boundary)
    print("Updated boundary behavior to freeze")
else:
    print("Could not find boundary logic")

# Update particle drawing to show red when frozen
old_draw = '''ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(92,214,133,0.8)';
              ctx.fill();'''

new_draw = '''ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              if (p.frozen) {
                // Fade out over the 1 second
                const fadeProgress = (Date.now() - p.frozenTime) / 1000;
                ctx.fillStyle = 'rgba(214,92,92,' + (1 - fadeProgress * 0.5) + ')';
              } else {
                ctx.fillStyle = 'rgba(92,214,133,0.8)';
              }
              ctx.fill();'''

if old_draw in content:
    content = content.replace(old_draw, new_draw)
    print("Updated particle drawing for frozen state")
else:
    print("Could not find particle draw logic")

# Remove the old pop effect rendering since we don't need it anymore
old_pop_render = '''blockedParticles = blockedParticles.filter(bp => {
              bp.life -= 0.06;
              if (bp.life <= 0) return false;
              const popSize = (bp.size || 12) * (1 + (1 - bp.life) * 4);
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, popSize, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(214,92,92,' + (bp.life * 0.7) + ')';
              ctx.fill();
              // Add ring effect
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, popSize * 2, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(214,92,92,' + (bp.life * 0.3) + ')';
              ctx.lineWidth = 1;
              ctx.stroke();
              return true;
            });'''

new_pop_render = '''// blockedParticles not used - particles freeze instead'''

if old_pop_render in content:
    content = content.replace(old_pop_render, new_pop_render)
    print("Removed old pop effect")
else:
    print("Could not find pop render logic")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
