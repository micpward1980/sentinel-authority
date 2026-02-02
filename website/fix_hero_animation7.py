#!/usr/bin/env python3
"""Fix: Frozen particles must not move at all"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# The problem is particles are still moving even when frozen
# Need to skip all movement for frozen particles

old_particle_loop = '''// Particles
            particles.forEach((p, i) => {
              p.x += p.vx;
              p.y += p.vy;
              
              const dx = p.x - centerX;
              const dy = p.y - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              // Soft boundary - most particles gently steer away from edge (but not rogue ones)
              if (dist > boundaryRadius * 0.6 && !p.rogue) {
                const angle = Math.atan2(dy, dx);
                const steerStrength = (dist - boundaryRadius * 0.6) / (boundaryRadius * 0.4) * 0.05;
                p.vx -= Math.cos(angle) * steerStrength;
                p.vy -= Math.sin(angle) * steerStrength;
              }
              
              // Hard boundary - hit, freeze bright red, vanish after 1 second
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
              }
              
              // Speed limit
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              if (speed > 1.5) {
                p.vx = (p.vx / speed) * 1.5;
                p.vy = (p.vy / speed) * 1.5;
              }'''

new_particle_loop = '''// Particles
            particles.forEach((p, i) => {
              // If frozen, don't move - just check if time to respawn
              if (p.frozen) {
                if (Date.now() - p.frozenTime > 1000) {
                  // Respawn from center
                  const newAngle = Math.random() * Math.PI * 2;
                  const newDist = Math.random() * boundaryRadius * 0.3;
                  p.x = centerX + Math.cos(newAngle) * newDist;
                  p.y = centerY + Math.sin(newAngle) * newDist;
                  p.vx = (Math.random() - 0.5) * 0.8;
                  p.vy = (Math.random() - 0.5) * 0.8;
                  p.frozen = false;
                  p.frozenTime = 0;
                  p.radius = Math.random() * 2 + 1;
                }
                // Skip all other processing for frozen particles
              } else {
                // Normal movement
                p.x += p.vx;
                p.y += p.vy;
                
                const dx = p.x - centerX;
                const dy = p.y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Soft boundary - most particles gently steer away (but not rogue ones)
                if (dist > boundaryRadius * 0.6 && !p.rogue) {
                  const angle = Math.atan2(dy, dx);
                  const steerStrength = (dist - boundaryRadius * 0.6) / (boundaryRadius * 0.4) * 0.05;
                  p.vx -= Math.cos(angle) * steerStrength;
                  p.vy -= Math.sin(angle) * steerStrength;
                }
                
                // Hard boundary - freeze at edge
                if (dist > boundaryRadius - 10) {
                  const angle = Math.atan2(dy, dx);
                  p.x = centerX + Math.cos(angle) * (boundaryRadius - 10);
                  p.y = centerY + Math.sin(angle) * (boundaryRadius - 10);
                  p.vx = 0;
                  p.vy = 0;
                  p.frozen = true;
                  p.frozenTime = Date.now();
                  p.rogue = false;
                }
                
                // Speed limit
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > 1.5) {
                  p.vx = (p.vx / speed) * 1.5;
                  p.vy = (p.vy / speed) * 1.5;
                }
              }'''

if old_particle_loop in content:
    content = content.replace(old_particle_loop, new_particle_loop)
    print("Fixed particle loop - frozen particles now truly frozen")
else:
    print("Could not find particle loop")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
