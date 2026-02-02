import re

# Start fresh
with open('index.html', 'r') as f:
    c = f.read()

# Add chaos as window variable before the canvas script
c = c.replace(
    "(function() {\n          const canvas = document.getElementById('hero-canvas');",
    "window.chaos = false;\n        window.heroParticles = [];\n        window.heroCenter = {};\n        (function() {\n          const canvas = document.getElementById('hero-canvas');"
)

# Store particles globally
c = c.replace(
    'let particles = [];',
    'let particles = []; window.heroParticles = particles;'
)

# Store center and radius globally after resize
c = c.replace(
    'boundaryRadius = Math.min(width * 0.4, height * 0.35);',
    'boundaryRadius = Math.min(width * 0.4, height * 0.35); window.heroCenter = {x: centerX, y: centerY, r: boundaryRadius};'
)

# Skip boundary in chaos
c = c.replace(
    '// Outer glow',
    '// Outer glow - skip in chaos\n            if (!window.chaos) {'
)

c = c.replace(
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);",
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);\n            }"
)

# Skip rogue in chaos
c = c.replace(
    'if (now - lastPop > 2000 + Math.random() * 1500) {',
    'if (!window.chaos && now - lastPop > 2000 + Math.random() * 1500) {'
)

# Add chaos bounce
c = c.replace(
    'p.x += p.vx;\n                p.y += p.vy;\n                \n                const dx = p.x - centerX;',
    'p.x += p.vx;\n                p.y += p.vy;\n                \n                if (window.chaos) {\n                  if (p.x < 0 || p.x > width) p.vx *= -1;\n                  if (p.y < 0 || p.y > height) p.vy *= -1;\n                  p.x = Math.max(0, Math.min(width, p.x));\n                  p.y = Math.max(0, Math.min(height, p.y));\n                }\n                \n                const dx = p.x - centerX;'
)

# Skip boundary enforcement in chaos
c = c.replace(
    'if (dist > boundaryRadius * 0.6 && !p.rogue) {',
    'if (!window.chaos && dist > boundaryRadius * 0.6 && !p.rogue) {'
)

c = c.replace(
    'if (dist > boundaryRadius - 10) {',
    'if (!window.chaos && dist > boundaryRadius - 10) {'
)

# Change click count to 6 and timeout to 10 seconds
c = c.replace('clickCount >= 3', 'clickCount >= 6')
c = c.replace('clickTimer = setTimeout(() => clickCount = 0, 1000)', 'clickTimer = setTimeout(() => clickCount = 0, 10000)')

# Add chaos activation on play
c = c.replace(
    'isPlaying = true;\n                icon.style.boxShadow',
    'isPlaying = true;\n                window.chaos = true;\n                window.heroParticles.forEach(function(p) { p.frozen = false; p.vx = (Math.random() - 0.5) * 8; p.vy = (Math.random() - 0.5) * 8; });\n                icon.style.boxShadow'
)

# Add chaos deactivation on stop
c = c.replace(
    "isPlaying = false;\n                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';",
    "isPlaying = false;\n                window.chaos = false;\n                var cx = window.heroCenter.x, cy = window.heroCenter.y, r = window.heroCenter.r;\n                window.heroParticles.forEach(function(p) { var a = Math.random() * Math.PI * 2; var d = Math.random() * r * 0.5; p.x = cx + Math.cos(a) * d; p.y = cy + Math.sin(a) * d; p.vx = (Math.random() - 0.5); p.vy = (Math.random() - 0.5); p.frozen = false; });\n                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';"
)

with open('preview-chaos.html', 'w') as f:
    f.write(c)

print('Done')
