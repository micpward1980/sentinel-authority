import re
import os

# Read index.html to extract the exact CSS
with open('index.html', 'r') as f:
    index_content = f.read()

# Extract the full style block from index.html
style_match = re.search(r'<style>(.*?)</style>', index_content, re.DOTALL)
if not style_match:
    print("Could not find style block in index.html")
    exit(1)

INDEX_STYLE = style_match.group(1)

# Extract just the :root and common CSS we need (up to nav-drawer which is index-specific)
# We want everything from :root through the brand styles

files_to_fix = [
    'verify.html',
    'security.html', 
    'privacy.html',
    'terms.html',
    'conformance-agreement.html',
    'draft.html',
    'scenarios.html',
    'status.html',
]

for filename in files_to_fix:
    if not os.path.exists(filename):
        print(f"Skipping {filename} - not found")
        continue
    
    with open(filename, 'r') as f:
        content = f.read()
    
    # Extract existing style content
    old_style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if not old_style_match:
        print(f"No style block in {filename}")
        continue
    
    old_style = old_style_match.group(1)
    
    # Build new style by taking key sections from index.html
    # 1. Get :root block from index
    root_match = re.search(r'(:root\{.*?\})', INDEX_STYLE, re.DOTALL)
    
    # 2. Get all the common CSS (skip-link, sr-only, focus, html, body, a, selection, grid-overlay, site-header, nav-inner, brand)
    common_css_match = re.search(r'(\s*/\* Skip link.*?\.brand-name\{[^}]+\})', INDEX_STYLE, re.DOTALL)
    
    if root_match and common_css_match:
        # Find where brand-name ends in the old style
        old_after_brand = re.search(r'(\.brand-name\{[^}]+\})(.*)', old_style, re.DOTALL)
        
        if old_after_brand:
            # Keep everything after brand-name from old file (page-specific styles)
            page_specific = old_after_brand.group(2)
            
            # Build new style
            new_style = root_match.group(1) + common_css_match.group(1) + page_specific
            
            # Replace style block
            content = re.sub(r'<style>.*?</style>', '<style>' + new_style + '</style>', content, flags=re.DOTALL)
            
            with open(filename, 'w') as f:
                f.write(content)
            print(f"✓ Fixed: {filename}")
        else:
            print(f"Could not find brand-name in {filename}")
    else:
        print(f"Could not extract CSS from index.html")
        break

print("\nDone! Deploy with: npx vercel deploy --prod")
