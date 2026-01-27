import re
import os

# Canonical CSS for brand components (from index.html)
BRAND_CSS = '''    .brand{
      display:flex;
      align-items:center;
      gap: 10px;
      gap: var(--space-1, 10px);
      flex-shrink: 0;
      text-decoration: none;
      visibility: visible;
      opacity: 1;
    }
    .brand:hover{ text-decoration: none; }
    .brand-mark{
      width: 24px;
      height: 24px;
      background: #5B4B8A;
      background: var(--purple-primary, #5B4B8A);
      border: 2px solid #9d8ccf;
      border: 2px solid var(--purple-bright, #9d8ccf);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-mark-inner{
      width: 8px;
      height: 8px;
      background: #c4b8e8;
      border-radius: 50%;
    }
    .brand-name{
      font-family: 'IBM Plex Mono', monospace;
      font-family: var(--mono, 'IBM Plex Mono', monospace);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: rgba(255,255,255,.94);
      color: var(--text-primary, rgba(255,255,255,.94));
    }'''

# Canonical CSS for site-header (from index.html)
HEADER_CSS = '''    .site-header{
      position:fixed;
      top:0;
      width:100%;
      z-index:50;
      padding:0 var(--space-2, 20px);
      height: var(--nav-height, 72px);
      border-bottom:1px solid rgba(255,255,255,.10);
      background: rgba(42,47,61,.88);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      display: flex;
      align-items: center;
    }
    .nav-inner{
      max-width: var(--max, 1200px);
      margin:0 auto;
      width: 100%;
      display:flex;
      align-items:center;
      justify-content:space-between;
    }'''

files_to_fix = [
    'conformance-agreement.html',
    'privacy.html', 
    'terms.html',
    'security.html',
    'draft.html',
    'scenarios.html',
    'verify.html',
    'status.html'
]

for filename in files_to_fix:
    if not os.path.exists(filename):
        print(f"Skipping {filename} - not found")
        continue
    
    with open(filename, 'r') as f:
        content = f.read()
    
    original = content
    
    # Replace brand CSS - handle various formats (minified and expanded)
    # Pattern for .brand{ ... }.brand:hover{ ... }.brand-mark{ ... }.brand-mark-inner{ ... }.brand-name{ ... }
    brand_pattern = r'\.brand\{[^}]+\}[\s\S]*?\.brand-name\{[^}]+\}'
    
    if re.search(brand_pattern, content):
        content = re.sub(brand_pattern, BRAND_CSS.strip(), content, count=1)
    
    # Replace site-header and nav-inner CSS
    header_pattern = r'\.site-header\{[^}]+\}[\s\S]*?\.nav-inner\{[^}]+\}'
    if re.search(header_pattern, content):
        content = re.sub(header_pattern, HEADER_CSS.strip(), content, count=1)
    
    # Fix any remaining issues
    # Ensure --nav-height is defined in :root
    if '--nav-height' not in content and ':root' in content:
        content = content.replace(':root{', ':root{\n      --nav-height: 72px;')
    
    # Ensure --space-1 and --space-2 are defined
    if '--space-1' not in content and ':root' in content:
        content = content.replace(':root{', ':root{\n      --space-1: 10px;\n      --space-2: 20px;')
    
    if content != original:
        with open(filename, 'w') as f:
            f.write(content)
        print(f"Fixed {filename}")
    else:
        print(f"No changes needed for {filename}")

print("\nDone!")
