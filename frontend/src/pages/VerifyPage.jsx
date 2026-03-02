import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Search, Download, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

const LABEL = { color: styles.textTertiary, fontSize: '10px', fontFamily: styles.mono, textTransform: 'uppercase', letterSpacing: '1.5px' };
const VAL = { color: styles.textPrimary, fontSize: '14px', fontWeight: 500 };
const ROW = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 0', borderBottom: '1px solid ' + styles.borderSubtle };
const BTN = (color, solid) => ({
  padding: '6px 14px', background: solid ? color : 'transparent',
  border: '1px solid ' + (solid ? color : styles.borderGlass),
  color: solid ? '#fff' : color, fontFamily: styles.mono, fontSize: '10px',
  fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
  textDecoration: 'none',
});

function VerifyPage() {
  const [mode, setMode] = useState("verify");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [registryStats, setRegistryStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('conformant');
  const [browseLoaded, setBrowseLoaded] = useState(false);
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQR, setShowQR] = useState(false);

  const generateQR = async (certNum) => {
    try {
      const url = `${window.location.origin}/verify?cert=${certNum}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: '#1d1a3b', light: '#ffffff' }, errorCorrectionLevel: 'H' });
      setQrDataUrl(dataUrl);
    } catch (err) { console.error('QR generation failed:', err); }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `sentinel-${certNumber}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cert = params.get('cert');
    if (cert) { setCertNumber(cert.toUpperCase()); setTimeout(() => doVerify(cert.toUpperCase()), 300); }
  }, []);

  const doVerify = async (num) => {
    const cn = num || certNumber;
    if (!cn.trim()) return;
    setError(''); setResult(null); setEvidence(null); setShowEvidence(false); setLoading(true);
    try {
      const res = await api.get(`/api/verify/${cn}`);
      setResult(res.data);
      generateQR(cn);
      const url = new URL(window.location);
      url.searchParams.set('cert', cn);
      window.history.replaceState({}, '', url);
    } catch { setError('Certificate not found'); }
    setLoading(false);
  };

  const fetchEvidence = async () => {
    if (evidence) { setShowEvidence(!showEvidence); return; }
    try {
      const res = await api.get(`/api/verify/${certNumber}/evidence`);
      setEvidence(res.data); setShowEvidence(true);
    } catch { console.error('Evidence fetch failed'); }
  };

  const copyVerificationUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/verify?cert=${certNumber}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (mode === 'search' && !browseLoaded) {
      api.get('/api/registry/stats').then(res => setRegistryStats(res.data)).catch(console.error);
      api.get('/api/registry/search?status=conformant').then(res => { setSearchResults(res.data.results || []); setBrowseLoaded(true); }).catch(console.error);
    }
  }, [mode]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setError(""); setSearchResults([]); setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/api/registry/search?${params.toString()}`);
      setSearchResults(res.data.results || []);
      if (!res.data.results?.length) setError("No certificates found");
    } catch { setError("Unable to connect to registry"); }
    setLoading(false);
  };

  const statusCfg = (s) => {
    const map = {
      CONFORMANT: { color: styles.accentGreen, label: 'Valid Certificate' },
      SUSPENDED: { color: styles.accentAmber, label: 'Suspended' },
      REVOKED: { color: styles.accentRed, label: 'Revoked' },
      EXPIRED: { color: styles.accentRed, label: 'Expired' },
      PENDING: { color: styles.accentAmber, label: 'Pending — Awaiting CAT-72' },
      TESTING: { color: styles.accentAmber, label: 'Testing In Progress' },
    };
    return map[s] || { color: styles.textTertiary, label: s || 'Unknown' };
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <SectionHeader label="Registry" title="Certificate Verification" description="Verify ODDC conformance certificates and search the public registry." />

      {/* Search bar — same as CertificatesPage */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
          <form onSubmit={e => { e.preventDefault(); doVerify(); }} style={{ display: 'contents' }}>
            <input
              type="text" placeholder="Enter certificate number (ODDC-2026-00001)..."
              value={certNumber}
              onChange={e => { setCertNumber(e.target.value.toUpperCase()); setError(''); setResult(null); }}
              style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }}
            />
          </form>
        </div>
        <button onClick={() => doVerify()} disabled={loading || !certNumber.trim()} style={{ ...BTN(styles.accentGreen, true), padding: '10px 20px', opacity: loading || !certNumber.trim() ? 0.5 : 1 }}>
          {loading ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</> : <><Search size={12} /> Verify</>}
        </button>
      </div>

      {/* Tabs — same pattern as CertificatesPage */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid ' + styles.borderSubtle, marginBottom: '16px' }}>
        {[{key: 'verify', label: 'Verify Certificate'}, {key: 'search', label: 'Search Registry'}].map(tab => (
          <button key={tab.key} onClick={() => setMode(tab.key)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: mode === tab.key ? styles.purpleBright : styles.textTertiary,
            borderBottom: mode === tab.key ? '2px solid ' + styles.purpleBright : '2px solid transparent',
            transition: 'color 0.2s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '16px 20px', background: styles.cardSurface, border: '1px solid ' + styles.accentRed + '40', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={14} style={{ color: styles.accentRed }} />
          <span style={{ color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>{error}</span>
        </div>
      )}

      {/* Search Mode — registry browse */}
      {mode === 'search' && (
        <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, overflow: 'auto' }}>
          {registryStats && (
            <div style={{ display: 'flex', gap: '32px', padding: '20px 24px', borderBottom: '1px solid ' + styles.borderSubtle }}>
              {[{ l: 'Active Certificates', v: registryStats.active_certificates, c: styles.accentGreen }, { l: 'Organizations', v: registryStats.certified_organizations, c: styles.textPrimary }, { l: 'Issued (30d)', v: registryStats.issued_last_30_days, c: styles.accentAmber }].map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: styles.mono, fontSize: '20px', fontWeight: 500, color: s.c }}>{s.v}</div>
                  <div style={{ ...LABEL, marginTop: '2px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid ' + styles.borderSubtle }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
                <input type="text" placeholder="Search by organization or system name..." value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setError(''); }}
                  style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid ' + styles.borderGlass, background: styles.bgDeep, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }}
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ background: styles.bgDeep, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '10px', padding: '10px 12px', letterSpacing: '1px', textTransform: 'uppercase', outline: 'none' }}>
                <option value="conformant">Conformant</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
              <button type="submit" disabled={loading} style={{ ...BTN(styles.textPrimary), padding: '10px 16px' }}>Search</button>
            </form>
          </div>
          {searchResults.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Certificate</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>System</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Organization</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(cert => (
                  <tr key={cert.certificate_number} style={{ borderBottom: '1px solid ' + styles.borderSubtle, cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => { setCertNumber(cert.certificate_number); setMode('verify'); setTimeout(() => doVerify(cert.certificate_number), 100); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px', fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright }}>{cert.certificate_number}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: styles.textPrimary, fontSize: '13px' }}>{cert.system_name}</td>
                    <td style={{ padding: '12px 16px', color: styles.textSecondary, fontSize: '13px' }}>{cert.organization_name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: styles.mono, fontSize: '10px', textTransform: 'uppercase', color: styles.accentGreen }}>{cert.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {searchResults.length === 0 && browseLoaded && !error && (
            <div style={{ padding: '40px', textAlign: 'center', color: styles.textTertiary, fontSize: '14px' }}>No results</div>
          )}
        </div>
      )}

      {/* Verify Result */}
      {mode === 'verify' && result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (() => {
        const status = (result.status || '').toUpperCase();
        const cfg = statusCfg(status);
        const isValid = result.valid;
        return (
          <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, overflow: 'auto' }}>
            {/* Status header row */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + styles.borderSubtle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isValid ? <CheckCircle size={16} style={{ color: cfg.color }} /> : <AlertTriangle size={16} style={{ color: cfg.color }} />}
                <span style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: cfg.color }}>{cfg.label}</span>
              </div>
              <span style={{ fontFamily: styles.mono, fontSize: '9px', padding: '3px 10px', border: '1px solid ' + cfg.color + '40', color: cfg.color, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color }} /> {status}
              </span>
            </div>
            {(() => {
              const msg = {
                CONFORMANT: 'Certificate is valid and active',
                PENDING: 'Application approved — awaiting CAT-72 conformance testing',
                TESTING: 'CAT-72 conformance test in progress',
                SUSPENDED: 'Certificate has been suspended',
                REVOKED: 'Certificate has been permanently revoked',
                EXPIRED: 'Certificate has expired',
              }[status] || result.message;
              return msg ? (
                <div style={{ padding: '10px 20px', borderBottom: '1px solid ' + styles.borderSubtle }}>
                  <p style={{ margin: 0, color: cfg.color, fontSize: '12px' }}>{msg}</p>
                </div>
              ) : null;
            })()}
            {/* Detail table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Certificate', result.certificate_number, { color: cfg.color, fontFamily: styles.mono }],
                  ['Organization', result.organization_name || '-'],
                  ['System', (result.system_name || '-') + (result.system_version ? ' v' + result.system_version : '')],
                  ['Issued', result.issued_at ? new Date(result.issued_at).toISOString().substring(0, 10) + ' UTC' : 'N/A'],
                  ['Expires', result.expires_at ? new Date(result.expires_at).toISOString().substring(0, 10) + ' UTC' : 'N/A', status === 'EXPIRED' ? { color: styles.accentRed } : {}],
                ].map(([label, value, extra]) => (
                  <tr key={label} style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                    <td style={{ padding: '12px 20px', ...LABEL, width: '180px' }}>{label}</td>
                    <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: 500, color: styles.textPrimary, ...extra }}>{value}</td>
                  </tr>
                ))}
                {result.convergence_score != null && (
                  <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                    <td style={{ padding: '12px 20px', ...LABEL }}>Conformance Score</td>
                    <td style={{ padding: '12px 20px', fontFamily: styles.mono, fontSize: '14px', color: result.convergence_score >= 0.95 ? styles.accentGreen : styles.accentAmber }}>{(result.convergence_score * 100).toFixed(1)}%</td>
                  </tr>
                )}
                {result.evidence_hash && (
                  <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                    <td style={{ padding: '12px 20px', ...LABEL }}>Evidence Hash</td>
                    <td style={{ padding: '12px 20px', fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, wordBreak: 'break-all' }}>{result.evidence_hash}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Actions bar */}
            <div style={{ padding: '14px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid ' + styles.borderSubtle }}>
              <button onClick={copyVerificationUrl} style={BTN(styles.textSecondary)}>{copied ? '\u2713 Copied' : '\u2398 Share Link'}</button>
              <button onClick={() => setShowQR(!showQR)} style={BTN(showQR ? styles.textPrimary : styles.textSecondary)}>{showQR ? '\u25BE Hide QR' : '\u25F1 QR Code'}</button>
              {isValid && <a href={`${API_BASE}/api/v1/certificates/${certNumber}/pdf`} target="_blank" rel="noreferrer noopener" style={BTN(styles.accentGreen)}><Download size={11} /> PDF</a>}
              {isValid && <button onClick={fetchEvidence} style={BTN(styles.textSecondary)}>{showEvidence ? '\u25BE Hide Evidence' : '\u25B8 Evidence'}</button>}
            </div>
            {/* QR */}
            {showQR && qrDataUrl && (
              <div style={{ padding: '20px', borderTop: '1px solid ' + styles.borderSubtle, textAlign: 'center' }}>
                <div style={{ ...LABEL, marginBottom: '12px' }}>Verification QR Code</div>
                <div style={{ display: 'inline-block', padding: '12px', background: '#fff', border: '1px solid ' + styles.borderSubtle }}>
                  <img src={qrDataUrl} alt="QR" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <button onClick={downloadQR} style={BTN(styles.textSecondary)}><Download size={11} /> Download PNG</button>
                </div>
              </div>
            )}
            {/* Evidence */}
            {showEvidence && evidence && (
              <div style={{ borderTop: '1px solid ' + styles.borderSubtle }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + styles.borderSubtle }}>
                  <span style={{ ...LABEL }}>Evidence Chain</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                      <td style={{ padding: '12px 20px', ...LABEL, width: '180px' }}>SHA-256</td>
                      <td style={{ padding: '12px 20px', fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, wordBreak: 'break-all' }}>{evidence.evidence_hash || '-'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                      <td style={{ padding: '12px 20px', ...LABEL }}>Score</td>
                      <td style={{ padding: '12px 20px', fontFamily: styles.mono, fontSize: '14px', color: styles.accentGreen }}>{evidence.convergence_score ? (evidence.convergence_score * 100).toFixed(2) + '%' : '-'}</td>
                    </tr>
                    {evidence.odd_scope?.environment_type && (
                      <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle }}>
                        <td style={{ padding: '12px 20px', ...LABEL }}>ODD Environment</td>
                        <td style={{ padding: '12px 20px', fontSize: '14px', color: styles.textPrimary }}>{evidence.odd_scope.environment_type}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {evidence.verification_instructions && (
                  <div style={{ padding: '16px 20px', fontSize: '11px', color: styles.textTertiary, lineHeight: '1.6', whiteSpace: 'pre-line' }}>{evidence.verification_instructions}</div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {mode === 'verify' && result && (result.status === 'NOT_FOUND' || result.state === 'NOT_FOUND') && (
        <div style={{ padding: '40px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, textAlign: 'center' }}>
          <AlertTriangle size={16} style={{ color: styles.accentRed, marginBottom: '8px' }} />
          <p style={{ color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Certificate Not Found</p>
          <p style={{ color: styles.textSecondary, fontSize: '13px' }}>No certificate with number: <strong>{result.certificate_number}</strong></p>
        </div>
      )}

      {mode === 'verify' && !result && !error && !loading && (
        <div style={{ padding: '60px 20px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, textAlign: 'center' }}>
          <Search size={24} style={{ color: styles.textDim, marginBottom: '12px' }} />
          <p style={{ color: styles.textTertiary, fontSize: '14px', margin: 0 }}>Enter a certificate number above to verify</p>
          <p style={{ color: styles.textDim, fontFamily: styles.mono, fontSize: '11px', marginTop: '4px' }}>e.g. ODDC-2025-00001</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default VerifyPage;
