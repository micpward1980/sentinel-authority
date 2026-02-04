#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Public Verification Page Upgrade
 * ======================================================
 * 
 * Fixes:
 *  1. Status-aware result display (valid/suspended/revoked/expired with colors)
 *  2. Show convergence score, evidence hash, issued date, system version
 *  3. Evidence expandable section (calls /evidence endpoint)
 *  4. Copy shareable verification URL
 *  5. URL query param auto-verify (?cert=ODDC-2026-00001)
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_verification.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');
const VERIFY_PY = path.join(__dirname, 'backend', 'app', 'api', 'routes', 'verification.py');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Public Verification Page Upgrade');
console.log('═══════════════════════════════════════════════════════\n');

if (!fs.existsSync(APP_JSX)) { console.error('✗ App.jsx not found'); process.exit(1); }
let code = fs.readFileSync(APP_JSX, 'utf8');
const origLen = code.length;
let patchCount = 0;

function patch(name, oldStr, newStr) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.log(`⚠ ${name} — pattern not found`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Add evidence state + URL param auto-verify
// ═══════════════════════════════════════════════════════════

patch(
  'Add evidence state + URL param support',
  `function VerifyPage() {
  const [mode, setMode] = useState("verify"); // verify or search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!certNumber.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.get(\`/api/verify/\${certNumber}\`);
      setResult(res.data);
    } catch (err) {
      setError('Certificate not found');
    }
    setLoading(false);
  };`,
  `function VerifyPage() {
  const [mode, setMode] = useState("verify");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-verify from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cert = params.get('cert');
    if (cert) {
      setCertNumber(cert.toUpperCase());
      setTimeout(() => {
        doVerify(cert.toUpperCase());
      }, 300);
    }
  }, []);

  const doVerify = async (num) => {
    const cn = num || certNumber;
    if (!cn.trim()) return;
    setError('');
    setResult(null);
    setEvidence(null);
    setShowEvidence(false);
    setLoading(true);
    try {
      const res = await api.get(\`/api/verify/\${cn}\`);
      setResult(res.data);
      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('cert', cn);
      window.history.replaceState({}, '', url);
    } catch (err) {
      setError('Certificate not found');
    }
    setLoading(false);
  };

  const fetchEvidence = async () => {
    if (evidence) { setShowEvidence(!showEvidence); return; }
    try {
      const res = await api.get(\`/api/verify/\${certNumber}/evidence\`);
      setEvidence(res.data);
      setShowEvidence(true);
    } catch (err) {
      console.error('Evidence fetch failed');
    }
  };

  const copyVerificationUrl = () => {
    const url = \`\${window.location.origin}/verify?cert=\${certNumber}\`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    await doVerify();
  };`
);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Replace result display with status-aware version
// ═══════════════════════════════════════════════════════════

const OLD_RESULT = `          {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (
            <div className="mt-6 rounded-xl overflow-hidden" style={{
              background: 'rgba(92,214,133,0.08)', border: '1px solid rgba(92,214,133,0.25)',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px', background: 'rgba(92,214,133,0.15)',
                borderBottom: '1px solid rgba(92,214,133,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <CheckCircle className="w-5 h-5" style={{color: styles.accentGreen}} />
                  <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500}}>Valid Certificate</span>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '10px',
                  background: 'rgba(92,214,133,0.2)', color: styles.accentGreen,
                  fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, boxShadow: '0 0 8px rgba(92,214,133,0.8)'}}></span>
                  {result.state || 'CONFORMANT'}
                </span>
              </div>
              
              {/* Details */}
              <div style={{padding: '20px'}}>
                <div style={{display: 'grid', gap: '16px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Certificate</span>
                    <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 500}}>{result.certificate_number}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Organization</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.organization_name}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>System</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.system_name}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Expires</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.expires_at ? new Date(result.expires_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}`;

const NEW_RESULT = `          {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (() => {
            const isValid = result.valid;
            const status = (result.status || '').toUpperCase();
            const statusConfig = {
              CONFORMANT: { color: styles.accentGreen, bg: 'rgba(92,214,133,0.08)', border: 'rgba(92,214,133,0.25)', headerBg: 'rgba(92,214,133,0.15)', icon: 'Valid Certificate', label: 'CONFORMANT' },
              SUSPENDED: { color: '#D6A05C', bg: 'rgba(214,160,92,0.08)', border: 'rgba(214,160,92,0.25)', headerBg: 'rgba(214,160,92,0.15)', icon: 'Suspended', label: 'SUSPENDED' },
              REVOKED: { color: '#D65C5C', bg: 'rgba(214,92,92,0.08)', border: 'rgba(214,92,92,0.25)', headerBg: 'rgba(214,92,92,0.15)', icon: 'Revoked', label: 'REVOKED' },
              EXPIRED: { color: '#D65C5C', bg: 'rgba(214,92,92,0.08)', border: 'rgba(214,92,92,0.25)', headerBg: 'rgba(214,92,92,0.15)', icon: 'Expired', label: 'EXPIRED' },
            };
            const cfg = statusConfig[status] || statusConfig.CONFORMANT;
            const rowStyle = {display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'};
            const labelSt = {color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'};
            const valSt = {color: styles.textPrimary, fontSize: '14px'};
            
            return (
            <div className="mt-6 rounded-xl overflow-hidden" style={{background: cfg.bg, border: '1px solid ' + cfg.border}}>
              {/* Status Header */}
              <div style={{padding: '16px 20px', background: cfg.headerBg, borderBottom: '1px solid ' + cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  {isValid ? <CheckCircle className="w-5 h-5" style={{color: cfg.color}} /> : <AlertTriangle className="w-5 h-5" style={{color: cfg.color}} />}
                  <span style={{color: cfg.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500}}>{cfg.icon}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '10px', background: cfg.bg, color: cfg.color, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid ' + cfg.border}}>
                    <span style={{width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, boxShadow: '0 0 8px ' + cfg.color}}></span>
                    {cfg.label}
                  </span>
                </div>
              </div>
              
              {/* Status Message */}
              {result.message && (
                <div style={{padding: '12px 20px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                  <p style={{margin: 0, color: cfg.color, fontSize: '13px'}}>{result.message}</p>
                </div>
              )}
              
              {/* Details */}
              <div style={{padding: '20px'}}>
                <div style={{display: 'grid', gap: '16px'}}>
                  <div style={rowStyle}>
                    <span style={labelSt}>Certificate</span>
                    <span style={{color: cfg.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 500}}>{result.certificate_number}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelSt}>Organization</span>
                    <span style={valSt}>{result.organization_name || '-'}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelSt}>System</span>
                    <span style={valSt}>{result.system_name || '-'}{result.system_version ? ' v' + result.system_version : ''}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelSt}>Issued</span>
                    <span style={valSt}>{result.issued_at ? new Date(result.issued_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelSt}>Expires</span>
                    <span style={{...valSt, color: status === 'EXPIRED' ? '#D65C5C' : styles.textPrimary}}>{result.expires_at ? new Date(result.expires_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  {result.convergence_score != null && (
                    <div style={rowStyle}>
                      <span style={labelSt}>Convergence Score</span>
                      <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: result.convergence_score >= 0.95 ? styles.accentGreen : '#D6A05C'}}>{(result.convergence_score * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {result.evidence_hash && (
                    <div style={{paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                      <span style={labelSt}>Evidence Hash</span>
                      <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, marginTop: '6px', wordBreak: 'break-all', lineHeight: '1.5'}}>{result.evidence_hash}</div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div style={{display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap'}}>
                  <button onClick={copyVerificationUrl} style={{
                    padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: styles.textSecondary, cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {copied ? '✓ Copied!' : '⎘ Share Link'}
                  </button>
                  {isValid && (
                    <button onClick={fetchEvidence} style={{
                      padding: '8px 16px', background: 'rgba(91,75,138,0.15)', border: '1px solid rgba(91,75,138,0.3)',
                      borderRadius: '8px', color: styles.purpleBright, cursor: 'pointer',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      {showEvidence ? '▾ Hide Evidence' : '▸ View Evidence'}
                    </button>
                  )}
                </div>
                
                {/* Evidence Panel */}
                {showEvidence && evidence && (
                  <div style={{marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Evidence Chain</div>
                    <div style={{display: 'grid', gap: '10px'}}>
                      <div>
                        <span style={{fontSize: '11px', color: styles.textTertiary}}>Evidence Hash (SHA-256)</span>
                        <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.purpleBright, wordBreak: 'break-all', marginTop: '4px'}}>{evidence.evidence_hash || '-'}</div>
                      </div>
                      <div>
                        <span style={{fontSize: '11px', color: styles.textTertiary}}>Convergence Score</span>
                        <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: styles.accentGreen, marginTop: '4px'}}>{evidence.convergence_score ? (evidence.convergence_score * 100).toFixed(2) + '%' : '-'}</div>
                      </div>
                      {evidence.odd_scope?.environment_type && (
                        <div>
                          <span style={{fontSize: '11px', color: styles.textTertiary}}>ODD Environment</span>
                          <div style={{fontSize: '13px', color: styles.textPrimary, marginTop: '4px'}}>{evidence.odd_scope.environment_type}</div>
                        </div>
                      )}
                      <div style={{marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
                        <p style={{fontSize: '11px', color: styles.textTertiary, lineHeight: '1.6', whiteSpace: 'pre-line', margin: 0}}>{evidence.verification_instructions || ''}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}`;

patch('Replace result display with status-aware version', OLD_RESULT, NEW_RESULT);

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);

