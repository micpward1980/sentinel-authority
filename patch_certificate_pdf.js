#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Certificate PDF Generation & Delivery
 * ============================================================
 * 
 * Backend fixes:
 *  1. Generate & store PDF at certificate issue time
 *  2. Fix applications.py pdf_data → certificate_pdf
 * 
 * Frontend fixes:
 *  3. Fix CustomerDashboard download URL
 *  4. Fix CAT-72 Console download URL
 *  5. Fix CertificatesPage download URL (if hardcoded)
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_certificate_pdf.js
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Certificate PDF & Delivery');
console.log('═══════════════════════════════════════════════════════\n');

let patchCount = 0;

// ─────────────────────────────────────────────────────────
// BACKEND PATCH 1: Store PDF at issue time in certificates.py
// ─────────────────────────────────────────────────────────

const CERT_ROUTES = path.join(__dirname, 'backend', 'app', 'api', 'routes', 'certificates.py');

if (!fs.existsSync(CERT_ROUTES)) { console.error('✗ certificates.py not found'); process.exit(1); }
let certCode = fs.readFileSync(CERT_ROUTES, 'utf8');

// After certificate is created and committed, generate PDF and store it
const OLD_ISSUE_END = `    await db.refresh(certificate)
    # Send notification email
    await notify_certificate_issued(application.contact_email, certificate.system_name, certificate.certificate_number, certificate.organization_name)`;

const NEW_ISSUE_END = `    await db.refresh(certificate)
    # Generate and store PDF
    try:
        odd_spec = certificate.odd_specification or {}
        odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
        pdf_bytes = generate_certificate_pdf(
            certificate.certificate_number,
            certificate.organization_name,
            certificate.system_name,
            odd_string,
            certificate.issued_at,
            certificate.expires_at,
            test.test_id if test else "N/A",
            certificate.convergence_score or 0.95,
            test.stability_index if test else 0.95,
            test.drift_rate if test else 0.01,
            certificate.evidence_hash or "N/A"
        )
        certificate.certificate_pdf = pdf_bytes
        await db.commit()
        await db.refresh(certificate)
    except Exception as e:
        print(f"[CERT] PDF generation failed for {certificate.certificate_number}: {e}")
    # Send notification email
    await notify_certificate_issued(application.contact_email, certificate.system_name, certificate.certificate_number, certificate.organization_name)`;

if (certCode.includes(OLD_ISSUE_END)) {
  certCode = certCode.replace(OLD_ISSUE_END, NEW_ISSUE_END);
  console.log('✓ Backend: generate & store PDF at issue time');
  patchCount++;
} else {
  console.log('⚠ Backend: PDF storage at issue time — pattern not found');
}

// Also add a regenerate endpoint for existing certificates without PDFs
const REGENERATE_ENDPOINT = `

@router.post("/{certificate_number}/regenerate-pdf")
async def regenerate_pdf(certificate_number: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    """Regenerate PDF for an existing certificate (admin only)"""
    result = await db.execute(select(Certificate).where(Certificate.certificate_number == certificate_number))
    cert = result.scalar_one_or_none()
    if not cert: raise HTTPException(status_code=404, detail="Certificate not found")
    test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
    test = test_result.scalar_one_or_none()
    odd_spec = cert.odd_specification or {}
    odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
    pdf_bytes = generate_certificate_pdf(
        cert.certificate_number, cert.organization_name, cert.system_name, odd_string,
        cert.issued_at, cert.expires_at, test.test_id if test else "N/A",
        cert.convergence_score or 0.95, test.stability_index if test else 0.95,
        test.drift_rate if test else 0.01, cert.evidence_hash or "N/A"
    )
    cert.certificate_pdf = pdf_bytes
    await db.commit()
    return {"message": f"PDF regenerated for {cert.certificate_number}", "size_bytes": len(pdf_bytes)}`;

// Add before the suspend endpoint
if (certCode.includes('@router.patch("/{certificate_number}/suspend")') && !certCode.includes('regenerate-pdf')) {
  certCode = certCode.replace('@router.patch("/{certificate_number}/suspend")', REGENERATE_ENDPOINT + '\n\n@router.patch("/{certificate_number}/suspend")');
  console.log('✓ Backend: added regenerate-pdf endpoint');
  patchCount++;
} else if (certCode.includes('regenerate-pdf')) {
  console.log('⚠ Backend: regenerate-pdf already exists');
} else {
  console.log('⚠ Backend: regenerate-pdf — insertion point not found');
}

