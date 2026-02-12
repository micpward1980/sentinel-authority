import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, CheckCircle, AlertTriangle, Search, Download, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { api, API_BASE } from '../config/api';

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

  const mono = "Consolas, 'IBM Plex Mono', monospace";
  const serif = "Georgia, 'Source Serif 4', serif";
  const tp = 'rgba(255,255,255,.94)';
  const ts = 'rgba(255,255,255,.78)';
  const tt = 'rgba(255,255,255,.50)';
  const purple = '#a896d6';
  const green = '#5CD685';
  const amber = '#D6A05C';
  const red = '#D65C5C';

  const generateQR = async (certNum) => {
    try {
      const url = window.location.origin + '/verify?cert=' + certNum;
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: '#5B4B8A', light: '#ffffff' }, errorCorrectionLevel: 'H' });
      setQrDataUrl(dataUrl);
    } catch (err) { console.error('QR generation failed:', err); }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'sentinel-' + certNumber + '-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cert = params.get('cert');
    if (cert) {
      setCertNumber(cert.toUpperCase());
      setTimeout(() => { doVerify(cert.toUpperCase()); }, 300);
    }
  }, []);

  const doVerify = async (num) => {
    const cn = num || certNumber;
    if (!cn.trim()) return;
    setError(''); setResult(null); setEvidence(null); setShowEvidence(false); setLoading(true);
    try {
      const res = await api.get('/api/verify/' + cn);
      setResult(res.data);
      generateQR(cn);
      const url = new URL(window.location);
      url.searchParams.set('cert', cn);
      window.history.replaceState({}, '', url);
    } catch (err) { setError('Certificate not found'); }
    setLoading(false);
  };

  const fetchEvidence = async () => {
    if (evidence) { setShowEvidence(!showEvidence); return; }
    try {
      const res = await api.get('/api/verify/' + certNumber + '/evidence');
      setEvidence(res.data);
      setShowEvidence(true);
    } catch (err) { console.error('Evidence fetch failed'); }
  };

  const copyVerificationUrl = () => {
    const url = window.location.origin + '/verify?cert=' + certNumber;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e) => { e.preventDefault(); await doVerify(); };

  React.useEffect(() => {
    if (mode === 'search' && !browseLoaded) {
      api.get('/api/registry/stats').then(res => setRegistryStats(res.data)).catch(console.error);
      api.get('/api/registry/search?status=conformant').then(res => {
        setSearchResults(res.data.results || []);
        setBrowseLoaded(true);
      }).catch(console.error);
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
      const res = await api.get('/api/registry/search?' + params.toString());
      setSearchResults(res.data.results || []);
      if (!res.data.results || res.data.results.length === 0) setError("No certificates found");
    } catch (err) { setError("Unable to connect to registry"); }
    setLoading(false);
  };

  const KV = ({ label, value, valueColor, isMono }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
      <span style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt }}>{label}</span>
      <span style={{ color: valueColor || tp, fontSize: '13px', fontFamily: isMono ? mono : 'inherit' }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px',
      background: 'radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,.10), transparent 55%), radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,.04), transparent 55%), #2a2f3d',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)',
        backgroundSize: '120px 120px', opacity: .25,
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.2) 85%, rgba(0,0,0,.4) 100%)',
      }} />

      <Link to="/dashboard" style={{
        position: 'fixed', top: '24px', right: '32px', zIndex: 20,
        color: tt, fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
      }}><Home size={12} /> Dashboard</Link>

      <div style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: '24px', height: '24px', background: '#5B4B8A', border: '2px solid #9d8ccf', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', background: '#c4b8e8', borderRadius: '50%' }} />
          </div>
        </div>

        <h1 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 8px', color: tp, textAlign: 'center' }}>
          Certificate <span style={{ color: purple, fontStyle: 'italic' }}>Verification</span>
        </h1>
        <p style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, textAlign: 'center', marginTop: '12px' }}>Sentinel Authority &bull; ODDC Registry</p>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', margin: '32px 0' }} />

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <RefreshCw size={16} style={{ color: purple, animation: 'spin 1s linear infinite' }} />
            <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginTop: '12px' }}>Verifying certificate...</div>
          </div>
        )}

        

        {error && (
          <div style={{ marginTop: '24px', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              <AlertTriangle size={14} style={{ color: red }} />
              <span style={{ color: red, fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>Not Found</span>
            </div>
            <p style={{ color: ts, fontSize: '13px' }}>{error}</p>
          </div>
        )}

        {result && (result.status === 'NOT_FOUND' || result.state === 'NOT_FOUND') && (
          <div style={{ marginTop: '24px', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              <AlertTriangle size={14} style={{ color: red }} />
              <span style={{ color: red, fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>Certificate Not Found</span>
            </div>
            <p style={{ color: ts, fontSize: '13px' }}>No certificate exists with number: <strong>{result.certificate_number}</strong></p>
          </div>
        )}

        {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (() => {
          const isValid = result.valid;
          const status = (result.status || '').toUpperCase();
          const cfg = {
            CONFORMANT: { color: green, label: 'CONFORMANT', icon: 'Valid Certificate' },
            SUSPENDED:  { color: amber, label: 'SUSPENDED',  icon: 'Suspended' },
            REVOKED:    { color: red,   label: 'REVOKED',    icon: 'Revoked' },
            EXPIRED:    { color: red,   label: 'EXPIRED',    icon: 'Expired' },
          }[status] || { color: green, label: 'CONFORMANT', icon: 'Valid Certificate' };

          return (
            <div style={{ marginTop: '32px' }}>
              <div style={{ padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isValid ? <CheckCircle size={14} style={{ color: cfg.color }} /> : <AlertTriangle size={14} style={{ color: cfg.color }} />}
                  <span style={{ color: cfg.color, fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>{cfg.icon}</span>
                </div>
                <span className={'badge ' + (status === 'CONFORMANT' ? 'green' : status === 'SUSPENDED' ? 'amber' : 'red')}>
                  <span className="s-dot" style={{ background: cfg.color }} />
                  {cfg.label}
                </span>
              </div>

              {result.message && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <p style={{ color: cfg.color, fontSize: '12px', margin: 0 }}>{result.message}</p>
                </div>
              )}

              <div style={{ padding: '8px 0' }}>
                <KV label="Certificate" value={result.certificate_number} valueColor={cfg.color} isMono />
                <KV label="Organization" value={result.organization_name || '-'} />
                <KV label="System" value={(result.system_name || '-') + (result.system_version ? ' v' + result.system_version : '')} />
                <KV label="Issued" value={result.issued_at ? new Date(result.issued_at).toLocaleDateString() : 'N/A'} />
                <KV label="Expires" value={result.expires_at ? new Date(result.expires_at).toLocaleDateString() : 'N/A'} valueColor={status === 'EXPIRED' ? red : tp} />
                {result.convergence_score != null && (
                  <KV label="Conformance" value={(result.convergence_score * 100).toFixed(1) + '%'} valueColor={result.convergence_score >= 0.95 ? green : amber} isMono />
                )}
                {result.evidence_hash && (
                  <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '6px' }}>Evidence Hash</div>
                    <div style={{ fontFamily: mono, fontSize: '10px', color: tt, wordBreak: 'break-all', lineHeight: 1.5 }}>{result.evidence_hash}</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button onClick={copyVerificationUrl} className="btn">{copied ? '\u2713 Copied' : '\u2398 Share Link'}</button>
                <button onClick={() => setShowQR(!showQR)} className="btn" style={showQR ? { borderColor: 'rgba(157,140,207,.4)', color: purple } : {}}>{showQR ? '\u25BE Hide QR' : '\u25F1 QR Code'}</button>
                {isValid && (
                  <a href={API_BASE + '/api/certificates/' + certNumber + '/pdf'} target="_blank" rel="noopener noreferrer" className="btn"><Download size={10} /> PDF</a>
                )}
                {isValid && (
                  <button onClick={fetchEvidence} className="btn">{showEvidence ? '\u25BE Hide Evidence' : '\u25B8 Evidence'}</button>
                )}
              </div>

              {showQR && qrDataUrl && (
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '16px' }}>Verification QR Code</div>
                  <div style={{ display: 'inline-block', padding: '12px', background: '#fff' }}>
                    <img src={qrDataUrl} alt="QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <button onClick={downloadQR} className="btn"><Download size={10} /> Download PNG</button>
                  </div>
                  <p style={{ fontSize: '10px', color: tt, marginTop: '10px', fontFamily: mono, letterSpacing: '1px' }}>Scan to verify {certNumber}</p>
                </div>
              )}

              {showEvidence && evidence && (
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '16px' }}>Evidence Chain</div>
                  <KV label="Hash (SHA-256)" value={evidence.evidence_hash || '-'} valueColor={purple} isMono />
                  <KV label="Conformance" value={evidence.convergence_score ? (evidence.convergence_score * 100).toFixed(2) + '%' : '-'} valueColor={green} isMono />
                  {evidence.odd_scope && evidence.odd_scope.environment_type && (
                    <KV label="ODD Environment" value={evidence.odd_scope.environment_type} />
                  )}
                  {evidence.verification_instructions && (
                    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <p style={{ fontSize: '11px', color: tt, lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>{evidence.verification_instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}

export default VerifyPage;
