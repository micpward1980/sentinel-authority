import re

with open('index.html', 'r') as f:
    content = f.read()

# Find and replace the old scroll-based reveal system
old_reveal = r"""    // Reveal animations on scroll
    const revealElements = document.querySelectorAll\('\.reveal'\);
    
    function checkReveal\(\) \{
      const windowHeight = window\.innerHeight;
      const revealPoint = 120;
      
      revealElements\.forEach\(el => \{[^}]+\}[^}]*\}\);
    \}
    
    window\.addEventListener\('scroll', checkReveal, \{ passive: true \}\);
    window\.addEventListener\('load', checkReveal\);
    checkReveal\(\);"""

new_reveal = """    // Reveal animations - IntersectionObserver (GPU-efficient, no scroll jank)
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          revealObserver.unobserve(entry.target); // Stop watching once revealed
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));"""

# Try to match the pattern more flexibly
content = re.sub(
    r"// Reveal animations on scroll[\s\S]*?checkReveal\(\);",
    new_reveal,
    content,
    count=1
)

# Also remove the duplicate scroll listener if it exists
content = re.sub(
    r"\s*window\.addEventListener\('scroll', checkReveal[^;]+;\s*",
    "\n",
    content
)

with open('index.html', 'w') as f:
    f.write(content)

print("✓ Replaced scroll-based reveal with IntersectionObserver")
print("✓ Removed expensive getBoundingClientRect calls on every scroll")
