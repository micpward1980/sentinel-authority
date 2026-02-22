import os, re, shutil, glob
import pikepdf

BASE = os.path.dirname(os.path.abspath(__file__))

# Old purple colors → new navy #1d1a3b (0.114 0.102 0.231)
# Format: (old_r, old_g, old_b) tuples with tolerance matching
COLOR_REPLACEMENTS = [
    # #4a3d75 = 0.290 0.239 0.545
    (b'0.290 0.239 0.545', b'0.114 0.102 0.231'),
    (b'0.29 0.239 0.545', b'0.114 0.102 0.231'),
    # #5B4B8A = 0.357 0.294 0.541
    (b'0.357 0.294 0.541', b'0.114 0.102 0.231'),
    # #7c6baa = 0.486 0.420 0.667
    (b'0.486 0.420 0.667', b'0.114 0.102 0.231'),
    (b'0.486 0.42 0.667', b'0.114 0.102 0.231'),
    # #9D8CCF = 0.616 0.549 0.812
    (b'0.616 0.549 0.812', b'0.114 0.102 0.231'),
    # #c4b8e8 = 0.769 0.722 0.910
    (b'0.769 0.722 0.910', b'0.533 0.600 0.627'),
    # old purple as stroke (RG) and fill (rg) - both cases handled by substring match
]

def patch_pdf_colors(filepath):
    print(f"Processing: {os.path.basename(filepath)}")
    bak = filepath + '.colorbak'
    if not os.path.exists(bak):
        shutil.copy2(filepath, bak)
    
    try:
        pdf = pikepdf.open(filepath, allow_overwriting_input=True)
        hits = 0
        for page in pdf.pages:
            contents = page.get('/Contents')
            if not contents:
                continue
            streams = list(contents) if isinstance(contents, pikepdf.Array) else [contents]
            for ref in streams:
                try:
                    obj = ref if isinstance(ref, pikepdf.Stream) else pdf.get_object(ref.objgen)
                    raw = obj.read_bytes()
                    new = raw
                    for old, repl in COLOR_REPLACEMENTS:
                        # Replace both rg (fill) and RG (stroke) variants
                        new = new.replace(old + b' rg', repl + b' rg')
                        new = new.replace(old + b' RG', repl + b' RG')
                        new = new.replace(old + b' rg\n', repl + b' rg\n')
                        new = new.replace(old + b' RG\n', repl + b' RG\n')
                    if new != raw:
                        obj.write(new)
                        hits += 1
                except Exception as e:
                    pass
        
        if hits:
            pdf.save(filepath)
            print(f"  ✓ Patched {hits} stream(s)")
        else:
            print(f"  — No color matches found")
        pdf.close()
    except Exception as e:
        print(f"  ✗ Error: {e}")

# Find all PDFs
pdfs = glob.glob(os.path.join(BASE, '**/*.pdf'), recursive=True)
pdfs = [p for p in pdfs if '.bak' not in p and 'backup' not in p]

print(f"Found {len(pdfs)} PDFs\n")
for pdf in sorted(pdfs):
    patch_pdf_colors(pdf)

print("\nDone.")
