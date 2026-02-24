import pikepdf
import sys

if len(sys.argv) < 2:
    print("Usage: python3 check_fonts.py path/to/file.pdf")
    sys.exit(1)

pdf_path = sys.argv[1]

with pikepdf.open(pdf_path) as pdf:
    fonts_found = {}

    for i, page in enumerate(pdf.pages):
        fonts = page.get("/Resources", {}).get("/Font", {})
        for key, ref in fonts.items():
            f = ref.get_object() if hasattr(ref, "get_object") else ref
            base = str(f.get("/BaseFont"))

            desc = f.get("/FontDescriptor")
            embedded = False
            if desc:
                desc = desc.get_object()
                if desc.get("/FontFile") or desc.get("/FontFile2") or desc.get("/FontFile3"):
                    embedded = True

            if base not in fonts_found:
                fonts_found[base] = {"pages": set(), "embedded": embedded}
            fonts_found[base]["pages"].add(i + 1)

    print("\nFonts used in document:")
    for font in sorted(fonts_found.keys()):
        info = fonts_found[font]
        print(f"\n{font}")
        print(f"  pages: {sorted(info['pages'])}")
        print(f"  embedded: {info['embedded']}")
