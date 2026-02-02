with open('index.html', 'r') as f:
    c = f.read()

c = c.replace(
    '<script>\n        (function() {\n          const canvas',
    '<script>\n        window.chaos=false;window.hd={p:null,cx:0,cy:0,r:0};\n        (function() {\n          const canvas'
)

c = c.replace(
    'animate();\n          }\n          \n          function resize',
    'animate();window.hd.p=particles;\n          }\n          \n          function resize'
)

c = c.replace(
    'boundaryRadius = width * 0.38;\n            }\n          }\n          \n          let lastPop',
    'boundaryRadius = width * 0.38;\n            }\n            window.hd.cx=centerX;window.hd.cy=centerY;window.hd.r=boundaryRadius;\n          }\n          \n          let lastPop'
)

c = c.replace(
    'if (now - lastPop > 2000 + Math.random() * 1500)',
    'if (!window.chaos && now - lastPop > 2000 + Math.random() * 1500)'
)

c = c.replace(
    '// Outer glow\n            const gradient',
    '// Outer glow\n            if(!window.chaos){\n            const gradient'
)

c = c.replace(
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);",
    "ctx.fillText('ODDC Boundary', centerX, centerY - boundaryRadius - 20);}"
)

c = c.replace(
    'p.x += p.vx;\n                p.y += p.vy;',
    'p.x += p.vx;\n                p.y += p.vy;\n                if(window.chaos){if(p.x<0||p.x>width)p.vx*=-1;if(p.y<0||p.y>height)p.vy*=-1;}'
)

c = c.replace(
    'if (dist > boundaryRadius * 0.6 && !p.rogue)',
    'if (!window.chaos && dist > boundaryRadius * 0.6 && !p.rogue)'
)

c = c.replace(
    'if (dist > boundaryRadius - 10)',
    'if (!window.chaos && dist > boundaryRadius - 10)'
)

c = c.replace('clickCount >= 3', 'clickCount >= 6')
c = c.replace('setTimeout(() => clickCount = 0, 1000)', 'setTimeout(() => clickCount = 0, 10000)')

c = c.replace(
    "isPlaying = true;\n            icon.style.boxShadow = '0 0 60px",
    "isPlaying = true;\n            window.chaos=true;if(window.hd.p){window.hd.p.forEach(function(x){x.frozen=false;x.vx=(Math.random()-0.5)*8;x.vy=(Math.random()-0.5)*8;});}\n            icon.style.boxShadow = '0 0 60px"
)

c = c.replace(
    "isPlaying = false;\n            icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';\n            icon.style.animation = 'none';",
    "isPlaying = false;\n            window.chaos=false;if(window.hd.p){var d=window.hd;window.hd.p.forEach(function(x){var a=Math.random()*6.28;x.x=d.cx+Math.cos(a)*d.r*0.5;x.y=d.cy+Math.sin(a)*d.r*0.5;x.vx=(Math.random()-0.5);x.vy=(Math.random()-0.5);x.frozen=false;});}\n            icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';\n            icon.style.animation = 'none';"
)

with open('preview-chaos.html', 'w') as f:
    f.write(c)

print('OK')
