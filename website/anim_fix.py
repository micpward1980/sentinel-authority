import re

with open('index.html', 'r') as f:
    content = f.read()

# Add CSS to pause animations on elements outside viewport
# This is more reliable than JS-based pausing
pause_css = """
    /* Pause all animations when not in viewport - handled by JS observer */
    .anim-paused, .anim-paused * {
      animation-play-state: paused !important;
    }
"""

# Add after performance CSS section
if "prefers-reduced-motion" in content and "anim-paused" not in content:
    content = content.replace(
        "@media (prefers-reduced-motion: reduce)",
        pause_css + "\n    @media (prefers-reduced-motion: reduce)"
    )

# Replace the IntersectionObserver with a more comprehensive one
old_observer = """    // Performance: pause animations when off-screen
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
    animatedSections.forEach(s => observer.observe(s));"""

new_observer = """    // Performance: pause ALL animations when section is off-screen
    const animObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('anim-paused');
        } else {
          entry.target.classList.add('anim-paused');
        }
      });
    }, { threshold: 0, rootMargin: '100px' });
    document.querySelectorAll('section, .hero, .diagram, svg, [class*="flow"], [class*="packet"]').forEach(el => animObserver.observe(el));"""

if old_observer in content:
    content = content.replace(old_observer, new_observer)
elif "animObserver" not in content and "animatedSections" not in content:
    # Add it before </script></body>
    content = content.replace("</script>\n</body>", new_observer + "\n  </script>\n</body>")

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Added anim-paused CSS class")
print("✓ Improved IntersectionObserver to pause off-screen animations")
