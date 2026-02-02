#!/usr/bin/env python3
"""Replace hero section with animated boundary enforcement background"""

filepath = "index.html"

with open(filepath, 'r') as f:
    lines = f.readlines()

# Find the hero section
start_line = None
end_line = None

for i, line in enumerate(lines):
    if '<section class="hero"' in line:
        start_line = i
    if start_line and '</section>' in line and i > start_line:
        end_line = i
        break

if start_line is None or end_line is None:
    print(f"✗ Could not find hero section: start={start_line}, end={end_line}")
    exit(1)

print(f"Found hero at lines {start_line+1}-{end_line+1}")

NEW_HERO = '''    <section class="hero" style="position: relative; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
      <!-- Boundary Enforcement Canvas -->
      <canvas id="hero-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;"></canvas>
      
      <!-- Vignette overlay for text readability -->
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at center, rgba(26,29,39,0.7) 0%, var(--bg-deep) 60%); z-index: 2; pointer-events: none;"></div>
      
      <!-- Hero Content -->
      <div style="position: relative; z-index: 10; text-align: center; padding: 40px; background: radial-gradient(ellipse at center, rgba(26,29,39,0.9) 0%, transparent 70%); border-radius: 20px; max-width: 700px;">
        
        <!-- ENVELO Mark -->
        <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 32px;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(157,140,207,0.5); z-index: 3;">
            <div class="hero-eye" style="width: 20px; height: 20px; background: radial-gradient(circle, #fff 0%, #c4b8e8 100%); border-radius: 50%; box-shadow: 0 0 15px rgba(255,255,255,0.5);"></div>
          </div>
        </div>
        
        <h1 style="font-family: var(--serif); font-size: clamp(36px, 6vw, 58px); font-weight: 200; line-height: 1.1; margin-bottom: 20px; letter-spacing: -0.02em; color: #fff; text-shadow: 0 2px 20px rgba(0,0,0,0.5);">
          Operational Design Domain<br><span class="accent" style="color: #c4b8e8; font-style: italic;">Conformance</span>
        </h1>
        
        <p style="font-size: clamp(15px, 2vw, 18px); color: rgba(255,255,255,0.7); max-width: 560px; margin: 0 auto 32px; line-height: 1.7; text-shadow: 0 1px 10px rgba(0,0,0,0.3);">
          The verification framework for autonomous systems that operate within declared boundaries. Enforced. Attested. Trusted.
        </p>
        
        <!-- CTA Buttons -->
        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          <a class="btn primary" href="https://app.sentinelauthority.org" style="display: inline-flex; align-items: center; gap: 10px; padding: 16px 28px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); box-shadow: 0 4px 24px rgba(91,75,138,0.4);">
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a class="btn" href="#envelo" style="display: inline-flex; align-items: center; gap: 8px;">
            How It Works
          </a>
        </div>
      </div>
      
      <!-- Scroll Indicator -->
      <div style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div class="scroll-line" style="width: 1px; height: 30px; background: linear-gradient(to bottom, rgba(157,140,207,0.5), transparent);"></div>
        <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 2px; color: rgba(255,255,255,0.35);">SCROLL</span>
      </div>
      
      <!-- Disclaimer at bottom -->
      <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 10; text-align: center; padding: 0 20px;">
        <p style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px; margin: 0; max-width: 600px;">
          Independent conformance determination. Not a regulator. ODDC does not attest safety or compliance.
        </p>
      </div>
      
      <script>
        (function() {
          const canvas = document.getElementById('hero-canvas');
          const ctx = canvas.getContext('2d');
          
          let width, height, centerX, centerY, boundaryRadius;
          let particles = [];
          let blockedParticles = [];
          let boundaryPulse = 0;
          
          function init() {
            resize();
            particles = [];
            
            for (let i = 0; i < 50; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * boundaryRadius * 0.85;
              particles.push({
                x: centerX + Math.cos(angle) * dist,
                y: centerY + Math.sin(angle) * dist,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: Math.random() * 2.5 + 1.5
              });
            }
            animate();
          }
          
          function resize() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
            centerX = width / 2;
            centerY = height / 2;
            boundaryRadius = Math.min(width, height) * 0.4;
          }
          
          function animate() {
            ctx.clearRect(0, 0, width, height);
            boundaryPulse += 0.015;
            const pulseOffset = Math.sin(boundaryPulse) * 4;
            
            // Outer glow
            const gradient = ctx.createRadialGradient(centerX, centerY, boundaryRadius - 30, centerX, centerY, boundaryRadius + 60);
            gradient.addColorStop(0, 'rgba(157,140,207,0)');
            gradient.addColorStop(0.5, 'rgba(157,140,207,0.06)');
            gradient.addColorStop(1, 'rgba(157,140,207,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // Main boundary
            ctx.beginPath();
            ctx.arc(centerX, centerY, boundaryRadius + pulseOffset, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(157,140,207,0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Inner boundary
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
            ctx.fillText('ODD BOUNDARY', 0, 0);
            ctx.restore();
            
            // Particles
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
              }
              
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(92,214,133,0.8)';
              ctx.fill();
              
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
              ctx.strokeStyle = 'rgba(92,214,133,0.25)';
              ctx.lineWidth = p.radius * 0.8;
              ctx.stroke();
              
              particles.slice(i + 1).forEach(p2 => {
                const dx2 = p.x - p2.x;
                const dy2 = p.y - p2.y;
                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (dist2 < 100) {
                  ctx.beginPath();
                  ctx.moveTo(p.x, p.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.strokeStyle = 'rgba(92,214,133,' + (0.2 * (1 - dist2 / 100)) + ')';
                  ctx.lineWidth = 0.6;
                  ctx.stroke();
                }
              });
            });
            
            blockedParticles = blockedParticles.filter(bp => {
              bp.life -= 0.04;
              if (bp.life <= 0) return false;
              ctx.beginPath();
              ctx.arc(bp.x, bp.y, 12 * (1 - bp.life) + 4, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(214,92,92,' + (bp.life * 0.9) + ')';
              ctx.fill();
              return true;
            });
            
            requestAnimationFrame(animate);
          }
          
          window.addEventListener('resize', resize);
          init();
        })();
      </script>
    </section>
'''

# Add CSS for hero animations
CSS_ADDITIONS = '''
    /* Hero animations */
    .hero-eye { animation: hero-eye-pulse 4s ease-in-out infinite; }
    @keyframes hero-eye-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .scroll-line { animation: scroll-bounce 2s ease-in-out infinite; }
    @keyframes scroll-bounce { 0%, 100% { transform: scaleY(1); opacity: 0.5; } 50% { transform: scaleY(0.7); opacity: 1; } }
'''

# Replace hero section
new_lines = lines[:start_line] + [NEW_HERO + '\n'] + lines[end_line + 1:]

with open(filepath, 'w') as f:
    f.writelines(new_lines)

# Add CSS if not present
with open(filepath, 'r') as f:
    content = f.read()

if '.hero-eye' not in content:
    content = content.replace('/* Security diagram animations */', CSS_ADDITIONS + '\n    /* Security diagram animations */')
    with open(filepath, 'w') as f:
        f.write(content)
    print("✓ Added hero CSS")

print("✓ Replaced hero section with boundary enforcement animation")
