#!/usr/bin/env python3
"""Make particles visibly travel to boundary then pop"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Replace the forced pop logic - instead of teleporting, give particles a boost toward edge
old_force_pop = '''// Force 2-3 pops per second
            const now = Date.now();
            if (now - lastPop > 400 + Math.random() * 300) {
              lastPop = now;
              // Pick a random particle and send it to the edge
              const victim = particles[Math.floor(Math.random() * particles.length)];
              if (victim) {
                const angle = Math.atan2(victim.y - centerY, victim.x - centerX);
                victim.x = centerX + Math.cos(angle) * (boundaryRadius - 5);
                victim.y = centerY + Math.sin(angle) * (boundaryRadius - 5);
              }
            }'''

new_force_pop = '''// Every ~500ms, launch a particle toward the boundary
            const now = Date.now();
            if (now - lastPop > 500 + Math.random() * 400) {
              lastPop = now;
              // Pick a random particle and boost it outward
              const victim = particles[Math.floor(Math.random() * particles.length)];
              if (victim) {
                const angle = Math.atan2(victim.y - centerY, victim.x - centerX) || Math.random() * Math.PI * 2;
                victim.vx = Math.cos(angle) * 4;
                victim.vy = Math.sin(angle) * 4;
                victim.rogue = true; // Mark as heading to boundary
                victim.radius = 3; // Make it bigger so visible
              }
            }'''

if old_force_pop in content:
    content = content.replace(old_force_pop, new_force_pop)
    print("Updated force pop to boost instead of teleport")
else:
    print("Could not find force pop logic")

# Update particle behavior to not steer rogue particles
old_steer = '''// Soft boundary - most particles gently steer away from edge
              if (dist > boundaryRadius * 0.6) {
                const angle = Math.atan2(dy, dx);
                const steerStrength = (dist - boundaryRadius * 0.6) / (boundaryRadius * 0.4) * 0.03;
                p.vx -= Math.cos(angle) * steerStrength;
                p.vy -= Math.sin(angle) * steerStrength;
              }'''

new_steer = '''// Soft boundary - most particles gently steer away from edge (but not rogue ones)
              if (dist > boundaryRadius * 0.6 && !p.rogue) {
                const angle = Math.atan2(dy, dx);
                const steerStrength = (dist - boundaryRadius * 0.6) / (boundaryRadius * 0.4) * 0.05;
                p.vx -= Math.cos(angle) * steerStrength;
                p.vy -= Math.sin(angle) * steerStrength;
              }'''

if old_steer in content:
    content = content.replace(old_steer, new_steer)
    print("Updated steering to ignore rogue particles")
else:
    print("Could not find steering logic")

# Update the pop/respawn to reset rogue flag
old_respawn = '''// Respawn from center
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 1.2;
                p.vy = (Math.random() - 0.5) * 1.2;
              }'''

new_respawn = '''// Respawn from center
                const newAngle = Math.random() * Math.PI * 2;
                const newDist = Math.random() * boundaryRadius * 0.3;
                p.x = centerX + Math.cos(newAngle) * newDist;
                p.y = centerY + Math.sin(newAngle) * newDist;
                p.vx = (Math.random() - 0.5) * 0.8;
                p.vy = (Math.random() - 0.5) * 0.8;
                p.rogue = false;
                p.radius = Math.random() * 2 + 1;
              }'''

if old_respawn in content:
    content = content.replace(old_respawn, new_respawn)
    print("Updated respawn to reset rogue flag")
else:
    print("Could not find respawn logic")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