// ═══════════════════════════════════════════════════════════
// BACKEND FIX: verification.py — certificate_id → certificate_number
// ═══════════════════════════════════════════════════════════

console.log('\n── Backend Fix ──');
if (fs.existsSync(VERIFY_PY)) {
  let pyCode = fs.readFileSync(VERIFY_PY, 'utf8');
  
  // Fix undefined variable bug
  if (pyCode.includes('Certificate.certificate_number == certificate_id')) {
    pyCode = pyCode.replace(
      'Certificate.certificate_number == certificate_id',
      'Certificate.certificate_number == certificate_number'
    );
    fs.writeFileSync(VERIFY_PY, pyCode);
    console.log('✓ Fix certificate_id → certificate_number (undefined var bug)');
    patchCount++;
  } else {
    console.log('⚠ Backend bug already fixed or pattern not found');
  }
} else {
  console.log('⚠ verification.py not found');
}

const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['Evidence state added', code.includes("const [evidence, setEvidence]")],
  ['URL param auto-verify', code.includes("params.get('cert')")],
  ['doVerify function', code.includes('const doVerify = async')],
  ['URL updated on verify', code.includes("url.searchParams.set('cert'")],
  ['fetchEvidence function', code.includes('const fetchEvidence = async')],
  ['copyVerificationUrl function', code.includes('const copyVerificationUrl')],
  ['Status-aware colors (SUSPENDED)', code.includes("SUSPENDED: { color: '#D6A05C'")],
  ['Status-aware colors (REVOKED)', code.includes("REVOKED: { color: '#D65C5C'")],
  ['Status-aware colors (EXPIRED)', code.includes("EXPIRED: { color: '#D65C5C'")],
  ['Convergence score displayed', code.includes('Convergence Score')],
  ['Evidence hash displayed', code.includes('Evidence Hash')],
  ['Share Link button', code.includes('Share Link')],
  ['View Evidence button', code.includes('View Evidence')],
  ['Evidence panel with instructions', code.includes('Evidence Chain')],
  ['System version shown', code.includes("result.system_version ? ' v'")],
  ['Issued date shown', code.includes('result.issued_at ?')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: public verification page upgrade"');
