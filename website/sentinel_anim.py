import re

with open('index.html', 'r') as f:
    content = f.read()

# Find the entire hero canvas script and replace it
old_script_start = "(function() {\n          const canvas = document.getElementById('hero-canvas');"
old_script_end = "init();\n        })();"

# New sentinel-themed animation
new_script = '''(function() {
          const canvas = document.getElementById('hero-canvas');
          const ctx = canvas.getContext('2d');
          
          let width, height, centerX, centerY, boundaryRadius;
          let particles = [];
          let boundaryFlash = 0;
          let boundaryPulse = 0;
          
          function init() {
            resize();
            particles = [];
            
            // Create particles in smooth orbital paths
            for (let i = 0; i < 25; i++) {
              const orbitRadius = boundaryRadius * (0.3 + Math.random() * 0.35);
              const angle = Math.random() * Math.PI * 2;
              const speed = 0.003 + Math.random() * 0.004;
              const clockwise = Math.random() > 0.3;
              particles.push({
                orbitRadius: orbitRadius,
                angle: angle,
                speed: speed * (clockwise ? 1 : -1),
                radius: Math.random() * 2 + 1.5,
                rogue: false,
                blocked: false,
                blockedTime: 0,
                escapeAngle: 0,
                escapeProgress: 0
              });
            }
            animate();
          }
          
          function resize() {
            const dpr = window.devicePixelRatio || 1;
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            centerX = width / 2;
            centerY = height / 2;
            boundaryRadius = Math.min(width * 0.4, height * 0.35);
            if (height > width * 1.3) {
              centerY = height * 0.35;
              boundaryRadius = width * 0.38;
            }
          }
          
          let lastRogue = 0;
          
          function animate() {
            ctx.clearRect(0, 0, width, height);
            boundaryPulse += 0.015;
            const pulseOffset = Math.sin(boundaryPulse) * 3;
            
            // Occasionally spawn a rogue particle
            const now = Date.now();
            if (now - lastRogue > 4000 + Math.random() * 3000) {
              const candidate = particles.find(p => !p.rogue && !p.blocked);
              if (candidate) {
                candidate.rogue = true;
                candidate.escapeAngle = candidate.angle;
                candidate.escapeProgress = 0;
                lastRogue = now;
              }
            }
            
            // Draw boundary gradient
            const gradient = ctx.createRadialGradient(centerX, centerY, boundaryRadius - 30, centerX, centerY, boundaryRadius + 60);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.7, 'rgba(157,140,207,0.03)');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // Draw boundary circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, boundaryRadius + pulseOffset, 0, Math.PI * 2);
            const boundaryAlpha = 0.35 + boundaryFlash * 0.5;
            ctx.strokeStyle = boundaryFlash > 0 ? 'rgba(255,100,100,' + boundaryAlpha + ')' : 'rgba(157,140,207,0.35)';
            ctx.lineWidth = 2 + boundaryFlash * 2;
            ctx.stroke();
            
            // Inner dashed circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, boundaryRadius + pulseOffset - 12, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(157,140,207,0.12)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 12]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Label
            ctx.save();
            ctx.translate(centerX, centerY - boundaryRadius - 30);
            ctx.fillStyle = 'rgba(157,140,207,0.5)';
            ctx.font = '11px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ODD Boundary', 0, 0);
            ctx.restore();
            
            // Decay flash
            if (boundaryFlash > 0) boundaryFlash *= 0.92;
            
            // Update and draw particles
            particles.forEach(p => {
              let x, y;
              
              if (p.blocked) {
                // Frozen at boundary
                x = centerX + Math.cos(p.escapeAngle) * (boundaryRadius - 8);
                y = centerY + Math.sin(p.escapeAngle) * (boundaryRadius - 8);
                
                // After 2 seconds, return to orbit
                if (now - p.blockedTime > 2000) {
                  p.blocked = false;
                  p.rogue = false;
                  p.orbitRadius = boundaryRadius * 0.5;
                }
              } else if (p.rogue) {
                // Moving outward toward boundary
                p.escapeProgress += 0.012;
                const currentRadius = p.orbitRadius + (boundaryRadius - p.orbitRadius) * p.escapeProgress;
                x = centerX + Math.cos(p.escapeAngle) * currentRadius;
                y = centerY + Math.sin(p.escapeAngle) * currentRadius;
                
                // Hit boundary - BLOCKED
                if (currentRadius > boundaryRadius - 10) {
                  p.blocked = true;
                  p.blockedTime = now;
                  boundaryFlash = 1;
                }
              } else {
                // Normal orbital motion
                p.angle += p.speed;
                x = centerX + Math.cos(p.angle) * p.orbitRadius;
                y = centerY + Math.sin(p.angle) * p.orbitRadius;
              }
              
              // Draw particle
              ctx.beginPath();
              ctx.arc(x, y, p.blocked ? p.radius * 1.5 : p.radius, 0, Math.PI * 2);
              if (p.blocked) {
                ctx.fillStyle = '#FF4444';
                ctx.shadowColor = '#FF4444';
                ctx.shadowBlur = 15;
              } else if (p.rogue) {
                ctx.fillStyle = 'rgba(255,180,100,0.9)';
                ctx.shadowColor = 'rgba(255,180,100,0.5)';
                ctx.shadowBlur = 10;
              } else {
                ctx.fillStyle = 'rgba(92,214,133,0.7)';
                ctx.shadowBlur = 0;
              }
              ctx.fill();
              ctx.shadowBlur = 0;
            });
            
            // Draw faint connection lines between nearby orbiting particles
            ctx.strokeStyle = 'rgba(92,214,133,0.08)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < particles.length; i++) {
              if (particles[i].rogue || particles[i].blocked) continue;
              const p1 = particles[i];
              const x1 = centerX + Math.cos(p1.angle) * p1.orbitRadius;
              const y1 = centerY + Math.sin(p1.angle) * p1.orbitRadius;
              for (let j = i + 1; j < particles.length; j++) {
                if (particles[j].rogue || particles[j].blocked) continue;
                const p2 = particles[j];
                const x2 = centerX + Math.cos(p2.angle) * p2.orbitRadius;
                const y2 = centerY + Math.sin(p2.angle) * p2.orbitRadius;
                const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
                if (dist < 80) {
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  ctx.stroke();
                }
              }
            }
            
            requestAnimationFrame(animate);
          }
          
          window.addEventListener('resize', () => { resize(); });
          init();
        })();'''

# Find and replace the script
pattern = r'\(function\(\) \{\s*const canvas = document\.getElementById\(\'hero-canvas\'\);.*?init\(\);\s*\}\)\(\);'
content = re.sub(pattern, new_script, content, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(content)

print("done")
