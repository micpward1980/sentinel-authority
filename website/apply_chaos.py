import re

with open('preview-chaos.html', 'r') as f:
    c = f.read()

# 1. Add window globals BEFORE the canvas IIFE
old1 = '''<script>
        (function() {
          const canvas = document.getElementById('hero-canvas');'''
new1 = '''<script>
        window.chaos = false;
        window.heroData = { particles: null, cx: 0, cy: 0, r: 0 };
        (function() {
          const canvas = document.getElementById('hero-canvas');'''
c = c.replace(old1, new1)

# 2. Store particles globally after animate() call in init
old2 = '''animate();
          }
          
          function resize()'''
new2 = '''animate();
            window.heroData.particles = particles;
          }
          
          function resize()'''
c = c.replace(old2, new2)

# 3. Store center/radius at end of resize
old3 = '''boundaryRadius = width * 0.38;
            }
          }
          
          let lastPop'''
new3 = '''boundaryRadius = width * 0.38;
            }
            window.heroData.cx = centerX;
            window.heroData.cy = centerY;
            window.heroData.r = boundaryRadius;
          }
          
          let lastPop'''
c = c.replace(old3, new3)

# 4. Skip rogue launcher in chaos
c = c.replace(
    'if (now - lastPop > 2000 + Math.random() * 1500) {',
    'if (!window.chaos && now - lastPop > 2000 + Math.random() * 1500) {'
)

# 5. Skip boundary drawing in chaos
c = c.replace(
    '// Outer glow\n            const gradient',
    '// Outer glow (skip in chaos)\n            if (!window.chaos) {\n            const gradient'
)

c = c.replace(
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);",
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);\n            }"
)

# 6. Add chaos bounce in particle loop
c = c.replace(
    'p.x += p.vx;\n                p.y += p.vy;\n                \n                const dx = p.x - centerX;',
    'p.x += p.vx;\n                p.y += p.vy;\n                \n                if (window.chaos) {\n                  if (p.x < 0 || p.x > width) p.vx *= -1;\n                  if (p.y < 0 || p.y > height) p.vy *= -1;\n                  p.x = Math.max(0, Math.min(width, p.x));\n                  p.y = Math.max(0, Math.min(height, p.y));\n                }\n                \n                const dx = p.x - centerX;'
)

# 7. Skip boundary enforcement in chaos
c = c.replace(
    '// Soft boundary - most particles gently steer away (but not rogue ones)\n                if (dist',
    '// Soft boundary\n                if (!window.chaos && dist'
)

c = c.replace(
    '// Hard boundary - freeze at edge\n                if (dist',
    '// Hard boundary\n                if (!window.chaos && dist'
)

# 8. Change easter egg to 6 clicks in 10 seconds
c = c.replace('clickCount >= 3', 'clickCount >= 6')
c = c.replace('clickTimer = setTimeout(() => clickCount = 0, 1000);', 'clickTimer = setTimeout(() => clickCount = 0, 10000);')

# 9. Add chaos activation when music starts
c = c.replace(
    '''isPlaying = true;
            icon.style.boxShadow = '0 0 60px''',
    '''isPlaying = true;
            window.chaos = true;
            if (window.heroData.particles) {
              window.heroData.particles.forEach(function(p) {
                p.frozen = false;
                p.vx = (Math.random() - 0.5) * 8;
                p.vy = (Math.random() - 0.5) * 8;
              });
            }
            icon.style.boxShadow = '0 0 60px'''
)

# 10. Add chaos deactivation when music stops
c = c.replace(
    '''isPlaying = false;
            icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
            icon.style.animation = 'none';''',
    '''isPlaying = false;
            window.chaos = false;
            if (window.heroData.particles) {
              var cx = window.heroData.cx, cy = window.heroData.cy, r = window.heroData.r;
              window.heroData.particles.forEach(function(p) {
                var a = Math.random() * Math.PI * 2;
                var d = Math.random() * r * 0.5;
                p.x = cx + Math.cos(a) * d;
                p.y = cy + Math.sin(a) * d;
                p.vx = (Math.random() - 0.5);
                p.vy = (Math.random() - 0.5);
                p.frozen = false;
              });
            }
            icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
            icon.style.animation = 'none';'''
)

with open('preview-chaos.html', 'w') as f:
    f.write(c)

print('Done - chaos mode applied')
