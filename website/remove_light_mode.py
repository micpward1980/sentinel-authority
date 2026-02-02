#!/usr/bin/env python3
"""
Remove all light mode code from Sentinel Authority website
"""
import re

def remove_light_mode(html):
    """Strip all light mode CSS, toggle button, and JS"""
    
    # Remove light mode CSS section
    # Pattern: from "LIGHT MODE" header to next section
    pattern = r'/\* =+\s*\n\s*LIGHT MODE[^/]*?(?=/\* =+\s*\n\s*[A-Z]|\s*\.theme-toggle)'
    html = re.sub(pattern, '', html, flags=re.DOTALL)
    
    # Remove theme-toggle CSS
    pattern = r'\.theme-toggle\s*\{[^}]+\}[^/]*?(?=\s*/\*|\s*\n\s*\n)'
    html = re.sub(pattern, '', html, flags=re.DOTALL)
    
    # Remove any [data-theme="light"] rules that might remain
    pattern = r'\s*\[data-theme="light"\][^}]+\}|\s*html\[data-theme="light"\][^}]+\}'
    html = re.sub(pattern, '', html)
    
    # Remove theme toggle button from nav
    pattern = r'<button class="theme-toggle"[^>]*>.*?</button>\s*'
    html = re.sub(pattern, '', html, flags=re.DOTALL)
    
    # Remove theme toggle JS
    pattern = r'<script>\s*\n?\s*// Theme Toggle.*?</script>'
    html = re.sub(pattern, '', html, flags=re.DOTALL)
    
    # Also try alternate script pattern
    pattern = r'<script>\s*\n?\s*function toggleTheme\(\).*?</script>'
    html = re.sub(pattern, '', html, flags=re.DOTALL)
    
    # Clean up any double newlines left behind
    html = re.sub(r'\n{4,}', '\n\n\n', html)
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 remove_light_mode.py <input.html>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    original_len = len(html)
    html = remove_light_mode(html)
    new_len = len(html)
    
    with open(input_file, 'w') as f:
        f.write(html)
    
    removed = original_len - new_len
    print(f"✓ Removed light mode from {input_file} ({removed} chars)")
