import re
import os

# The canonical logo CSS from index.html
CANONICAL_CSS = '''    .brand-mark{
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

# Files to fix (not index.html - that's the reference)
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
    
    # Pattern to match existing brand CSS block (various formats)
    patterns = [
        # Minified format
        r'\.brand-mark\{[^}]+\}\s*\.brand-mark-inner\{[^}]+\}\s*\.brand-name\{[^}]+\}',
        # Expanded format with newlines
        r'\.brand-mark\{[^}]+\}\s+\.brand-mark-inner\{[^}]+\}\s+\.brand-name\{[^}]+\}',
    ]
    
    replaced = False
    for pattern in patterns:
        if re.search(pattern, content, re.DOTALL):
            content = re.sub(pattern, CANONICAL_CSS.strip(), content, count=1, flags=re.DOTALL)
            replaced = True
            break
    
    # Also fix any <span class="brand-name"> to <div class="brand-name">
    content = content.replace('<span class="brand-name">', '<div class="brand-name">')
    content = content.replace('</span>\n      </a>\n      <a href="index.html" class="back-link">', '</div>\n      </a>\n      <a href="index.html" class="back-link">')
    
    with open(filename, 'w') as f:
        f.write(content)
    
    print(f"Fixed {filename}" if replaced else f"Could not find pattern in {filename}")

print("\nDone! Deploy with: npx vercel deploy --prod")
