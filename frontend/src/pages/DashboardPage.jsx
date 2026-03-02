import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wifi, FileText, Activity, Award, AlertTriangle, Plus, Shield, Download, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { formatSystemType } from '../utils/formatSystemType';

/* ── Shared helpers ───────────────────────────────────────────────────────── */

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function stateColor(state) {
  switch (state) {
    case 'conformant': case 'active': case 'issued': return styles.accentGreen;
    case 'pending': case 'under_review': case 'testing': case 'approved': return styles.accentAmber;
    case 'revoked': case 'suspended': case 'rejected': return styles.accentRed;
    default: return styles.textDim;
  }
}

function isOnline(session) {
  const la = session.last_heartbeat_at || session.last_telemetry_at || session.last_activity || session.started_at;
  return session.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000;
}

function ensureArray(val) {
  if (Array.isArray(val)) return val;
  return [];
}

/* ═════════════════════════════════════════════════════════════════════════════
   Customer Dashboard
   ═════════════════════════════════════════════════════════════════════════════ */

function CustomerDashboard() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/dashboard/summary').catch(() => ({ data: null })),
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
      api.get('/api/surveillance/alerts?limit=100').catch(() => ({ data: { alerts: [] } })),
      api.get('/api/audit/my-logs?limit=5&offset=0').catch(() => ({ data: { logs: [] } }))
    ]).then(([sumRes, appsRes, monRes, actRes]) => {
      setSummary(sumRes.data);
      setApplications(appsRes.data.applications || appsRes.data || []);
      if (monRes.data) setMonitoring(monRes.data);
      setComplianceAlerts(ensureArray(alertsRes.data?.alerts || alertsRes.data));
      setRecentActivity(actRes.data.logs || actRes.data || []);
      setLoading(false);
    });
  }, []);

  const STAGES = [
    { key: 'pending', label: 'Submitted' },
    { key: 'approved', label: 'Accepted' },
    { key: 'observe', label: 'Interlock Deploy' },
    { key: 'bounded', label: 'Boundaries Review' },
    { key: 'testing', label: 'CAT-72 Testing' },
    { key: 'conformant', label: 'Conformant' },
  ];

  const stageIdx = (state) => STAGES.findIndex(s => s.key === state);

  const nextAction = (state) => {
    switch(state) {
      case 'pending': return 'Awaiting accept/reject decision';
      case 'approved': return 'Deploy your ENVELO Interlock';
      case 'observe': return 'Interlock observing — auto-discovering boundaries';
      case 'bounded': return 'Review and acknowledge your boundaries';
      case 'testing': return 'CAT-72 test in progress';
      case 'conformant': return 'Certificate issued';
      case 'suspended': return 'Non-conformant — contact support';
      default: return 'Pending';
    }
  };

  if (loading) return (
    <div className="page-enter" style={{padding: 'clamp(16px, 4vw, 40px)'}}>
      <div style={{marginBottom: 24}}>
        <div className="skeleton" style={{width: 120, height: 12, marginBottom: 12}}></div>
        <div className="skeleton" style={{width: 240, height: 32, marginBottom: 8}}></div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32}}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{height: 80, borderRadius: 4}}></div>)}
      </div>
      <div className="skeleton" style={{height: 280, borderRadius: 4}}></div>
    </div>
  );

  const hasApps = applications.length > 0;
  const certTotal = summary?.certificates?.total || 0;
  const certActive = summary?.certificates?.active || 0;
  const hasCerts = certTotal > 0;
  const sessions = monitoring?.sessions || [];
  const conformantCount = certActive;
  const totalCerts = certTotal;
  const onlineCount = sessions.filter(isOnline).length;
  const totalSessions = monitoring?.summary?.total || 0;
  const hasAgents = totalSessions > 0;

  return (
    <div className="space-y-6" style={{maxWidth: "1000px", margin: "0 auto"}}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{width: '24px', height: '1px', background: styles.purpleBright}}></span>
            ODDC Certification
          </p>
          <h1 style={{fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary}}>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>
          <p style={{color: styles.textTertiary, marginTop: '6px', fontSize: '13px', fontFamily: styles.mono}}>{user?.organization ? user.organization + ' · ' : ''}{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
        {hasApps && <StatCard onClick={() => navigate("/applications")} label="Applications" value={summary?.applications?.total || applications.length} color={styles.purpleBright} icon={<FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} subtitle={summary?.applications ? ((summary.applications.pending || 0) + (summary.applications.under_review || 0) > 0 ? `${(summary.applications.pending || 0) + (summary.applications.under_review || 0)} in review` : null) : null} />}
        {hasCerts && <StatCard onClick={() => navigate("/certificates")} label="Certificates" value={certTotal} color={styles.accentGreen} icon={<Award fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentGreen}} />} subtitle={certActive > 0 ? `${certActive} active` : null} />}
        {hasApps && <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={summary?.applications?.testing || 0} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentAmber}} />} />}
        {hasAgents && (() => {
          const statusColor = onlineCount > 0 ? styles.accentGreen : styles.accentAmber;
          const statusText = onlineCount > 0 ? `${onlineCount} of ${totalSessions} online` : 'All systems offline';
          return <StatCard onClick={() => navigate('/surveillance')} label="Live Status" value={onlineCount} color={statusColor} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: statusColor}} />} subtitle={statusText} />;
        })()}
      </div>

      {/* Applications with Progress */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Your Applications</h2>
          {hasApps && (
            <Link to="/applications" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px'}}>View All →</Link>
          )}
        </div>
        {!hasApps ? (
          <div style={{textAlign: 'center', padding: '56px 20px'}}>
            <div style={{width: '72px', height: '72px', background: 'transparent', border: '1px solid ' + styles.borderSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
              <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={32} style={{color: styles.purpleBright, opacity: 0.7}} />
            </div>
            <p style={{color: styles.textPrimary, fontSize: '17px', fontWeight: 500, marginBottom: '8px', fontFamily: styles.serif}}>Begin Your Certification</p>
            <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px', lineHeight: '1.6'}}>Submit your autonomous system for ODDC certification. Our CAT-72 test validates real-time boundary enforcement over 72 hours.</p>
            <Link to="/applications/new" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: styles.purplePrimary, border: '1px solid ' + styles.purplePrimary, color: '#fff', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none', transition: 'opacity 0.2s'}}>
              <Plus size={14} />
              New Application
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const idx = stageIdx(app.state);
              return (
                <Link key={app.id} to={`/applications/${app.id}`} style={{textDecoration: 'none', display: 'block'}}>
                  <div style={{padding: '20px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, cursor: 'pointer', transition: 'border-color 0.2s'}} onMouseEnter={e => e.currentTarget.style.borderColor = styles.purpleBright} onMouseLeave={e => e.currentTarget.style.borderColor = styles.borderGlass}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
                      <div>
                        <div style={{fontWeight: 500, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px'}}>{app.system_name}</div>
                        <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono}}>{app.application_number} · {formatSystemType(app.system_type)}</div>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <span style={{fontSize: '12px', color: styles.textTertiary}}>{nextAction(app.state)}</span>
                        <span style={{padding: '4px 12px', fontSize: '10px', fontFamily: styles.mono, textTransform: 'uppercase', letterSpacing: '1px',
                          background: `${stateColor(app.state)}06`,
                          color: stateColor(app.state),
                          border: `1px solid ${stateColor(app.state)}10`
                        }}>{app.state}</span>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '3px', height: '4px'}}>
                      {STAGES.map((s, i) => (
                        <div key={s.key} style={{flex: 1, background: i <= idx ? stateColor(app.state) : 'rgba(0,0,0,0.025)'}} />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Certificates — use summary count, fetch full list only if needed */}
      {hasCerts && (
        <CertificatesList />
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
            <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Recent Activity</h2>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '1px'}}>
            {recentActivity.map((log, i) => {
              const actionLabels = {
                user_login: 'Signed in', user_registered: 'Account created',
                application_submitted: 'Application submitted', application_state_changed: 'Application status updated',
                test_created: 'CAT-72 test scheduled', test_started: 'CAT-72 test started', test_completed: 'CAT-72 test completed',
                certificate_issued: 'Certificate issued', certificate_suspended: 'Certificate suspended',
                certificate_revoked: 'Certificate revoked', certificate_reinstated: 'Certificate reinstated',
                api_key_created: 'API key created', password_changed: 'Password changed', profile_updated: 'Profile updated',
              };
              const actionColors = {
                application_submitted: styles.purpleBright, application_state_changed: styles.accentAmber,
                test_started: styles.accentAmber, test_completed: styles.accentGreen,
                certificate_issued: styles.accentGreen, certificate_suspended: styles.accentAmber, certificate_revoked: styles.accentRed,
              };
              const label = actionLabels[log.action] || log.action?.replace(/_/g, ' ') || 'Activity';
              const color = actionColors[log.action] || styles.textSecondary;
              const detail = log.details?.system_name || log.details?.application_number || log.details?.certificate_number || '';
              return (
                <div key={log.id || i} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid ' + styles.borderSubtle : 'none'}}>
                  <div style={{width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0}} />
                  <div style={{flex: 1, minWidth: 0}}>
                    <span style={{fontSize: '13px', color: styles.textPrimary}}>{label}</span>
                    {detail && <span style={{fontSize: '12px', color: styles.textTertiary, marginLeft: '8px'}}>{detail}</span>}
                  </div>
                  <span style={{fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono, flexShrink: 0}}>{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ── Lazy-loaded certificates list for customer dashboard ──────────────── */
function CertificatesList() {
  const [certificates, setCertificates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api.get('/api/certificates/').then(res => {
      setCertificates(res.data || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  if (!loaded) return <Panel><div style={{color: styles.textTertiary, textAlign: 'center', padding: '20px', fontFamily: styles.mono, fontSize: '11px'}}>Loading certificates...</div></Panel>;
  if (certificates.length === 0) return null;
  return (
    <Panel>
      <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Certificates</h2>
      <div className="space-y-3">
        {certificates.map(cert => (
          <div key={cert.id} style={{padding: '16px', background: 'transparent', border: '1px solid ' + styles.borderSubtle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
            <div>
              <div style={{fontWeight: 500, color: styles.accentGreen, marginBottom: '4px', fontFamily: styles.mono, fontSize: '14px'}}>{cert.certificate_number}</div>
              <div style={{fontSize: '12px', color: styles.textTertiary}}>Issued: {new Date(cert.issued_at).toLocaleDateString()}{cert.expires_at ? ` · Expires: ${new Date(cert.expires_at).toLocaleDateString()}` : ''}</div>
            </div>
            <a href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`} target="_blank" rel="noopener noreferrer" style={{display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'transparent', border: '1px solid ' + styles.borderGlass, color: styles.purpleBright, fontSize: '10px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none', transition: 'border-color 0.2s'}}>
              <Download size={12} />
              Download PDF
            </a>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
   Admin Dashboard — Worklist
   99% of the process is autonomous. This dashboard exists for the 1%:
   reviewing auto-discovered ODD boundaries and approving applications.
   ═════════════════════════════════════════════════════════════════════════════ */

function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [activeTests, setActiveTests] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [allCerts, setAllCerts] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState(null);
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadData = (manual) => {
    if (manual) setRefreshing(true);
    Promise.all([
      api.get('/api/v1/dashboard/summary').catch(() => ({ data: null })),
      api.get('/api/dashboard/active-tests').catch(() => ({ data: [] })),
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
      api.get('/api/surveillance/alerts?limit=100').catch(() => ({ data: { alerts: [] } })),
      api.get('/api/audit/logs?limit=12&offset=0').catch(() => ({ data: { logs: [] } })),
    ]).then(([sumRes, testsRes, appsRes, certsRes, monRes, alertsRes, auditRes]) => {
      setSummary(sumRes.data);
      setActiveTests(ensureArray(testsRes.data));
      setAllApps(ensureArray(appsRes.data?.applications || appsRes.data));
      setAllCerts(ensureArray(certsRes.data));
      if (monRes.data) setMonitoring(monRes.data);
      setComplianceAlerts(ensureArray(alertsRes.data?.alerts || alertsRes.data));
      setAuditLogs(ensureArray(auditRes.data?.logs || auditRes.data));
      setLoading(false);
      if (manual) setTimeout(() => setRefreshing(false), 400);
    });
  };

  useEffect(() => { loadData(); const interval = setInterval(loadData, 30000); return () => clearInterval(interval); }, []);

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const pipeline = summary?.applications || {};
  const certData = summary?.certificates || {};

  const needsAction = useMemo(() =>
    allApps.filter(a => a.state === 'pending' || a.state === 'under_review')
      .sort((a, b) => new Date(a.submitted_at || a.created_at || 0) - new Date(b.submitted_at || b.created_at || 0))
  , [allApps]);

  // Portfolio breakdown
  const portfolio = useMemo(() => {
    const now = Date.now();
    const d30 = 30 * 24 * 60 * 60 * 1000;
    let conformant = 0, expiringSoon = 0, nonConformant = 0, expired = 0;
    allCerts.forEach(c => {
      const isActive = c.state === 'conformant' || c.state === 'active' || c.state === 'issued';
      if (c.state === 'non_conformant' || c.state === 'suspended' || c.state === 'revoked') { nonConformant++; return; }
      if (c.state === 'expired' || (c.expires_at && new Date(c.expires_at) < now)) { expired++; return; }
      if (isActive && c.expires_at && new Date(c.expires_at) < new Date(now + d30)) { expiringSoon++; return; }
      if (isActive) { conformant++; return; }
    });
    return { conformant, expiringSoon, nonConformant, expired, total: allCerts.length };
  }, [allCerts]);

  // Pipeline counts per stage
  const pipelineCounts = useMemo(() => {
    const stages = { pending: 0, under_review: 0, approved: 0, observe: 0, bounded: 0, testing: 0, conformant: 0, suspended: 0, rejected: 0 };
    allApps.forEach(a => { if (stages[a.state] !== undefined) stages[a.state]++; else stages.pending++; });
    return stages;
  }, [allApps]);

  // Expiration timeline — next 90 days grouped by week
  const expirationTimeline = useMemo(() => {
    const now = Date.now();
    const d90 = 90 * 24 * 60 * 60 * 1000;
    return allCerts
      .filter(c => c.expires_at && (c.state === 'conformant' || c.state === 'active' || c.state === 'issued') && new Date(c.expires_at) > new Date(now) && new Date(c.expires_at) < new Date(now + d90))
      .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
  }, [allCerts]);

  const onlineCount = monitoring?.sessions?.filter(isOnline).length || monitoring?.summary?.active || 0;
  const totalSessions = monitoring?.summary?.total || monitoring?.sessions?.length || 0;
  const conformantCount = portfolio.conformant + portfolio.expiringSoon;
  const totalCerts = portfolio.total;
  const alertCount = complianceAlerts.length + activeTests.filter(t => t.status === 'failed').length;

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({title: 'Confirm', message: label + '?'})) return;
    setActionInFlight(appId);
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, { params: { application_id: appId, send_email: true } });
          toast.show('Approved — API key provisioned and emailed', 'success');
        } catch { toast.show('Approved — applicant can generate key from dashboard', 'success'); }
      } else { toast.show('State updated', 'success'); }
      loadData();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
    finally { setActionInFlight(null); }
  };

  /* ── Sub-components ───────────────────────────────────────────────────── */

  // Donut chart — pure SVG
  const DonutChart = ({ data, size = 140 }) => {
    const segments = data.filter(d => d.value > 0);
    const total = segments.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div style={{width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim}}>No data</div>;
    const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.14;
    let cumulative = 0;
    const arcs = segments.map(seg => {
      const frac = seg.value / total;
      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      cumulative += frac;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      const largeArc = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
      return { ...seg, d: frac >= 0.9999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}` : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}` };
    });
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />)}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{fontSize: '22px', fontWeight: 600, fontFamily: styles.mono, fill: styles.textPrimary}}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{fontSize: '9px', fontFamily: styles.mono, letterSpacing: '1.5px', fill: styles.textDim, textTransform: 'uppercase'}}>Total</text>
      </svg>
    );
  };



  /* ── Render ───────────────────────────────────────────────────────────── */

  if (loading) return (
    <div className="page-enter" style={{padding: 'clamp(16px, 4vw, 40px)'}}>
      <div style={{marginBottom: 24}}>
        <div className="skeleton" style={{width: 120, height: 12, marginBottom: 12}}></div>
        <div className="skeleton" style={{width: 200, height: 32, marginBottom: 8}}></div>
        <div className="skeleton" style={{width: 280, height: 14}}></div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32}}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{height: 88, borderRadius: 4}}></div>)}
      </div>
      <div className="skeleton" style={{height: 300, borderRadius: 4, marginBottom: 24}}></div>
      <div className="skeleton" style={{height: 200, borderRadius: 4}}></div>
    </div>
  );

  const actionBtnStyle = (color, disabled) => ({
    background: 'transparent', border: '1px solid ' + styles.borderGlass,
    color: disabled ? styles.textDim : color,
    fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer', padding: '6px 14px',
    opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto',
    transition: 'border-color 0.2s, color 0.2s',
  });

  const sectionHeader = (label, color, linkTo, linkLabel) => (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
      <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: color || styles.textTertiary, margin: 0}}>{label}</h2>
      {linkTo && <Link to={linkTo} style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px'}}>{linkLabel || 'View All →'}</Link>}
    </div>
  );

  return (
    <div style={{maxWidth: '1080px', margin: '0 auto'}}>

      {/* ── Header + Refresh ─────────────────────────────────────────────── */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px'}}>
        <div>
          <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: styles.textDim, margin: '0 0 4px'}}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 style={{fontFamily: styles.serif, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 300, margin: 0, color: styles.textPrimary}}>Operations</h1>
        </div>
        <button onClick={() => loadData(true)} style={{background: 'transparent', border: '1px solid ' + styles.borderGlass, padding: '6px 14px', color: styles.textTertiary, cursor: 'pointer', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <RefreshCw size={12} style={refreshing ? {animation: 'spin 0.8s linear infinite'} : {}} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Row 1: Portfolio Health + Expiration Timeline ────────────────── */}
      <div style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '24px'}}>

        {/* Portfolio Donut + Compact Pipeline */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Certificate Portfolio', null, '/certificates', 'Registry →')}
          <div style={{display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px'}}>
            <DonutChart data={[
              { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
              { label: 'Expiring 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
              { label: 'Non-Conformant', value: portfolio.nonConformant, color: styles.accentRed },
              { label: 'Expired', value: portfolio.expired, color: styles.textDim },
            ]} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', flex: 1}}>
              {[
                { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
                { label: 'Expiring < 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
                { label: 'Non-Conformant', value: portfolio.nonConformant, color: styles.accentRed },
                { label: 'Expired', value: portfolio.expired, color: styles.textDim },
              ].map(row => (
                <div key={row.label} style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '2px', background: row.color, flexShrink: 0}} />
                  <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, flex: 1, letterSpacing: '0.5px'}}>{row.label}</span>
                  <span style={{fontFamily: styles.mono, fontSize: '13px', fontWeight: 600, color: row.value > 0 ? row.color : styles.textDim}}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Compact pipeline flow */}
          <div style={{borderTop: '1px solid ' + styles.borderSubtle, paddingTop: '16px'}}>
            <div style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textDim, marginBottom: '10px'}}>Pipeline</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
              {[
                { label: 'New', count: pipelineCounts.pending + pipelineCounts.under_review, color: styles.accentAmber },
                { label: 'Accepted', count: pipelineCounts.approved, color: 'rgba(29,26,59,0.5)' },
                { label: 'Interlock', count: pipelineCounts.observe, color: 'rgba(29,26,59,0.5)' },
                { label: 'Boundaries', count: pipelineCounts.bounded, color: 'rgba(29,26,59,0.5)' },
                { label: 'CAT-72', count: pipelineCounts.testing, color: styles.purpleBright },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <span style={{color: styles.textDim, fontSize: '10px', margin: '0 2px'}}>→</span>}
                  <div style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: s.count > 0 ? s.color + '10' : 'transparent', border: s.count > 0 ? '1px solid ' + s.color + '30' : '1px solid ' + styles.borderSubtle, borderRadius: '3px'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '12px', fontWeight: 600, color: s.count > 0 ? s.color : styles.textDim}}>{s.count}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '8px', letterSpacing: '0.5px', color: styles.textDim, textTransform: 'uppercase'}}>{s.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {(pipelineCounts.suspended + pipelineCounts.rejected) > 0 && (
              <div style={{marginTop: '8px', display: 'flex', gap: '12px'}}>
                {pipelineCounts.suspended > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.accentRed}}>{pipelineCounts.suspended} suspended</span>}
                {pipelineCounts.rejected > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{pipelineCounts.rejected} rejected</span>}
              </div>
            )}
          </div>
        </div>

        {/* Expiration Timeline — promoted to row 1 */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Expiration Timeline (90d)', expirationTimeline.length > 0 ? styles.accentAmber : styles.textTertiary, '/certificates', 'Registry →')}
          {expirationTimeline.length === 0 ? (
            <div style={{padding: '40px 0', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim}}>No certificates expiring in 90 days</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              {expirationTimeline.slice(0, 8).map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
                const urgent = daysLeft <= 14;
                const critical = daysLeft <= 7;
                return (
                  <Link key={c.id} to={c.application_id ? '/applications/' + c.application_id : '/certificates'} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + styles.borderSubtle, textDecoration: 'none', gap: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0}}>
                      <div style={{width: '6px', height: '6px', borderRadius: '50%', background: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textDim, flexShrink: 0}} />
                      <span style={{fontSize: '13px', color: styles.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.system_name}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{c.organization_name}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0}}>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 500, color: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textTertiary}}>{daysLeft}d</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{c.certificate_number}</span>
                    </div>
                  </Link>
                );
              })}
              {expirationTimeline.length > 8 && (
                <Link to="/certificates" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px', padding: '8px 0', textAlign: 'center'}}>+{expirationTimeline.length - 8} more →</Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Live Status Strip ─────────────────────────────────────── */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px'}}>
        {[
          { label: 'Pending Review', value: needsAction.length, color: needsAction.length > 0 ? styles.accentAmber : styles.textDim, onClick: () => navigate('/applications') },
          { label: 'Active Tests', value: activeTests.length, color: activeTests.length > 0 ? styles.purpleBright : styles.textDim, onClick: () => navigate('/cat72') },
          { label: 'Systems Online', value: `${conformantCount}/${totalCerts}`, color: conformantCount > 0 ? styles.accentGreen : styles.textDim, onClick: () => navigate('/surveillance') },
          { label: 'Alerts', value: complianceAlerts.length, color: complianceAlerts.length > 0 ? styles.accentAmber : styles.accentGreen, onClick: () => navigate('/surveillance') },
        ].map(item => (
          <div key={item.label} onClick={item.onClick} style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s'}} onMouseEnter={e => e.currentTarget.style.borderColor = styles.purpleBright} onMouseLeave={e => e.currentTarget.style.borderColor = styles.borderGlass}>
            <div style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textDim, marginBottom: '6px'}}>{item.label}</div>
            <div style={{fontFamily: styles.mono, fontSize: '24px', fontWeight: 600, color: item.color}}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* ── Review Queue ─────────────────────────────────────────────────── */}
      <div style={{marginBottom: '24px'}}>
        {sectionHeader(needsAction.length > 0 ? `Review Queue (${needsAction.length})` : 'Review Queue', needsAction.length > 0 ? styles.accentAmber : styles.textTertiary, '/applications', 'All Applications →')}
        {needsAction.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', border: '1px solid ' + styles.borderSubtle, background: styles.cardSurface}}>
            <div style={{fontSize: '14px', color: styles.textSecondary, marginBottom: '4px'}}>No applications pending review</div>
            <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textDim}}>You're caught up.</div>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {needsAction.map(app => {
              const submitted = app.submitted_at || app.created_at;
              const daysWaiting = submitted ? Math.floor((Date.now() - new Date(submitted).getTime()) / (1000*60*60*24)) : 0;
              const isFlying = actionInFlight === app.id;
              const isStale = daysWaiting > 7;
              return (
                <div key={app.id} style={{padding: '14px 20px', background: styles.cardSurface, border: '1px solid ' + (isStale ? styles.accentAmber + '40' : styles.borderGlass), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', cursor: 'pointer', transition: 'border-color 0.2s'}} onClick={() => navigate(`/applications/${app.id}`)}>
                  <div style={{flex: 1, minWidth: '200px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
                      <span style={{fontWeight: 600, fontSize: '14px', color: styles.textPrimary}}>{app.system_name}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary}}>{app.organization_name}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px'}}>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: stateColor(app.state), letterSpacing: '1px', textTransform: 'uppercase'}}>{app.state?.replace('_', ' ')}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: isStale ? styles.accentAmber : styles.textDim}}>{daysWaiting === 0 ? 'today' : daysWaiting + 'd ago'}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{formatSystemType(app.system_type)}</span>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}} onClick={e => e.stopPropagation()}>
                    {app.state === 'pending' && <button onClick={() => handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`)} style={actionBtnStyle(styles.accentAmber, isFlying)} disabled={isFlying}>{isFlying ? '...' : 'Begin Review'}</button>}
                    {app.state === 'under_review' && (<>
                      <button onClick={() => handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`)} style={actionBtnStyle(styles.accentGreen, isFlying)} disabled={isFlying}>Approve</button>
                      <button onClick={() => handleQuickAdvance(app.id, 'suspended', `Reject ${app.system_name}`)} style={actionBtnStyle(styles.accentRed, isFlying)} disabled={isFlying}>Reject</button>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Active Tests (auto-hides when empty) ─────────────────────────── */}
      {activeTests.length > 0 && (
        <div style={{marginBottom: '24px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader(`Active Tests (${activeTests.length})`, styles.purpleBright, '/cat72', 'Console →')}
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {activeTests.map(test => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                    <span style={{fontSize: '13px', fontWeight: 500, color: styles.textPrimary}}>{test.system_name}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, color: pct >= 100 ? styles.accentGreen : styles.purpleBright}}>{pct}%</span>
                  </div>
                  <div style={{height: '4px', background: 'rgba(0,0,0,0.04)', marginBottom: '4px'}}>
                    <div style={{width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purpleBright, transition: 'width 0.5s ease'}} />
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{test.organization_name}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{hoursLeft}h left</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Compliance Alerts ────────────────────────────────────────────── */}
      {complianceAlerts.length > 0 && (
        <div style={{marginBottom: '24px'}}>
          {sectionHeader(`Compliance Alerts (${complianceAlerts.length})`, styles.accentAmber, '/surveillance', 'Surveillance →')}
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {complianceAlerts.slice(0, 8).map((alert, i) => (
              <div key={alert.id || i} style={{padding: '12px 20px', background: styles.cardSurface, border: '1px solid ' + (alert.severity === 'critical' ? styles.accentRed + '40' : styles.accentAmber + '30'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <AlertTriangle size={14} style={{color: alert.severity === 'critical' ? styles.accentRed : styles.accentAmber}} />
                  <span style={{fontFamily: styles.mono, fontSize: '10px', color: alert.severity === 'critical' ? styles.accentRed : styles.accentAmber, letterSpacing: '1px', textTransform: 'uppercase'}}>{alert.severity || 'warning'}</span>
                  <span style={{fontSize: '13px', color: styles.textPrimary}}>{alert.message || alert.description || 'System alert'}</span>
                </div>
                <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{timeAgo(alert.timestamp || alert.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity Feed ────────────────────────────────────────────────── */}
      {auditLogs.length > 0 && (
        <div style={{marginBottom: '24px'}}>
          {sectionHeader('Recent Activity', styles.textTertiary, '/activity', 'Full Log →')}
          <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '4px 20px'}}>
            {auditLogs.filter((log, i, arr) => {
              // Deduplicate consecutive same-action from same user
              if (i === 0) return true;
              const prev = arr[i - 1];
              return !(log.action === prev.action && (log.user_email || '') === (prev.user_email || ''));
            }).slice(0, 10).map((log, i) => {
              const actionLabels = {
                user_login: 'Signed in', user_registered: 'Account created',
                application_submitted: 'Application submitted', application_state_changed: 'Status changed',
                test_created: 'Test scheduled', test_started: 'Test started', test_completed: 'Test completed',
                certificate_issued: 'Certificate issued', certificate_suspended: 'Certificate suspended',
                certificate_revoked: 'Certificate revoked', certificate_reinstated: 'Certificate reinstated',
                boundary_acknowledged: 'Boundaries acknowledged', api_key_created: 'API key created',
              };
              const actionColors = {
                application_submitted: styles.purpleBright, application_state_changed: styles.accentAmber,
                test_started: styles.accentAmber, test_completed: styles.accentGreen,
                certificate_issued: styles.accentGreen, certificate_suspended: styles.accentAmber, certificate_revoked: styles.accentRed,
              };
              const label = actionLabels[log.action] || log.action?.replace(/_/g, ' ') || 'Activity';
              const color = actionColors[log.action] || styles.textDim;
              const who = log.user_email || log.details?.user_email || '';
              const detail = log.details?.system_name || log.details?.application_number || log.details?.certificate_number || '';
              return (
                <div key={log.id || i} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < Math.min(auditLogs.length, 10) - 1 ? '1px solid ' + styles.borderSubtle : 'none'}}>
                  <div style={{width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0}} />
                  <span style={{fontSize: '12px', color: styles.textPrimary, flex: '0 0 auto'}}>{label}</span>
                  {detail && <span style={{fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{detail}</span>}
                  <div style={{flex: 1}} />
                  {who && <span style={{fontSize: '10px', color: styles.textDim, fontFamily: styles.mono, flexShrink: 0}}>{who.split('@')[0]}</span>}
                  <span style={{fontSize: '10px', color: styles.textDim, fontFamily: styles.mono, flexShrink: 0}}>{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════ */

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Dashboard />;
  return <CustomerDashboard />;
}

export { CustomerDashboard, RoleBasedDashboard };
export default Dashboard;
