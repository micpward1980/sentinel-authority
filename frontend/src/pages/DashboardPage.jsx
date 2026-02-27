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
      api.get('/api/audit/my-logs?limit=5&offset=0').catch(() => ({ data: { logs: [] } }))
    ]).then(([sumRes, appsRes, monRes, actRes]) => {
      setSummary(sumRes.data);
      setApplications(appsRes.data.applications || appsRes.data || []);
      if (monRes.data) setMonitoring(monRes.data);
      setRecentActivity(actRes.data.logs || actRes.data || []);
      setLoading(false);
    });
  }, []);

  const STAGES = [
    { key: 'pending', label: 'Submitted' },
    { key: 'under_review', label: 'In Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'testing', label: 'Testing' },
    { key: 'conformant', label: 'Conformant' },
  ];

  const stageIdx = (state) => STAGES.findIndex(s => s.key === state);

  const nextAction = (state) => {
    switch(state) {
      case 'pending': return 'Awaiting review';
      case 'under_review': return 'Under evaluation';
      case 'approved': return 'Preparing CAT-72';
      case 'testing': return 'Test in progress';
      case 'conformant': return 'Certificate issued';
      case 'revoked': return 'Suspended';
      default: return 'Pending';
    }
  };

  if (loading) return <div style={{color: styles.textTertiary, padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center'}}>Loading...</div>;

  const hasApps = applications.length > 0;
  const certTotal = summary?.certificates?.total || 0;
  const certActive = summary?.certificates?.active || 0;
  const hasCerts = certTotal > 0;
  const sessions = monitoring?.sessions || [];
  const onlineCount = sessions.filter(isOnline).length;
  const totalSessions = monitoring?.summary?.total || 0;
  const hasAgents = totalSessions > 0;

  return (
    <div className="space-y-6" style={{maxWidth: "1000px", margin: "0 auto"}}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>ODDC Certification</p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>
          <p style={{color: styles.textSecondary, marginTop: '8px'}}>{user?.organization ? user.organization + ' · ' : ''}Track your certification progress and manage your systems.</p>
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
          return <StatCard onClick={() => navigate('/monitoring')} label="Live Status" value={onlineCount} color={statusColor} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: statusColor}} />} subtitle={statusText} />;
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
            <p style={{color: styles.textPrimary, fontSize: '17px', fontWeight: 500, marginBottom: '8px', fontFamily: "Georgia, 'Source Serif 4', serif"}}>Begin Your Certification</p>
            <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px', lineHeight: '1.6'}}>Submit your autonomous system for ODDC certification. Our CAT-72 test validates real-time boundary enforcement over 72 hours.</p>
            <Link to="/applications/new" className="inline-flex items-center gap-2 px-6 py-3 no-underline" style={{background: styles.purplePrimary, border: 'none', color: '#fff', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              <Plus className="w-4 h-4" />
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
                        <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono}}>{app.application_number} · {app.system_type?.replace(/_/g, ' ')}</div>
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
            <a href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`} target="_blank" style={{padding: '8px 16px', background: styles.purplePrimary, color: '#fff', fontSize: '11px', fontFamily: styles.mono, textDecoration: 'none'}}>
              Download PDF
            </a>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
   Admin Dashboard — optimized for thousands of customers
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

  const loadData = (manual) => {
    if (manual) setRefreshing(true);
    Promise.all([
      api.get('/api/v1/dashboard/summary').catch(() => ({ data: null })),
      api.get('/api/dashboard/active-tests').catch(() => ({ data: [] })),
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
    ]).then(([sumRes, testsRes, appsRes, certsRes, monRes]) => {
      setSummary(sumRes.data);
      setActiveTests(ensureArray(testsRes.data));
      setAllApps(ensureArray(appsRes.data?.applications || appsRes.data));
      setAllCerts(ensureArray(certsRes.data));
      if (monRes.data) setMonitoring(monRes.data);
      setLoading(false);
      if (manual) setTimeout(() => setRefreshing(false), 400);
    });
  };

  useEffect(() => { loadData(); const interval = setInterval(loadData, 30000); return () => clearInterval(interval); }, []);

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const pipeline = summary?.applications || {
    pending: 0, under_review: 0, approved: 0, testing: 0, conformant: 0, suspended: 0, revoked: 0
  };

  const pipelineTotal = summary?.applications?.total || allApps.length || 1;

  // Review queue: sorted oldest-first so longest-waiting items surface
  const needsAction = useMemo(() =>
    allApps
      .filter(a => a.state === 'pending' || a.state === 'under_review')
      .sort((a, b) => new Date(a.submitted_at || a.created_at || 0) - new Date(b.submitted_at || b.created_at || 0))
  , [allApps]);

  // Expiring certs: sorted soonest-first, capped at 5
  const expiring = useMemo(() =>
    allCerts
      .filter(c => c.expires_at && (c.state === 'conformant' || c.state === 'active' || c.state === 'issued') && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000))
      .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
      .slice(0, 5)
  , [allCerts]);

  const totalExpiring = summary?.certificates?.expiring_30d || allCerts.filter(c => c.expires_at && (c.state === 'conformant' || c.state === 'active' || c.state === 'issued') && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000)).length;

  const onlineAgents = monitoring?.sessions?.filter(isOnline).length || monitoring?.summary?.active || summary?.envelo?.online_agents || 0;

  // Aging: how many apps have been waiting > 7 days
  const staleCount = needsAction.filter(a => {
    const submitted = a.submitted_at || a.created_at;
    return submitted && (Date.now() - new Date(submitted).getTime()) > 7 * 24 * 60 * 60 * 1000;
  }).length;

  const actionCount = needsAction.length + totalExpiring;

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({title: 'Confirm', message: label + '?'})) return;
    setActionInFlight(appId);
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, { params: { application_id: appId, send_email: true } });
          toast.show('Approved — API key provisioned and emailed to applicant', 'success');
        } catch {
          toast.show('Approved — applicant can generate key from their dashboard', 'success');
        }
      } else {
        toast.show('State updated', 'success');
      }
      loadData();
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setActionInFlight(null);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (loading) return <div style={{color: styles.textTertiary, padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px'}}>LOADING...</div>;

  const btnStyle = (color, disabled) => ({
    background: 'transparent',
    border: '1px solid ' + styles.borderSubtle,
    color: disabled ? styles.textDim : color,
    fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '4px 10px',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  });

  return (
    <div className="space-y-6" style={{maxWidth: "1200px", margin: "0 auto"}}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px'}}>
        <div>
          <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{width: '24px', height: '1px', background: styles.purpleBright}}></span>
            Administration
          </p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>
          <p style={{color: styles.textTertiary, marginTop: '6px', fontSize: '13px', fontFamily: styles.mono}}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => loadData(true)} style={{background: 'transparent', border: `1px solid ${styles.borderGlass}`, padding: '10px 16px', color: styles.textSecondary, cursor: 'pointer', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <RefreshCw fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={14} style={refreshing ? {animation: "spin 0.8s linear infinite"} : {}} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats Row — uses summary endpoint */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
        <StatCard label="Total Applications" value={summary?.applications?.total || 0} color={styles.purpleBright} icon={<FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} />
        <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={summary?.applications?.testing || 0} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentAmber}} />} />
        <StatCard label="Active Certificates" value={summary?.certificates?.active || 0} color={styles.accentGreen} icon={<Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentGreen}} />} />
        <StatCard label="Online Interlocks" value={onlineAgents} color={onlineAgents > 0 ? styles.accentGreen : styles.textTertiary} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: onlineAgents > 0 ? styles.accentGreen : styles.textTertiary}} />} />
        <StatCard label="Certificates Issued" value={summary?.certificates?.total || 0} color={styles.purpleBright} icon={<Award fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} />
        <StatCard label="Needs Action" value={actionCount} color={actionCount > 0 ? styles.accentAmber : styles.textTertiary} icon={<AlertCircle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: actionCount > 0 ? styles.accentAmber : styles.textTertiary}} />} subtitle={staleCount > 0 ? `${staleCount} pending > 7d` : null} />
      </div>

      {/* Pipeline — uses summary counts */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Certification Pipeline</h2>
          <Link to="/applications" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>All Applications →</Link>
        </div>
        <div style={{display: 'flex', gap: '4px', height: '32px', overflow: 'hidden'}}>
          {[
            { key: 'pending', label: 'Pending', color: styles.accentAmber, count: pipeline.pending || 0 },
            { key: 'under_review', label: 'Review', color: styles.accentAmber, count: pipeline.under_review || 0 },
            { key: 'approved', label: 'Approved', color: styles.purpleBright, count: pipeline.approved || 0 },
            { key: 'testing', label: 'Testing', color: styles.purpleBright, count: pipeline.testing || 0 },
            { key: 'conformant', label: 'Conformant', color: styles.accentGreen, count: pipeline.conformant || 0 },
            { key: 'revoked', label: 'Suspended', color: styles.accentRed, count: (pipeline.revoked || 0) + (pipeline.suspended || 0) },
          ].map(stage => {
            const pct = Math.max((stage.count / pipelineTotal) * 100, stage.count > 0 ? 8 : 0);
            return stage.count > 0 ? (
              <div key={stage.key} style={{width: `${pct}%`, background: `${stage.color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', borderLeft: `2px solid ${stage.color}`}} title={`${stage.label}: ${stage.count}`}>
                <span style={{fontFamily: styles.mono, fontSize: '10px', color: stage.color, whiteSpace: 'nowrap'}}>{stage.count} {stage.label}</span>
              </div>
            ) : null;
          })}
          {(summary?.applications?.total || allApps.length) === 0 && (
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
              <p style={{color: styles.textSecondary, fontSize: '14px', margin: 0}}>No applications yet</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Review Queue */}
      {needsAction.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
            <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0}}>⚡ Review Queue ({needsAction.length}){staleCount > 0 ? ` · ${staleCount} overdue` : ''}</h2>
            <Link to="/applications" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
          </div>
          <div className="space-y-3">
            {needsAction.slice(0, 5).map(app => {
              const submitted = app.submitted_at || app.created_at;
              const age = timeAgo(submitted);
              const isFlying = actionInFlight === app.id;
              return (
                <div key={app.id} style={{padding: '14px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'}}>
                    <Link to={`/applications/${app.id}`} style={{color: styles.purpleBright, textDecoration: 'none', fontWeight: 500, fontSize: '14px'}}>{app.system_name}</Link>
                    <span style={{color: styles.textTertiary, fontSize: '12px'}}>{app.organization_name}</span>
                    <span style={{color: stateColor(app.state), fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>{app.state?.replace('_', ' ')}</span>
                    {age && <span style={{color: styles.textDim, fontFamily: styles.mono, fontSize: '9px'}}>submitted {age}</span>}
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    {app.state === 'pending' && (
                      <button onClick={() => handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`)} style={btnStyle(styles.accentAmber, isFlying)} disabled={isFlying}>
                        {isFlying ? 'Working…' : 'Begin Review'}
                      </button>
                    )}
                    {app.state === 'under_review' && (
                      <>
                        <button onClick={() => handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`)} style={btnStyle(styles.accentGreen, isFlying)} disabled={isFlying}>Approve</button>
                        <button onClick={() => handleQuickAdvance(app.id, 'suspended', `Reject ${app.system_name}`)} style={btnStyle(styles.accentRed, isFlying)} disabled={isFlying}>Reject</button>
                      </>
                    )}
                    <Link to={`/applications/${app.id}`} style={{background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none', padding: '4px 10px', display: 'inline-flex', alignItems: 'center'}}>View</Link>
                  </div>
                </div>
              );
            })}
            {needsAction.length > 5 && (
              <div style={{textAlign: 'center', padding: '8px'}}>
                <Link to="/applications?filter=needs_action" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>+{needsAction.length - 5} more →</Link>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
            <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Active CAT-72 Tests</h2>
            <Link to="/cat72" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>Console →</Link>
          </div>
          <div className="space-y-3">
            {activeTests.map(test => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id} style={{padding: '16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright}}>{test.organization_name} — {test.system_name}</span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>{hoursLeft}h remaining</span>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', color: styles.accentAmber}}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{height: '4px', background: 'rgba(0,0,0,0.05)'}}>
                    <div style={{width: `${pct}%`, height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purpleBright, transition: 'width 0.3s'}} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Expiring Certificates */}
      {expiring.length > 0 && (
        <div style={{background: 'transparent', border: '1px solid ' + styles.borderSubtle, padding: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={16} style={{color: styles.accentAmber}} />
              <span style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.accentAmber}}>
                {totalExpiring} Certificate{totalExpiring > 1 ? 's' : ''} Expiring Within 30 Days
              </span>
            </div>
            <Link to="/certificates" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
          </div>
          {expiring.map((c, i) => {
            const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
            return (
              <div key={c.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '10px 0', borderTop: i > 0 ? '1px solid ' + styles.borderSubtle : 'none'}}>
                <div>
                  <span style={{color: styles.textPrimary, fontWeight: 500, fontSize: '13px'}}>{c.system_name}</span>
                  <span style={{color: styles.textTertiary, fontSize: '12px', marginLeft: '12px'}}>{c.organization_name}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <span style={{fontFamily: styles.mono, fontSize: '11px', color: daysLeft <= 7 ? styles.accentRed : styles.accentAmber}}>{daysLeft}d remaining</span>
                  <a href={`mailto:${c.applicant_email || 'review@sentinelauthority.org'}?subject=${encodeURIComponent('Certificate Renewal Notice: ' + (c.certificate_number || '') + ' — ' + (c.system_name || ''))}&body=${encodeURIComponent('Dear ' + (c.organization_name || 'Team') + ',\n\nYour ODDC certificate ' + (c.certificate_number || '') + ' for ' + (c.system_name || '') + ' expires in ' + daysLeft + ' days.\n\nPlease contact us to begin the renewal process.\n\nSentinel Authority')}`}
                    style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.purpleBright, textDecoration: 'none', border: '1px solid ' + styles.borderGlass, padding: '3px 8px'}}>
                    Send Notice
                  </a>
                  <Link to={`/verify?cert=${c.certificate_number}`} style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>{c.certificate_number}</Link>
                </div>
              </div>
            );
          })}
          {totalExpiring > 5 && (
            <div style={{textAlign: 'center', padding: '8px 0 0'}}>
              <Link to="/certificates?filter=expiring" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>+{totalExpiring - 5} more →</Link>
            </div>
          )}
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
