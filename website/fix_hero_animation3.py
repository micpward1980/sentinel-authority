#!/usr/bin/env python3
"""Force a couple particles per second to hit boundary and pop"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Find the animate function and add a timer for forced pops
old_animate_start = '''function animate() {
            ctx.clearRect(0, 0, width, height);
            boundaryPulse += 0.015;
            const pulseOffset = Math.sin(boundaryPulse) * 4;'''

new_animate_start = '''let lastPop = 0;
          
          function animate() {
            ctx.clearRect(0, 0, width, height);
            boundaryPulse += 0.015;
            const pulseOffset = Math.sin(boundaryPulse) * 4;
            
            // Force 2-3 pops per second
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

if old_animate_start in content:
    content = content.replace(old_animate_start, new_animate_start)
    print("Added forced pop timer")
else:
    # Try without the let lastPop if it was already added
    if 'let lastPop = 0;' in content:
        print("Pop timer already exists")
    else:
        print("Could not find animate function start")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
