import os, shutil
import pikepdf

BASE = os.path.dirname(os.path.abspath(__file__))

def patch_pdf(relpath, pairs, label):
    filepath = os.path.join(BASE, relpath)
    print(f"📄 {relpath}\n   {label}")
    if not os.path.exists(filepath):
        print("   ⚠  File not found — skipping\n"); return False
    bak = filepath + '.bak'
    if not os.path.exists(bak): shutil.copy2(filepath, bak)
    pdf = pikepdf.open(filepath, allow_overwriting_input=True)
    hits = 0
    for page in pdf.pages:
        contents = page.get('/Contents')
        if not contents: continue
        streams = list(contents) if isinstance(contents, pikepdf.Array) else [contents]
        for ref in streams:
            obj = ref if isinstance(ref, pikepdf.Stream) else pdf.get_object(ref.objgen)
            raw = obj.read_bytes()
            new = raw
            for old, repl in pairs:
                new = new.replace(old.encode('latin-1'), repl.encode('latin-1'))
            if new != raw:
                obj.write(new); hits += 1
    if hits:
        pdf.save(filepath); pdf.close()
        print(f"   ✓  Patched {hits} stream(s)\n"); return True
    else:
        pdf.close()
        print(f"   ✗  No matches found\n"); return False

print("=" * 55)
print("Sentinel Authority — PDF Fix Script")
print("=" * 55); print()

for f in ["docs/CAT-72_Procedure_v1.0.pdf","docs/CAT-72_Procedure_v2.0.pdf","docs/CAT-72_Procedure_v3.0.pdf"]:
    patch_pdf(f, [("Convergence Authorization Test","Conformance Assessment Test")], "CAT-72 name: Convergence → Conformance Assessment Test")

ref = [
    ("ODDC Overview v1.1, ENVELO Requirements v1.1, CAT-72 Procedure v1.1","ODDC Overview v3.0, ENVELO Requirements v3.0, CAT-72 Procedure v3.0"),
    ("ODDC Overview v1.1","ODDC Overview v3.0"),
    ("ENVELO Requirements v1.1","ENVELO Requirements v3.0"),
    ("CAT-72 Procedure v1.1","CAT-72 Procedure v3.0"),
]
for f in ["publications/Process_vs_Behavioral_Attestation.pdf","publications/Ten_Domains_Zero_Standards.pdf","publications/The_Accountability_Chain.pdf","publications/The_Insurance_Imperative.pdf","Sentinel_Authority_When_Self-Certification_Fails.pdf","SA_White_Paper_When_Self-Certification_Fails_old.pdf"]:
    patch_pdf(f, ref, "References: v1.1 → v3.0")

patch_pdf("SA_White_Paper_When_Self-Certification_Fails.pdf", [
    ("SUSPENDED","PAUSED"),
    ("Telemetry collection only. Autonomous actuation is prohibited. The system is being monitored but cannot take independent action.","Telemetry collection and boundary auto-discovery. The system operates normally while the Interlock observes live operational telemetry."),
    ("Limited autonomy within elevated oversight constraints. The system operates under tighter restrictions than full conformance.","Boundaries approved, enforcement active. CAT-72 verification in progress. System operates under full runtime enforcement."),
    ("Full autonomy permitted within the declared Operational Design Domain. Conformance has been independently determined.","Full autonomy within the verified operational envelope. Conformance independently determined. Continuous monitoring active."),
    ("ODDC Overview v1.1, ENVELO Requirements v1.1, CAT-72 Procedure v1.1","ODDC Overview v3.0, ENVELO Requirements v3.0, CAT-72 Procedure v3.0"),
    ("ODDC Overview v1.1","ODDC Overview v3.0"),
    ("ENVELO Requirements v1.1","ENVELO Requirements v3.0"),
    ("CAT-72 Procedure v1.1","CAT-72 Procedure v3.0"),
], "Fix SUSPENDED→PAUSED, OBSERVE/BOUNDED descriptions, v1.1→v3.0 refs")

print("📄 downloads/ODDC_Certification_Guide_v3.pdf\n   Replace superseded v3 guide with v4.0 content")
src = os.path.join(BASE, "docs/ODDC_Certification_Guide_v4.0.pdf")
dest = os.path.join(BASE, "downloads/ODDC_Certification_Guide_v3.pdf")
if os.path.exists(src) and os.path.exists(dest):
    bak = dest + '.bak'
    if not os.path.exists(bak): shutil.copy2(dest, bak)
    shutil.copy2(src, dest)
    print("   ✓  Replaced with v4.0 content\n")

print("=" * 55)
print("Done. Originals backed up as <file>.bak")
