#!/usr/bin/env python3
"""Adjust particle behavior - most stay inside, few hit boundary and pop"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Replace the entire particle update section
old_logic = '''// Particles
            particles.forEach((p, i) => {
              p.x += p.vx;
              p.y += p.vy;
              
              const dx = p.x - centerX;
              const dy = p.y - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist > boundaryRadius - 15) {
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

new_logic = '''// Particles
            particles.forEach((p, i) => {
              p.x += p.vx;
              p.y += p.vy;
              
              const dx = p.x - centerX;
              const dy = p.y - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              // Soft boundary - most particles gently steer away from edge
              if (dist > boundaryRadius * 0.6) {
                const angle = Math.atan2(dy, dx);
                const steerStrength = (dist - boundaryRadius * 0.6) / (boundaryRadius * 0.4) * 0.03;
                p.vx -= Math.cos(angle) * steerStrength;
                p.vy -= Math.sin(angle) * steerStrength;
              }
              
              // Hard boundary - rare particles that break through pop
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
                p.vx = (Math.random() - 0.5) * 1.2;
                p.vy = (Math.random() - 0.5) * 1.2;
              }
              
              // Speed limit
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              if (speed > 1.5) {
                p.vx = (p.vx / speed) * 1.5;
                p.vy = (p.vy / speed) * 1.5;
              }'''

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    print("Updated particle behavior")
else:
    print("Could not find particle logic - trying alternate")
    # Maybe the old bounce logic is still there
    alt_old = '''// Particles
            particles.forEach((p, i) => {
              p.x += p.vx;
              p.y += p.vy;
              
              const dx = p.x - centerX;
              const dy = p.y - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist > boundaryRadius - 15) {
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
    
    if alt_old in content:
        content = content.replace(alt_old, new_logic)
        print("Updated particle behavior (alt)")
    else:
        print("Could not find any particle logic to replace")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
