#!/usr/bin/env python3
"""Add chaos mode to preview file"""

filepath = "preview-chaos.html"

with open(filepath, 'r') as f:
    content = f.read()

# Add chaosMode variable after other variables
old_vars = '''let lastPop = 0;
          
          function animate()'''

new_vars = '''let lastPop = 0;
          let chaosMode = false;
          
          function animate()'''

content = content.replace(old_vars, new_vars)

# Modify the drawing section - skip boundary when in chaos mode
old_boundary_draw = '''// Outer glow
            const gradient = ctx.createRadialGradient(centerX, centerY, boundaryRadius - 30, centerX, centerY, boundaryRadius + 60);'''

new_boundary_draw = '''// Skip boundary drawing in chaos mode
            if (chaosMode) {
              // No boundary - particles free
            } else {
            // Outer glow
            const gradient = ctx.createRadialGradient(centerX, centerY, boundaryRadius - 30, centerX, centerY, boundaryRadius + 60);'''

content = content.replace(old_boundary_draw, new_boundary_draw)

# Close the if block after boundary label
old_label = '''ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);'''

new_label = '''ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);
            } // end if !chaosMode'''

content = content.replace(old_label, new_label)

# Skip forced pops in chaos mode
old_force_pop = '''// Every ~500ms, launch a particle toward the boundary
            const now = Date.now();
            if (now - lastPop > 2000 + Math.random() * 1500) {'''

new_force_pop = '''// Every ~500ms, launch a particle toward the boundary (skip in chaos)
            const now = Date.now();
            if (!chaosMode && now - lastPop > 2000 + Math.random() * 1500) {'''

content = content.replace(old_force_pop, new_force_pop)

# Modify particle behavior for chaos mode
old_particle_else = '''} else {
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

new_particle_else = '''} else {
                // Normal movement
                p.x += p.vx;
                p.y += p.vy;
                
                if (chaosMode) {
                  // Chaos mode - bounce off screen edges
                  if (p.x < 0 || p.x > width) p.vx *= -1;
                  if (p.y < 0 || p.y > height) p.vy *= -1;
                  p.x = Math.max(0, Math.min(width, p.x));
                  p.y = Math.max(0, Math.min(height, p.y));
                } else {
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
                }
              }'''

content = content.replace(old_particle_else, new_particle_else)

# Update the easter egg to toggle chaos mode
old_easter = '''if (!isPlaying) {
                // Create YouTube iframe
                const container = document.getElementById('sos-player');
                container.innerHTML = '<iframe width="1" height="1" src="https://www.youtube.com/embed/cvChjHcABPA?autoplay=1&start=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
                isPlaying = true;
                icon.style.boxShadow = '0 0 60px rgba(157,140,207,0.9), 0 0 100px rgba(92,214,133,0.5)';
                icon.style.animation = 'pulse 1s ease-in-out infinite';
              } else {
                // Stop
                const container = document.getElementById('sos-player');
                container.innerHTML = '';
                isPlaying = false;
                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
                icon.style.animation = 'none';
              }'''

new_easter = '''if (!isPlaying) {
                // Create YouTube iframe and enable chaos
                const container = document.getElementById('sos-player');
                container.innerHTML = '<iframe width="1" height="1" src="https://www.youtube.com/embed/cvChjHcABPA?autoplay=1&start=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
                isPlaying = true;
                chaosMode = true;
                icon.style.boxShadow = '0 0 60px rgba(157,140,207,0.9), 0 0 100px rgba(92,214,133,0.5)';
                icon.style.animation = 'pulse 1s ease-in-out infinite';
                // Speed up and scatter particles
                particles.forEach(function(p) {
                  p.frozen = false;
                  p.vx = (Math.random() - 0.5) * 6;
                  p.vy = (Math.random() - 0.5) * 6;
                });
              } else {
                // Stop chaos and music
                const container = document.getElementById('sos-player');
                container.innerHTML = '';
                isPlaying = false;
                chaosMode = false;
                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
                icon.style.animation = 'none';
                // Reset particles to center
                particles.forEach(function(p) {
                  const angle = Math.random() * Math.PI * 2;
                  const dist = Math.random() * boundaryRadius * 0.5;
                  p.x = centerX + Math.cos(angle) * dist;
                  p.y = centerY + Math.sin(angle) * dist;
                  p.vx = (Math.random() - 0.5) * 1;
                  p.vy = (Math.random() - 0.5) * 1;
                  p.frozen = false;
                });
              }'''

content = content.replace(old_easter, new_easter)

with open(filepath, 'w') as f:
    f.write(content)

print("Created chaos preview")
