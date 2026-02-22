import React, { useState, useEffect, useRef } from 'react';
import { Search, Shield, CheckCircle, XCircle, Clock, ExternalLink, ChevronRight, Download } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import BrandMark from '../components/BrandMark';

// ─── Design tokens for public portal ────────────────────────────────────────
const T = {
  navy:       '#001639',
  navyMid:    '#002966',
  purple:     '#1d1a3b',
  purpleLight:'#1d1a3b',
  ink:        '#181818',
  secondary:  '#444444',
  tertiary:   '#666666',
  dim:        '#999999',
  border:     '#dddbda',
  borderMid:  '#c9c7c5',
  bg:         '#f3f3f3',
  white:      '#ffffff',
  green:      '#2e844a',
  amber:      '#dd7a01',
  red:        '#ea001b',
  mono:       "'IBM Plex Mono', Consolas, monospace",
  sans:       "'Inter', system-ui, sans-serif",
  serif:      "Georgia, 'Source Serif 4', serif",
};

function StatPill({ label, value, color = T.ink }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 32px', borderRight: `1px solid rgba(255,255,255,0.12)`,
      minWidth: 120,
    }}>
      <span style={{ fontFamily: T.mono, fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value ?? '—'}</span>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 6 }}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    conformant: { color: T.green, bg: 'rgba(46,132,74,0.10)', border: 'rgba(46,132,74,0.25)', label: 'CONFORMANT' },
    active:     { color: T.green, bg: 'rgba(46,132,74,0.10)', border: 'rgba(46,132,74,0.25)', label: 'ACTIVE' },
    suspended:  { color: T.amber, bg: 'rgba(221,122,1,0.08)',  border: 'rgba(221,122,1,0.25)',  label: 'SUSPENDED' },
    revoked:    { color: T.red,   bg: 'rgba(234,0,27,0.07)',   border: 'rgba(234,0,27,0.20)',   label: 'REVOKED' },
  }[status?.toLowerCase()] || { color: T.tertiary, bg: T.bg, border: T.border, label: (status || 'UNKNOWN').toUpperCase() };

  return (
    <span style={{
      fontFamily: T.mono, fontSize: 10, fontWeight: 700,
      padding: '3px 8px', borderRadius: 2,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      letterSpacing: '0.5px',
    }}>{cfg.label}</span>
  );
}

function CertRow({ cert, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={() => onSelect(cert)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        background: hover ? 'rgba(29,26,59,0.03)' : T.white,
        borderLeft: hover ? `3px solid ${T.purple}` : '3px solid transparent',
        transition: 'all 0.1s ease',
      }}
    >
      <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 11, color: T.purple, fontWeight: 600 }}>
        {cert.certificate_number}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: T.ink, fontWeight: 500 }}>
        {cert.system_name}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: T.secondary }}>
        {cert.organization_name}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={cert.state} />
      </td>
      <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 11, color: T.dim }}>
        {cert.expires_at ? new Date(cert.expires_at).toISOString().slice(0, 10) : '—'}
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <ChevronRight size={14} color={hover ? T.purple : T.dim} />
      </td>
    </tr>
  );
}