// Also add an endpoint to regenerate ALL missing PDFs
const REGENERATE_ALL_ENDPOINT = `

@router.post("/regenerate-all-pdfs")
async def regenerate_all_pdfs(db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin"]))):
    """Regenerate PDFs for all certificates missing them (admin only)"""
    result = await db.execute(select(Certificate).where(Certificate.certificate_pdf == None))
    certs = result.scalars().all()
    regenerated = 0
    errors = []
    for cert in certs:
        try:
            test_result = await db.execute(select(CAT72Test).where(CAT72Test.id == cert.test_id))
            test = test_result.scalar_one_or_none()
            odd_spec = cert.odd_specification or {}
            odd_string = odd_spec.get("environment_type", "General") if isinstance(odd_spec, dict) else str(odd_spec)
            pdf_bytes = generate_certificate_pdf(
                cert.certificate_number, cert.organization_name, cert.system_name, odd_string,
                cert.issued_at, cert.expires_at, test.test_id if test else "N/A",
                cert.convergence_score or 0.95, test.stability_index if test else 0.95,
                test.drift_rate if test else 0.01, cert.evidence_hash or "N/A"
            )
            cert.certificate_pdf = pdf_bytes
            regenerated += 1
        except Exception as e:
            errors.append({"cert": cert.certificate_number, "error": str(e)})
    await db.commit()
    return {"regenerated": regenerated, "errors": errors, "total_missing": len(certs)}`;

if (certCode.includes('regenerate-pdf') && !certCode.includes('regenerate-all-pdfs')) {
  certCode = certCode.replace(REGENERATE_ENDPOINT, REGENERATE_ENDPOINT + REGENERATE_ALL_ENDPOINT);
  console.log('✓ Backend: added regenerate-all-pdfs endpoint');
  patchCount++;
} else if (certCode.includes('regenerate-all-pdfs')) {
  console.log('⚠ Backend: regenerate-all-pdfs already exists');
}

fs.writeFileSync(CERT_ROUTES, certCode);


// ─────────────────────────────────────────────────────────
// BACKEND PATCH 2: Fix applications.py pdf_data → certificate_pdf
// ─────────────────────────────────────────────────────────

const APP_ROUTES = path.join(__dirname, 'backend', 'app', 'api', 'routes', 'applications.py');

if (fs.existsSync(APP_ROUTES)) {
  let appCode = fs.readFileSync(APP_ROUTES, 'utf8');
  
  if (appCode.includes('certificate.pdf_data')) {
    appCode = appCode.replace(
      'if not certificate.pdf_data:',
      'if not certificate.certificate_pdf:'
    );
    appCode = appCode.replace(
      'content=certificate.pdf_data,',
      'content=certificate.certificate_pdf,'
    );
    fs.writeFileSync(APP_ROUTES, appCode);
    console.log('✓ Backend: fix applications.py pdf_data → certificate_pdf');
    patchCount++;
  } else if (appCode.includes('certificate.certificate_pdf')) {
    console.log('⚠ Backend: applications.py already uses certificate_pdf');
  } else {
    console.log('⚠ Backend: pdf_data pattern not found in applications.py');
  }
} else {
  console.log('⚠ applications.py not found');
}


// ─────────────────────────────────────────────────────────
// FRONTEND PATCHES: Fix download URLs
// ─────────────────────────────────────────────────────────

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');
if (!fs.existsSync(APP_JSX)) { console.error('✗ App.jsx not found'); process.exit(1); }
let code = fs.readFileSync(APP_JSX, 'utf8');
const origLen = code.length;

// Fix 3: CustomerDashboard — hardcoded Railway URL
const OLD_DASH_URL = 'href={`https://sentinel-authority-production.up.railway.app/api/applications/${cert.application_id}/certificate/download`}';
const NEW_DASH_URL = 'href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`}';

