import React, { useState, useEffect } from 'react';
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

function CustomerDashboard() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [appTotal, setAppTotal] = useState(0);
  const [stateCounts, setStateCounts] = useState({});
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
      api.get('/api/audit/my-logs?limit=5&offset=0').catch(() => ({ data: { logs: [] } }))
    ]).then(([appsRes, certsRes, monRes, actRes]) => {
      setApplications(appsRes.data.applications || appsRes.data || []);
      setCertificates(certsRes.data || []);
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

  const stateColor = (state) => {
    if (state === 'conformant') return styles.accentGreen;
    if (state === 'revoked' || state === 'suspended') return styles.accentRed;
    if (state === 'testing' || state === 'approved') return styles.purpleBright;
    return styles.accentAmber;
  };

  if (loading) return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}>Loading...</div>;

  return (
    <div className="space-y-6" style={{maxWidth: "1000px", margin: "0 auto"}}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>ODDC Certification</p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>
          <p style={{color: styles.textSecondary, marginTop: '8px'}}>{user?.organization ? user.organization + ' · ' : ''}Track your certification progress and manage your systems.</p>
        </div>

      </div>

      {/* Quick Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
        <StatCard onClick={() => navigate("/applications")} label="Applications" value={applications.length} color={styles.purpleBright} icon={<FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} subtitle={applications.filter(a => a.state === 'pending' || a.state === 'under_review').length > 0 ? `${applications.filter(a => a.state === 'pending' || a.state === 'under_review').length} in review` : null} />
        <StatCard onClick={() => navigate("/certificates")} label="Certificates" value={certificates.length} color={styles.accentGreen} icon={<Award fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentGreen}} />} subtitle={certificates.filter(c => c.state === 'conformant').length > 0 ? `${certificates.filter(c => c.state === 'conformant').length} active` : null} />
        <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={applications.filter(a => a.state === 'testing').length} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentAmber}} />} />
        {(() => {
          const sessions = monitoring?.sessions || [];
          const online = sessions.filter(s => {
            const la = s.last_heartbeat_at || s.last_telemetry_at || s.last_activity || s.started_at;
            return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000;
          }).length;
          const total = monitoring?.summary?.total || 0;
          const hasAgents = total > 0;
          const statusColor = hasAgents ? (online > 0 ? styles.accentGreen : styles.accentAmber) : styles.textTertiary;
          const statusText = hasAgents ? (online > 0 ? `${online} of ${total} online` : 'All systems offline') : 'No active systems';
          return <StatCard onClick={() => navigate('/monitoring')} label="Live Status" value={hasAgents ? online : '—'} color={statusColor} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: statusColor}} />} subtitle={statusText} />;
        })()}
      </div>

      {/* Applications with Progress */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Your Applications</h2>
          {applications.length > 0 && (
            <Link to="/applications" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px'}}>View All →</Link>
          )}
        </div>
        {applications.length === 0 ? (
          <div style={{textAlign: 'center', padding: '56px 20px'}}>
            <div style={{width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(91,75,138,0.12)', border: '1px solid rgba(157,140,207,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
              <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={32} style={{color: styles.purpleBright, opacity: 0.7}} />
            </div>
            <p style={{color: styles.textPrimary, fontSize: '17px', fontWeight: 500, marginBottom: '8px', fontFamily: "Georgia, 'Source Serif 4', serif"}}>Begin Your Certification</p>
            <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px', lineHeight: '1.6'}}>Submit your autonomous system for ODDC certification. Our CAT-72 test validates real-time boundary enforcement over 72 hours.</p>
            <Link to="/applications/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg no-underline" style={{background: `linear-gradient(135deg, ${styles.purplePrimary} 0%, ${styles.purpleBright} 100%)`, border: 'none', color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 4px 20px rgba(91,75,138,0.3)'}}>
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
                  <div style={{padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: `1px solid ${styles.borderGlass}`, cursor: 'pointer', transition: 'border-color 0.2s'}} onMouseEnter={e => e.currentTarget.style.borderColor = styles.purpleBright} onMouseLeave={e => e.currentTarget.style.borderColor = styles.borderGlass}>
                    {/* Top row: name + badge */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                      <div>
                        <div style={{fontWeight: 500, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px'}}>{app.system_name}</div>
                        <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace"}}>{app.application_number} · {app.system_type?.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <span style={{fontSize: '12px', color: styles.textTertiary}}>{nextAction(app.state)}</span>
                        <span style={{padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px',
                          background: `${stateColor(app.state)}20`,
                          color: stateColor(app.state),
                          border: `1px solid ${stateColor(app.state)}40`,
                        }}>{app.state}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div style={{display: 'flex', gap: '3px', height: '4px'}}>
                      {STAGES.map((s, i) => (
                        <div key={s.key} style={{flex: 1, borderRadius: '2px', background: i <= idx ? stateColor(app.state) : 'rgba(255,255,255,0.05)'}} />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Certificates */}
      
        {certificates.length === 0 && (
          <EmptyState icon={Award} title="No Certificates Yet" description="Certificates are issued after your system passes the 72-hour CAT-72 conformance test. Submit an application to begin."  />
        )}
        {certificates.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Certificates</h2>
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} style={{padding: '16px', background: 'rgba(92,214,133,0.08)', border: '1px solid rgba(92,214,133,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.accentGreen, marginBottom: '4px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '14px'}}>{cert.certificate_number}</div>
                  <div style={{fontSize: '12px', color: styles.textTertiary}}>Issued: {new Date(cert.issued_at).toLocaleDateString()}{cert.expires_at ? ` · Expires: ${new Date(cert.expires_at).toLocaleDateString()}` : ''}</div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <a href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`}
                     target="_blank"
                     style={{padding: '8px 16px', background: styles.purplePrimary, borderRadius: '6px', color: '#fff', fontSize: '11px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textDecoration: 'none'}}>
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}



      {/* Recent Activity */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Recent Activity</h2>
          <Link to="/my-activity" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px'}}>View All →</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p style={{color: styles.textTertiary, fontSize: '13px', textAlign: 'center', padding: '20px 0'}}>No activity yet</p>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '1px'}}>
            {recentActivity.map((log, i) => {
              const actionLabels = {
                user_login: 'Signed in',
                user_registered: 'Account created',
                login_failed: 'Failed login attempt',
                application_submitted: 'Application submitted',
                application_state_changed: 'Application status updated',
                application_deleted: 'Application deleted',
                test_created: 'CAT-72 test scheduled',
                test_started: 'CAT-72 test started',
                test_completed: 'CAT-72 test completed',
                certificate_issued: 'Certificate issued',
                certificate_suspended: 'Certificate suspended',
                certificate_revoked: 'Certificate revoked',
                certificate_reinstated: 'Certificate reinstated',
                api_key_created: 'API key created',
                api_key_revoked: 'API key revoked',
                password_changed: 'Password changed',
                profile_updated: 'Profile updated',
                '2fa_enabled': 'Two-factor authentication enabled',
                '2fa_disabled': 'Two-factor authentication disabled',
              };
              const actionColors = {
                user_login: styles.textTertiary,
                login_failed: '#D65C5C',
                application_submitted: styles.purpleBright,
                application_state_changed: styles.accentAmber,
                test_created: styles.purpleBright,
                test_started: styles.accentAmber,
                test_completed: styles.accentGreen,
                certificate_issued: styles.accentGreen,
                certificate_suspended: styles.accentAmber,
                certificate_revoked: '#D65C5C',
                api_key_created: styles.purpleBright,
                api_key_revoked: '#D65C5C',
              };
              const label = actionLabels[log.action] || log.action.replace(/_/g, ' ');
              const color = actionColors[log.action] || styles.textSecondary;
              const detail = log.details?.system_name || log.details?.application_number || log.details?.test_id || log.details?.certificate_number || log.details?.key_name || '';
              const timeAgo = (ts) => {
                const diff = Date.now() - new Date(ts).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return 'just now';
                if (mins < 60) return mins + 'm ago';
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return hrs + 'h ago';
                const days = Math.floor(hrs / 24);
                return days + 'd ago';
              };
              return (
                <div key={log.id || i} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}>
                  <div style={{width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0}} />
                  <div style={{flex: 1, minWidth: 0}}>
                    <span style={{fontSize: '13px', color: styles.textPrimary}}>{label}</span>
                    {detail && <span style={{fontSize: '12px', color: styles.textTertiary, marginLeft: '8px'}}>{detail}</span>}
                  </div>
                  <span style={{fontSize: '11px', color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", flexShrink: 0}}>{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

    </div>
  );
}


// Role-based dashboard routing

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Dashboard />;
  }
  return <CustomerDashboard />;
}


function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [activeTests, setActiveTests] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [recentCerts, setRecentCerts] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = (manual) => {
    if (manual) setRefreshing(true);
    api.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
    api.get('/api/dashboard/recent-applications').then(res => setRecentApps(res.data)).catch(console.error);
    api.get('/api/dashboard/active-tests').then(res => setActiveTests(res.data)).catch(console.error);
    api.get('/api/applications/').then(res => setAllApps(res.data.applications || res.data || [])).catch(console.error);
    api.get('/api/dashboard/recent-certificates').then(res => setRecentCerts(res.data)).catch(console.error);
    api.get('/api/envelo/monitoring/overview').then(res => setMonitoring(res.data)).catch(console.error);
    if (manual) setTimeout(() => setRefreshing(false), 800);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Pipeline breakdown
  const pipeline = {
    pending: allApps.filter(a => a.state === 'pending').length,
    under_review: allApps.filter(a => a.state === 'under_review').length,
    approved: allApps.filter(a => a.state === 'approved').length,
    testing: allApps.filter(a => a.state === 'testing').length,
    conformant: allApps.filter(a => a.state === 'conformant').length,
    revoked: allApps.filter(a => a.state === 'revoked' || a.state === 'suspended').length,
  };

  const needsAction = allApps.filter(a => a.state === 'pending' || a.state === 'under_review');

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({title: 'Confirm', message: label + '?'})) return;
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      // Auto-provision API key when approving
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, {
            params: { application_id: appId, send_email: true }
          });
          toast.show('Approved — API key provisioned and emailed to applicant', 'success');
        } catch (provErr) {
          // Non-fatal: key may already exist or endpoint may not support it yet
          toast.show('Approved — applicant can generate key from their dashboard', 'success');
        }
      }
      loadData();
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  return (
    <div className="space-y-6" style={{maxWidth: "1200px", margin: "0 auto"}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{width: '24px', height: '1px', background: styles.purpleBright}}></span>
            Administration
          </p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>
          <p style={{color: styles.textTertiary, marginTop: '6px', fontSize: '13px', fontFamily: "Consolas, 'IBM Plex Mono', monospace"}}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={() => loadData(true)} style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, borderRadius: '10px', padding: '10px 16px', color: styles.textSecondary, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'}}><RefreshCw fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={14} style={refreshing ? {animation: "spin 0.8s linear infinite"} : {}} /> {refreshing ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      {/* Stats Row */}
      {(() => {
        const onlineAgents = monitoring?.sessions?.filter(s => {
          const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
          return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000;
        }).length || monitoring?.summary?.active || 0;
        const expiringCount = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000)).length;
        const actionCount = needsAction.length + expiringCount;
        return (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
            <StatCard label="Total Applications" value={stats?.total_applications || 0} color={styles.purpleBright} icon={<FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} />
            <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={stats?.active_tests || 0} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentAmber}} />} />
            <StatCard label="Active Certificates" value={stats?.certificates_active || 0} color={styles.accentGreen} icon={<Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.accentGreen}} />} />
            <StatCard label="Online Agents" value={onlineAgents} color={onlineAgents > 0 ? styles.accentGreen : styles.textTertiary} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: onlineAgents > 0 ? styles.accentGreen : styles.textTertiary}} />} />
            <StatCard label="Certificates Issued" value={stats?.certificates_issued || 0} color={styles.purpleBright} icon={<Award fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: styles.purpleBright}} />} />
            <StatCard label="Needs Action" value={actionCount} color={actionCount > 0 ? '#D6A05C' : styles.textTertiary} icon={<AlertCircle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{color: actionCount > 0 ? '#D6A05C' : styles.textTertiary}} />} />
          </div>
        );
      })()}

      {/* Pipeline Breakdown */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Certification Pipeline</h2>
          <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{allApps.length} total</span>
        </div>
        <div style={{display: 'flex', gap: '4px', height: '32px', borderRadius: '6px', overflow: 'hidden'}}>
          {[
            { key: 'pending', label: 'Pending', color: '#D6A05C', count: pipeline.pending },
            { key: 'under_review', label: 'Review', color: '#D6A05C', count: pipeline.under_review },
            { key: 'approved', label: 'Approved', color: styles.purpleBright, count: pipeline.approved },
            { key: 'testing', label: 'Testing', color: styles.purpleBright, count: pipeline.testing },
            { key: 'conformant', label: 'Conformant', color: styles.accentGreen, count: pipeline.conformant },
            { key: 'revoked', label: 'Suspended', color: styles.accentRed, count: pipeline.revoked },
          ].map(stage => {
            const total = allApps.length || 1;
            const pct = Math.max((stage.count / total) * 100, stage.count > 0 ? 8 : 0);
            return stage.count > 0 ? (
              <div key={stage.key} style={{width: `${pct}%`, background: `${stage.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', position: 'relative', borderLeft: `2px solid ${stage.color}`}} title={`${stage.label}: ${stage.count}`}>
                <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: stage.color, whiteSpace: 'nowrap'}}>{stage.count} {stage.label}</span>
              </div>
            ) : null;
          })}
          {allApps.length === 0 && <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', padding: '40px 20px', textAlign: 'center'}}>
            <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(91,75,138,0.12)', border: '1px solid rgba(157,140,207,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'}}><FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={22} style={{color: styles.purpleBright, opacity: 0.6}} /></div>
            <p style={{color: styles.textSecondary, fontSize: '14px', fontWeight: 500, margin: '0 0 6px 0'}}>No applications yet</p>
            <p style={{color: styles.textTertiary, fontSize: '12px', margin: '0 0 16px 0', maxWidth: '260px'}}>Submit your first ODDC certification application to get started.</p>

          </div>}
        </div>
      </Panel>

      {/* Review Queue */}
      {needsAction.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0}}>⚡ Review Queue ({needsAction.length})</h2>
            <Link to="/applications" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
          </div>
          <div className="space-y-3">
            {needsAction.slice(0, 5).map(app => (
              <div key={app.id} style={{padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <Link to={`/applications/${app.id}`} style={{color: styles.purpleBright, textDecoration: 'none', fontWeight: 500, fontSize: '14px'}}>{app.system_name}</Link>
                  <span style={{color: styles.textTertiary, fontSize: '12px'}}>{app.organization_name}</span>
                  <span className="px-2 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>{app.state?.replace('_', ' ')}</span>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  {app.state === 'pending' && (
                    <button onClick={() => handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`)} className="px-3 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Begin Review</button>
                  )}
                  <button onClick={() => handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`)} className="px-3 py-1 rounded" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Approve</button>
                  <button onClick={() => handleQuickAdvance(app.id, 'suspended', `Suspend ${app.system_name}`)} className="px-3 py-1 rounded" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Suspend</button>
                  <Link to={`/applications/${app.id}`} className="px-3 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.1)', border: `1px solid ${styles.borderGlass}`, color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>View</Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Active CAT-72 Tests</h2>
            <Link to="/cat72" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>Console →</Link>
          </div>
          <div className="space-y-3">
            {activeTests.map((test) => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id} className="p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`}}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.organization_name} — {test.system_name}</span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{hoursLeft}h remaining</span>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentAmber}}>{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                    <div className="h-full rounded-full transition-all" style={{width: `${pct}%`, background: pct >= 100 ? styles.accentGreen : styles.purpleBright}} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Expiring Certificates Warning */}
      {(() => {
        const expiring = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000));
        if (expiring.length === 0) return null;
        return (
          <div style={{background: 'rgba(214,160,92,0.08)', border: '1px solid rgba(214,160,92,0.25)', borderRadius: '12px', padding: '16px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
              <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={16} style={{color: '#D6A05C'}} />
              <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#D6A05C', fontWeight: 500}}>{expiring.length} Certificate{expiring.length > 1 ? 's' : ''} Expiring Within 30 Days</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {expiring.map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
                return (
                  <div key={c.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 14px'}}>
                    <div>
                      <span style={{color: styles.textPrimary, fontWeight: 500, fontSize: '13px'}}>{c.system_name}</span>
                      <span style={{color: styles.textTertiary, fontSize: '12px', marginLeft: '12px'}}>{c.organization_name}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: daysLeft <= 7 ? '#D65C5C' : '#D6A05C', fontWeight: 500}}>{daysLeft}d remaining</span>
                      <Link to={`/verify?cert=${c.certificate_number}`} style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>{c.certificate_number}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Recent Certificates */}
      {recentCerts.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Recent Certificates</h2>
            <Link to="/certificates" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                  {['Certificate', 'System', 'Status', 'Issued', 'Expires'].map(h => (
                    <th key={h} className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCerts.slice(0, 5).map(c => (
                  <tr key={c.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                    <td className="px-4 py-3"><Link to={`/verify?cert=${c.certificate_number}`} style={{color: styles.purpleBright, textDecoration: 'none', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px'}}>{c.certificate_number}</Link></td>
                    <td className="px-4 py-3"><span style={{color: styles.textPrimary, fontSize: '13px'}}>{c.system_name}</span><span style={{color: styles.textTertiary, fontSize: '11px', marginLeft: '8px'}}>{c.organization_name}</span></td>
                    <td className="px-4 py-3"><span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: c.state === 'conformant' ? 'rgba(92,214,133,0.15)' : 'rgba(214,92,92,0.15)', color: c.state === 'conformant' ? styles.accentGreen : '#D65C5C'}}>{c.state}</span></td>
                    <td className="px-4 py-3" style={{color: styles.textTertiary, fontSize: '13px'}}>{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: c.expires_at && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000) ? '#D6A05C' : styles.textTertiary}}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Recent Applications */}
      <Panel>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Recent Applications</h2>
          <Link to="/applications" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app) => (
                <tr key={app.id} className="transition-colors cursor-pointer" style={{borderBottom: `1px solid ${styles.borderGlass}`}} onClick={() => window.location.hash = `#/applications/${app.id}`}>
                  <td className="px-4 py-3"><Link to={`/applications/${app.id}`} style={{color: styles.purpleBright, textDecoration: 'none'}}>{app.system_name}</Link></td>
                  <td className="px-4 py-3" style={{color: styles.textSecondary}}>{app.organization_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs" style={{
                      background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'observe' ? 'rgba(157,140,207,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
                      color: app.state === 'conformant' ? styles.accentGreen : app.state === 'observe' ? styles.purpleBright : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
                      fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    }}>{app.state}</span>
                  </td>
                  <td className="px-4 py-3" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// Applications List

export { CustomerDashboard, RoleBasedDashboard };
export default Dashboard;

