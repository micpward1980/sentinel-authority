import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, CheckCircle, AlertTriangle, Search, Download, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import Panel from '../components/Panel';

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
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: styles.purplePrimary, light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
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
      const res = await api.get(`/api/verify/${cn}`);
      setResult(res.data);
      generateQR(cn);
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
      const res = await api.get(`/api/verify/${certNumber}/evidence`);
      setEvidence(res.data);
      setShowEvidence(true);
    } catch (err) {
      console.error('Evidence fetch failed');
    }
  };

  const copyVerificationUrl = () => {
    const url = `${window.location.origin}/verify?cert=${certNumber}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    await doVerify();
  };

  // Load registry stats + browse all on search tab
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
    setError("");
    setSearchResults([]);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/api/registry/search?${params.toString()}`);
      setSearchResults(res.data.results || []); if (!res.data.results || res.data.results.length === 0) setError("No certificates found for that search");
    } catch (err) {
      setError("Unable to connect to registry");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: styles.bgDeep}}>
      <Link to="/dashboard" style={{
        position: 'fixed', top: '24px', right: '32px', zIndex: 20,
        color: styles.textTertiary, fontFamily: styles.mono,
        fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
        transition: 'color 0.2s'
      }}><Home fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-3.5 h-3.5" /> Dashboard</Link>
      {/* Animated background gradients */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(29,26,59,0.18) 0%, transparent 65%)',
        animation: 'float1 25s ease-in-out infinite', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-15%', width: '800px', height: '800px',
        background: 'radial-gradient(circle, rgba(22,135,62,0.06) 0%, transparent 65%)',
        animation: 'float2 30s ease-in-out infinite', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '10%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(29,26,59,0.10) 0%, transparent 65%)',
        animation: 'float3 15s ease-in-out infinite', pointerEvents: 'none'
      }} />
      
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'none',
        backgroundSize: '120px 120px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)'
      }} />

      {/* Decorative elements */}
      <div style={{ position: 'absolute', top: '15%', left: '8%', width: '1px', height: '150px',
        background: 'transparent'
      }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '5%', width: '100px', height: '1px',
        background: 'transparent'
      }} />

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -30px) scale(1.05); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, -40px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 30px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 0; } 100% { transform: scale(0.9); opacity: 0.6; } }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .verify-input { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .verify-input:focus { border-color: rgba(29,26,59,0.6) !important; box-shadow: 0 0 0 3px rgba(29,26,59,0.1), 0 4px 20px transparent; transform: translateY(-1px); }
        .verify-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .verify-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(29,26,59,0.15); }
        .verify-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      `}</style>

      <div className="w-full max-w-lg relative z-10">
        {/* Brand section */}
        <div className="text-center mb-10">
          <div className="relative flex justify-center mb-6" style={{height: '100px', alignItems: 'center'}}>
            <div style={{
              position: 'absolute', width: '80px', height: '80px',
              border: '1px solid ' + styles.borderSubtle, borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite'
            }} />
            <div style={{
              position: 'absolute', width: '100px', height: '100px',
              border: '1px solid ' + styles.borderSubtle, borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite 0.5s'
            }} />
            <div style={{
              width: '56px', height: '56px',
              background: 'transparent',
              border: '2px solid #1d1a3b', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
              <div style={{
                width: '18px', height: '18px',
                background: 'radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%)',
                borderRadius: '50%' }} />
            </div>
          </div>
          
          <h1 style={{
            fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200,
            color: styles.textPrimary, margin: '0 0 8px 0', letterSpacing: '-0.02em'
          }}>
            Certificate <span style={{color: styles.purpleBright, fontStyle: 'italic'}}>Verification</span>
          </h1>
          
          <p style={{
            color: styles.textTertiary, fontFamily: styles.mono,
            fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '16px'
          }}>Sentinel Authority • ODDC Registry</p>

        {/* Mode Tabs */}
        <div style={{display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px"}}>
          <button onClick={() => setMode("verify")} style={{
            padding: "10px 24px", border: "none", cursor: "pointer",
            fontFamily: styles.mono, fontSize: "11px", letterSpacing: "1px",
            background: mode === "verify" ? styles.purplePrimary : 'rgba(0,0,0,0.025)',
            color: mode === "verify" ? "#fff" : styles.textTertiary,
            transition: "all 0.2s"
          }}>Verify Certificate</button>
          <button onClick={() => setMode("search")} style={{
            padding: "10px 24px", border: "none", cursor: "pointer",
            fontFamily: styles.mono, fontSize: "11px", letterSpacing: "1px",
            background: mode === "search" ? styles.purplePrimary : 'rgba(0,0,0,0.025)',
            color: mode === "search" ? "#fff" : styles.textTertiary,
            transition: "all 0.2s"
          }}>Search Registry</button>
        </div>
        </div>
        
        {/* Verification card */}
        <div style={{
          background: styles.cardSurface, backdropFilter: styles.frostModal,
          border: '1px solid ' + styles.borderSubtle, padding: 'clamp(16px, 4vw, 40px)',
          transition: 'all 0.3s ease', minHeight: '280px'
        , borderRadius: 4}}>
{mode === "verify" && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label style={{
                display: 'block', marginBottom: '10px', color: styles.textTertiary,
                fontFamily: styles.mono, fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center'
              }}>Certificate Number</label>
              <input
                type="text"
                placeholder="ODDC-2026-00001"
                value={certNumber}
                onChange={(e) => { setCertNumber(e.target.value.toUpperCase()); setError(""); setResult(null); }}
                className="verify-input w-full px-5 py-4 outline-none"
                style={{
                  background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
                  color: styles.textPrimary, fontFamily: styles.mono,
                  fontSize: '18px', textAlign: 'center', letterSpacing: '2px'
                , borderRadius: 4}}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !certNumber.trim()}
              className="verify-btn w-full py-4 font-medium"
              style={{
                background: 'transparent',
                border: '1px solid rgba(29,26,59,0.5)', color: styles.textPrimary,
                fontFamily: styles.mono, fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}>
              {loading ? (
                <><RefreshCw className="w-4 h-4" style={{animation: 'spin 1s linear infinite'}} /> Verifying...</>
              ) : (
                <><Search className="w-4 h-4" /> Verify Certificate</>
              )}
            </button>
          </form>

          )}

          {mode === "search" && (<>
          {/* Registry Stats Banner */}
          {registryStats && (
            <div style={{display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px'}}>
              {[
                {label: 'Active Certs', value: registryStats.active_certificates, color: styles.accentGreen},
                {label: 'Organizations', value: registryStats.certified_organizations, color: styles.purpleBright},
                {label: 'Last 30 Days', value: registryStats.issued_last_30_days, color: styles.accentAmber},
              ].map(s => (
                <div key={s.label} style={{textAlign: 'center'}}>
                  <div style={{fontFamily: styles.mono, fontSize: '24px', fontWeight: 500, color: s.color}}>{s.value}</div>
                  <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px'}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label style={{
                display: 'block', marginBottom: '10px', color: styles.textTertiary,
                fontFamily: styles.mono, fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center'
              }}>Organization or System Name</label>
              <input
                type="text"
                placeholder="Company name or system..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setError(""); }}
                className="verify-input w-full px-5 py-4 outline-none"
                style={{
                  background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
                  color: styles.textPrimary, fontFamily: styles.mono,
                  fontSize: '18px', textAlign: 'center', letterSpacing: '2px'
                , borderRadius: 4}}
              />
            </div>
            {/* Status Filter */}
            <div style={{display: 'flex', justifyContent: 'center'}}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
                  color: styles.textPrimary, fontFamily: styles.mono,
                  fontSize: '11px', padding: '8px 16px', outline: 'none',
                  letterSpacing: '1px', textTransform: 'uppercase'
                , borderRadius: 4}}
              >
                <option value="conformant">Conformant</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="verify-btn w-full py-4 font-medium"
              style={{
                background: 'transparent',
                border: '1px solid rgba(29,26,59,0.5)', color: styles.textPrimary,
                fontFamily: styles.mono, fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}>
              {loading ? (
                <><RefreshCw className="w-4 h-4" style={{animation: 'spin 1s linear infinite'}} /> Searching...</>
              ) : (
                <><Search className="w-4 h-4" /> Search Registry</>
              )}
            </button>
          </form>
          {searchResults.length > 0 && (
                <div style={{marginTop: "24px"}}>
                  <p style={{color: styles.textTertiary, fontSize: "12px", marginBottom: "12px", textAlign: "center"}}>
                    {searchResults.length} certificate(s) found
                  </p>
                  {searchResults.map((cert) => (
                    <div key={cert.certificate_number} onClick={() => {setCertNumber(cert.certificate_number); setMode("verify"); setTimeout(() => document.querySelector("form")?.requestSubmit(), 100);}} style={{
                      background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
                      padding: "16px", marginBottom: "8px", cursor: "pointer",
                      transition: "all 0.2s"
                    , borderRadius: 4}}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <div>
                          <div style={{color: styles.textPrimary, fontWeight: 500}}>{cert.organization_name}</div>
                          <div style={{color: styles.textTertiary, fontSize: "12px"}}>{cert.system_name}</div>
                        </div>
                        <div style={{textAlign: "right"}}>
                          <div style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: "11px"}}>{cert.certificate_number}</div>
                          <div style={{color: styles.accentGreen, fontSize: "10px", textTransform: "uppercase"}}>{cert.state}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          )}
          </>)}
          <div style={{minHeight: '80px', marginTop: '16px'}}>
          {error && (
            <div className="p-5 text-center" style={{
              background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle
            , borderRadius: 4}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px'}}>
                <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentRed}} />
                <span style={{color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Not Found</span>
              </div>
              <p style={{color: styles.textSecondary, fontSize: '14px'}}>{error}</p>
            </div>
          )}

          {result && (result.status === 'NOT_FOUND' || result.state === 'NOT_FOUND') && (
            <div className="mt-6 p-5 text-center" style={{
              background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle
            , borderRadius: 4}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px'}}>
                <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentRed}} />
                <span style={{color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Certificate Not Found</span>
              </div>
              <p style={{color: styles.textSecondary, fontSize: '14px'}}>No certificate exists with number: <strong>{result.certificate_number}</strong></p>
            </div>
          )}

          {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (() => {
            const isValid = result.valid;
            const status = (result.status || '').toUpperCase();
            const statusConfig = {
              CONFORMANT: { color: styles.accentGreen, bg: 'rgba(22,135,62,0.03)', border: 'rgba(22,135,62,0.25)', headerBg: 'rgba(22,135,62,0.06)', icon: 'Valid Certificate', label: 'CONFORMANT' },
              SUSPENDED: { color: styles.accentAmber, bg: 'rgba(221,122,1,0.03)', border: 'rgba(221,122,1,0.25)', headerBg: 'rgba(221,122,1,0.06)', icon: 'Suspended', label: 'SUSPENDED' },
              REVOKED: { color: styles.accentRed, bg: 'rgba(180,52,52,0.08)', border: 'rgba(180,52,52,0.25)', headerBg: 'rgba(180,52,52,0.06)', icon: 'Revoked', label: 'REVOKED' },
              EXPIRED: { color: styles.accentRed, bg: 'rgba(180,52,52,0.08)', border: 'rgba(180,52,52,0.25)', headerBg: 'rgba(180,52,52,0.06)', icon: 'Expired', label: 'EXPIRED' }
            };
            const cfg = statusConfig[status] || statusConfig.CONFORMANT;
            const rowStyle = {display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid ' + styles.borderSubtle};
            const labelSt = {color: styles.textTertiary, fontSize: '12px', fontFamily: styles.mono, textTransform: 'uppercase', letterSpacing: '1px'};
            const valSt = {color: styles.textPrimary, fontSize: '14px'};
            
            return (
            <div className="mt-6 overflow-hidden" style={{background: cfg.bg, border: '1px solid ' + cfg.border}}>
              {/* Status Header */}
              <div style={{padding: '16px 20px', background: cfg.headerBg, borderBottom: '1px solid ' + cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  {isValid ? <CheckCircle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: cfg.color}} /> : <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: cfg.color}} />}
                  <span style={{color: cfg.color, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500}}>{cfg.icon}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span style={{padding: '4px 12px', fontSize: '10px', background: cfg.bg, color: cfg.color, fontFamily: styles.mono, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid ' + cfg.border}}>
                    <span style={{width: '6px', height: '6px', borderRadius: '50%', background: cfg.color}}></span>
                    {cfg.label}
                  </span>
                </div>
              </div>
              
              {/* Status Message */}
              {result.message && (
                <div style={{padding: '12px 20px', background: styles.cardSurface, borderBottom: '1px solid ' + styles.borderSubtle, borderRadius: 4}}>
                  <p style={{margin: 0, color: cfg.color, fontSize: '13px'}}>{result.message}</p>
                </div>
              )}
              
              {/* Details */}
              <div style={{padding: '20px'}}>
                <div style={{display: 'grid', gap: '16px'}}>
                  <div style={rowStyle}>
                    <span style={labelSt}>Certificate</span>
                    <span style={{color: cfg.color, fontFamily: styles.mono, fontSize: '14px', fontWeight: 500}}>{result.certificate_number}</span>
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
                    <span style={valSt}>{result.issued_at ? new Date(result.issued_at).toISOString().substring(0,10) + ' UTC' : 'N/A'}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelSt}>Expires</span>
                    <span style={{...valSt, color: status === 'EXPIRED' ? styles.accentRed : styles.textPrimary}}>{result.expires_at ? new Date(result.expires_at).toISOString().substring(0,10) + ' UTC' : 'N/A'}</span>
                  </div>
                  {result.convergence_score != null && (
                    <div style={rowStyle}>
                      <span style={labelSt}>Conformance Score</span>
                      <span style={{fontFamily: styles.mono, fontSize: '14px', color: result.convergence_score >= 0.95 ? styles.accentGreen : styles.accentAmber}}>{(result.convergence_score * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {result.evidence_hash && (
                    <div style={{paddingBottom: '12px', borderBottom: '1px solid ' + styles.borderSubtle, borderRadius: 4}}>
                      <span style={labelSt}>Evidence Hash</span>
                      <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, marginTop: '6px', wordBreak: 'break-all', lineHeight: '1.5'}}>{result.evidence_hash}</div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div style={{display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap'}}>
                  <button onClick={copyVerificationUrl} style={{
                    padding: '8px 16px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass,
                    color: styles.textSecondary, cursor: 'pointer',
                    fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  , borderRadius: 4}}>
                    {copied ? '✓ Copied!' : '⎘ Share Link'}
                  </button>
                  <button onClick={() => setShowQR(!showQR)} style={{
                    padding: '8px 16px', background: showQR ? 'rgba(29,26,59,0.25)' : 'rgba(0,0,0,0.025)', border: showQR ? '1px solid rgba(29,26,59,0.4)' : '1px solid ' + styles.borderGlass,
                    color: showQR ? styles.purpleBright : styles.textSecondary, cursor: 'pointer',
                    fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  , borderRadius: 4}}>
                    {showQR ? '▾ Hide QR' : '◱ QR Code'}
                  </button>
                  {isValid && (
                    <a 
                      href={`${API_BASE}/api/certificates/${certNumber}/pdf`}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{
                        padding: '8px 16px', background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
                        color: styles.accentGreen, cursor: 'pointer',
                        fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none'
                      , borderRadius: 4}}
                    >
                      <Download size={12} /> Certificate PDF
                    </a>
                  )}
                  {isValid && (
                    <button onClick={fetchEvidence} style={{
                      padding: '8px 16px', background: 'rgba(29,26,59,0.08)', border: '1px solid rgba(29,26,59,0.3)',
                      color: styles.purpleBright, cursor: 'pointer',
                      fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      {showEvidence ? '▾ Hide Evidence' : '▸ View Evidence'}
                    </button>
                  )}
                </div>
                
                {/* QR Code Panel */}
                {showQR && qrDataUrl && (
                  <div style={{marginTop: '16px', padding: '20px', background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, textAlign: 'center', borderRadius: 4}}>
                    <div style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Verification QR Code</div>
                    <div style={{display: 'inline-block', padding: '12px', background: '#fff' }}>
                      <img src={qrDataUrl} alt="Verification QR Code" style={{width: '200px', height: '200px', display: 'block'}} />
                    </div>
                    <div style={{marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px'}}>
                      <button onClick={downloadQR} style={{
                        padding: '6px 14px', background: 'rgba(29,26,59,0.08)', border: '1px solid rgba(29,26,59,0.3)',
                        color: styles.purpleBright, cursor: 'pointer',
                        fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}>
                        <Download size={12} /> Download PNG
                      </button>
                    </div>
                    <p style={{fontSize: '11px', color: styles.textTertiary, marginTop: '12px', lineHeight: '1.5'}}>Scan to verify certificate {certNumber} on any device</p>
                  </div>
                )}

                {/* Evidence Panel */}
                {showEvidence && evidence && (
                  <div style={{marginTop: '16px', padding: '16px', background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, borderRadius: 4}}>
                    <div style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Evidence Chain</div>
                    <div style={{display: 'grid', gap: '10px'}}>
                      <div>
                        <span style={{fontSize: '11px', color: styles.textTertiary}}>Evidence Hash (SHA-256)</span>
                        <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.purpleBright, wordBreak: 'break-all', marginTop: '4px'}}>{evidence.evidence_hash || '-'}</div>
                      </div>
                      <div>
                        <span style={{fontSize: '11px', color: styles.textTertiary}}>Conformance Score</span>
                        <div style={{fontFamily: styles.mono, fontSize: '14px', color: styles.accentGreen, marginTop: '4px'}}>{evidence.convergence_score ? (evidence.convergence_score * 100).toFixed(2) + '%' : '-'}</div>
                      </div>
                      {evidence.odd_scope?.environment_type && (
                        <div>
                          <span style={{fontSize: '11px', color: styles.textTertiary}}>ODD Environment</span>
                          <div style={{fontSize: '13px', color: styles.textPrimary, marginTop: '4px'}}>{evidence.odd_scope.environment_type}</div>
                        </div>
                      )}
                      <div style={{marginTop: '8px', padding: '12px', background: 'transparent' }}>
                        <p style={{fontSize: '11px', color: styles.textTertiary, lineHeight: '1.6', whiteSpace: 'pre-line', margin: 0}}>{evidence.verification_instructions || ''}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
        </div>
        
        </div>

      </div>
    </div>
  );
}





// Web-based Agent Simulator

export default VerifyPage;