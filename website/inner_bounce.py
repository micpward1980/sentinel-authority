import re

with open('index.html', 'r') as f:
    content = f.read()

# Replace the soft boundary section with a bounce
old_soft = """// Soft boundary - most particles gently steer away (but not rogue ones)
                if (!window._chaos && (Date.now() - (window._chaosEndTime || 0) > 500) && dist > boundaryRadius * 0.6 && !p.rogue) {
                  const angle = Math.atan2(dy, dx);
                  // steering disabled for fast particles
                }"""

new_soft = """// Soft boundary - bounce particles back before they reach edge
                if (!window._chaos && (Date.now() - (window._chaosEndTime || 0) > 500) && dist > boundaryRadius * 0.7 && !p.rogue) {
                  const angle = Math.atan2(dy, dx);
                  // Reflect velocity away from boundary
                  const dot = p.vx * Math.cos(angle) + p.vy * Math.sin(angle);
                  if (dot > 0) {
                    p.vx -= 2 * dot * Math.cos(angle);
                    p.vy -= 2 * dot * Math.sin(angle);
                  }
                }"""

content = content.replace(old_soft, new_soft)

with open('index.html', 'w') as f:
    f.write(content)

print("done")
