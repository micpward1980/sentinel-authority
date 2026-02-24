import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Add Intersection Observer to pause off-screen animations
observer_js = '''
  <script>
    // Performance: pause animations when off-screen
    const animatedSections = document.querySelectorAll('section, .diagram, svg');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          entry.target.querySelectorAll('*').forEach(el => el.style.animationPlayState = 'running');
        } else {
          entry.target.style.animationPlayState = 'paused';
          entry.target.querySelectorAll('*').forEach(el => el.style.animationPlayState = 'paused');
        }
      });
    }, { threshold: 0.1 });
    animatedSections.forEach(s => observer.observe(s));
  </script>
</body>'''

content = content.replace('</body>', observer_js)

# 2. Add will-change and reduce-motion support
perf_css = '''
    /* Performance optimizations */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    
    [class*="packet"], [class*="pulse"], [class*="flow"], .hero-ring {
      will-change: transform, opacity;
    }
    
    /* Replace expensive box-shadow animations with opacity */
'''

# Insert after first <style> tag opening
content = re.sub(r'(<style[^>]*>)', r'\1\n' + perf_css, content, count=1)

# 3. Replace animated box-shadow in thermo-dots with opacity-based glow
old_thermo = r'@keyframes thermo-dot-(\d+) \{ [^}]+\}'
def fix_thermo(m):
    pct = m.group(1)
    delay_map = {'0': '1', '33': '27', '66': '53', '100': '80'}
    start = delay_map.get(pct, '1')
    return f'''@keyframes thermo-dot-{pct} {{ 0%, {int(start)-1}% {{ background: rgba(30,33,43,1); border-color: rgba(157,140,207,0.3); opacity: 0.6; }} {start}%, 80% {{ background: rgba(92,214,133,1); border-color: rgba(92,214,133,1); opacity: 1; }} 85%, 100% {{ background: rgba(30,33,43,1); border-color: rgba(157,140,207,0.3); opacity: 0.6; }} }}'''

content = re.sub(old_thermo, fix_thermo, content)

# 4. Fix pulse-dot - use opacity instead of box-shadow
content = re.sub(
    r'@keyframes pulse-dot \{ [^}]+\}',
    '@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }',
    content
)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Added Intersection Observer (pauses off-screen animations)")
print("✓ Added will-change hints for GPU acceleration")
print("✓ Added prefers-reduced-motion support")
print("✓ Replaced expensive box-shadow animations with opacity")