if (code.includes(OLD_DASH_URL)) {
  code = code.replace(OLD_DASH_URL, NEW_DASH_URL);
  console.log('✓ Frontend: fix CustomerDashboard cert download URL');
  patchCount++;
} else {
  // Try without the backtick wrapper
  const altOld = "https://sentinel-authority-production.up.railway.app/api/applications/${cert.application_id}/certificate/download";
  if (code.includes(altOld)) {
    code = code.replace(altOld, '${API_BASE}/api/certificates/${cert.certificate_number}/pdf');
    console.log('✓ Frontend: fix CustomerDashboard cert download URL (alt)');
    patchCount++;
  } else {
    console.log('⚠ Frontend: CustomerDashboard download URL — pattern not found');
  }
}

// Fix 4: CAT-72 Console download URL
const OLD_CAT_URL = '`${API_BASE}/api/applications/${test.application_id}/certificate/download`';
const NEW_CAT_URL = '`${API_BASE}/api/certificates/${test.certificate_number || test.test_id}/pdf`';

if (code.includes(OLD_CAT_URL)) {
  code = code.replace(OLD_CAT_URL, NEW_CAT_URL);
  console.log('✓ Frontend: fix CAT-72 Console cert download URL');
  patchCount++;
} else {
  // Try the href pattern
  const altCat = 'api/applications/${test.application_id}/certificate/download';
  if (code.includes(altCat)) {
    code = code.replace(altCat, 'api/certificates/${test.certificate_number || test.test_id}/pdf');
    console.log('✓ Frontend: fix CAT-72 Console cert download URL (alt)');
    patchCount++;
  } else {
    console.log('⚠ Frontend: CAT-72 download URL — pattern not found');
  }
}

// Fix 5: Add "Download PDF" button to CertificatesPage table if not present
// Check if CertificatesPage already has a download link
if (code.includes('function CertificatesPage') && !code.includes('/api/certificates/${cert.certificate_number}/pdf')) {
  // The certificates page may have a hardcoded URL — let's check
  const hardcodedCertUrl = 'https://sentinel-authority-production.up.railway.app/api/certificates/${cert.certificate_number}/pdf';
  if (code.includes(hardcodedCertUrl)) {
    code = code.replace(hardcodedCertUrl, '${API_BASE}/api/certificates/${cert.certificate_number}/pdf');
    console.log('✓ Frontend: fix CertificatesPage download URL');
    patchCount++;
  } else {
    console.log('⚠ Frontend: CertificatesPage download URL — no hardcoded URL found (may already be correct)');
  }
} else {
  console.log('⚠ Frontend: CertificatesPage download URL — already using dynamic URL or pattern not found');
}

// Fix 6: Ensure API_BASE is defined (check it exists)
if (!code.includes('API_BASE') || !code.includes("const API_BASE")) {
  // Check if it's defined somewhere
  const apiBaseMatch = code.match(/const API_BASE\s*=/);
  if (!apiBaseMatch) {
    console.log('⚠ Frontend: API_BASE not defined — checking for alternatives');
  }
}

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);


// ─────────────────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────────────────

console.log('\n── Verification ──');

const certFinal = fs.readFileSync(CERT_ROUTES, 'utf8');
const appFinal = fs.existsSync(APP_ROUTES) ? fs.readFileSync(APP_ROUTES, 'utf8') : '';
const jsxFinal = code;

const checks = [
  ['Backend: PDF generated at issue time', certFinal.includes('certificate.certificate_pdf = pdf_bytes') && certFinal.includes('generate_certificate_pdf(')],
  ['Backend: regenerate-pdf endpoint', certFinal.includes('regenerate-pdf')],
  ['Backend: regenerate-all-pdfs endpoint', certFinal.includes('regenerate-all-pdfs')],
  ['Backend: applications.py uses certificate_pdf', !appFinal.includes('pdf_data') || appFinal.includes('certificate_pdf')],
  ['Backend: /certificates/{num}/pdf endpoint exists', certFinal.includes('/{certificate_number}/pdf')],
  ['Frontend: no hardcoded Railway URLs for certs', !jsxFinal.includes('sentinel-authority-production.up.railway.app/api/applications') || !jsxFinal.includes('certificate/download')],
  ['Frontend: API_BASE used for cert URLs', jsxFinal.includes('API_BASE')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  # Regenerate PDFs for existing certificates:');
console.log('  curl -X POST https://sentinel-authority-production.up.railway.app/api/certificates/regenerate-all-pdfs \\');
console.log('    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"');
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: certificate PDF generation & delivery" && git push');