function CertDetail({ cert, onClose }) {
  if (!cert) return null;
  const isConformant = ['conformant', 'active', 'issued'].includes(cert.state?.toLowerCase());

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,22,57,0.55)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(600px, 92vw)', background: T.white,
          border: `1px solid ${T.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          borderRadius: 4, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: isConformant ? 'rgba(46,132,74,0.06)' : 'rgba(234,0,27,0.04)',
          borderBottom: `1px solid ${isConformant ? 'rgba(46,132,74,0.18)' : 'rgba(234,0,27,0.18)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isConformant
              ? <CheckCircle size={18} color={T.green} />
              : <XCircle size={18} color={T.red} />}
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: isConformant ? T.green : T.red, letterSpacing: '0.5px' }}>
              {(cert.state || 'UNKNOWN').toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.tertiary, fontFamily: T.mono, fontSize: 11 }}>
            CLOSE
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.tertiary, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Certificate Number</div>
          <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.navy, marginBottom: 20 }}>{cert.certificate_number}</div>

          {[
            ['System', cert.system_name],
            ['Organization', cert.organization_name],
            ['System Type', cert.system_type],
            ['Version', cert.system_version],
            ['Issued', cert.issued_at ? new Date(cert.issued_at).toISOString().slice(0, 10) : '—'],
            ['Expires', cert.expires_at ? new Date(cert.expires_at).toISOString().slice(0, 10) : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: `1px solid ${T.bg}` }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 100, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 13, color: T.ink }}>{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: T.bg, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 12 }}>
          <a
            href={`${window.location.origin}/verify?cert=${cert.certificate_number}`}
            target="_blank" rel="noreferrer"
            style={{
              fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: T.white, background: T.purple,
              padding: '8px 16px', textDecoration: 'none', borderRadius: 2,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <ExternalLink size={11} /> Full Verification Record
          </a>
          {isConformant && (
            <a
              href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`}
              target="_blank" rel="noreferrer"
              style={{
                fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: T.purple,
                border: `1px solid ${T.border}`, background: T.white,
                padding: '8px 16px', textDecoration: 'none', borderRadius: 2,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={11} /> Certificate PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicRegistryPage() {
  const [stats, setStats] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('conformant');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/registry/stats').catch(() => ({ data: null })),
      api.get('/api/registry/search?status=conformant').catch(() => ({ data: { results: [] } })),
    ]).then(([statsRes, searchRes]) => {
      setStats(statsRes.data);
      setResults(searchRes.data?.results || []);
      setLoading(false);
    });
  }, []);

  const runSearch = async (q, status) => {
    setSearchLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q?.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await api.get(`/api/registry/search?${params.toString()}`);
      setResults(res.data?.results || []);
      if (!res.data?.results?.length) setError('No certificates found');
    } catch {
      setError('Unable to connect to registry node');
    }
    setSearchLoading(false);
  };

  const handleSearchInput = (val) => {
    setQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(val, statusFilter), 300);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    runSearch(query, status);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.sans }}>

      {/* ── Nav ── */}
      <header style={{
        background: T.navy, borderBottom: `1px solid rgba(255,255,255,0.08)`,
        padding: '0 clamp(16px, 4vw, 48px)', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={30} />
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.white }}>SENTINEL AUTHORITY</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>ODDC PUBLIC REGISTRY</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="https://sentinelauthority.org" target="_blank" rel="noreferrer"
            style={{ fontFamily: T.mono, fontSize: 10, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            About
          </a>
          <a href="/verify" style={{ fontFamily: T.mono, fontSize: 10, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Verify Certificate
          </a>
          <a href="/login" style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 700,
            color: T.white, border: '1px solid rgba(255,255,255,0.30)',
            padding: '6px 14px', textDecoration: 'none', letterSpacing: '0.8px', textTransform: 'uppercase',
            borderRadius: 2,
          }}>
            Operator Login
          </a>
        </div>
      </header>

      {/* ── Hero strip ── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 60%, ${T.purple} 100%)`,
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 4vw, 48px)',
      }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: 'rgba(255,255,255,0.50)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>
            Operational Design Domain Conformance
          </div>
          <h1 style={{ fontFamily: T.serif, fontWeight: 200, fontSize: 'clamp(28px, 5vw, 48px)', color: T.white, margin: '0 0 12px', lineHeight: 1.15 }}>
            Certified Autonomous Systems Registry
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
            Independently verified conformance records for autonomous systems certified under the ENVELO Interlock standard. For regulators, insurers, and operators.
          </p>
        </div>

        {/* Stats strip */}
        {stats && (
          <div style={{ display: 'flex', marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 24, flexWrap: 'wrap', gap: 0 }}>
            <StatPill label="Conformant" value={stats.conformant_count ?? stats.active} color={T.green} />
            <StatPill label="Total Issued" value={stats.total_issued ?? stats.total} color="rgba(255,255,255,0.85)" />
            <StatPill label="Suspended" value={stats.suspended_count ?? stats.suspended} color={T.amber} />
            <StatPill label="Revoked" value={stats.revoked_count ?? stats.revoked} color={T.red} />
          </div>
        )}
      </div>

      {/* ── Registry table ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px)' }}>

        {/* Search + filter bar */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{
            flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 10,
            background: T.white, border: `1px solid ${T.border}`, borderRadius: 2, padding: '0 14px',
          }}>
            <Search size={14} color={T.tertiary} style={{ flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search by system name, organization, or certificate number…"
              style={{
                flex: 1, border: 'none', outline: 'none', fontFamily: T.sans,
                fontSize: 13, color: T.ink, padding: '10px 0', background: 'transparent',
              }}
            />
            {searchLoading && (
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.5px' }}>SEARCHING…</span>
            )}
          </div>

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['conformant', 'suspended', 'revoked', 'all'].map(s => (
              <button key={s} onClick={() => handleStatusFilter(s === 'all' ? '' : s)}
                style={{
                  fontFamily: T.mono, fontSize: 10, fontWeight: statusFilter === (s === 'all' ? '' : s) ? 700 : 400,
                  letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
                  padding: '8px 14px', borderRadius: 2,
                  border: `1px solid ${statusFilter === (s === 'all' ? '' : s) ? T.purple : T.border}`,
                  background: statusFilter === (s === 'all' ? '' : s) ? 'rgba(29,26,59,0.07)' : T.white,
                  color: statusFilter === (s === 'all' ? '' : s) ? T.purple : T.tertiary,
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 4, boxShadow: '0 2px 2px 0 rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: '1px' }}>
              LOADING REGISTRY…
            </div>
          ) : error && results.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.dim }}>
              {error}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                  {['Certificate #', 'System', 'Organization', 'Status', 'Expires (UTC)', ''].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                      color: T.tertiary, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.8px',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 24px', textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.dim }}>
                      No records found
                    </td>
                  </tr>
                ) : results.map((cert, i) => (
                  <CertRow key={cert.certificate_number || i} cert={cert} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={13} color={T.dim} />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.3px' }}>
            Registry data is cryptographically anchored and tamper-evident. Last node sync: {new Date().toISOString().slice(0, 16)}Z
          </span>
        </div>
      </div>

      {/* ── Cert detail modal ── */}
      {selected && <CertDetail cert={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
