import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Wifi, FileText, Activity, Award, AlertTriangle, Plus, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import BrandMark from '../components/BrandMark';
import EmptyState from '../components/EmptyState';
import useIsMobile from '../hooks/useIsMobile';

function CustomerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: appData, isLoading: loading } = useQuery({
    queryKey: ['dashboard-applicant'],
    queryFn: () => Promise.all([
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
      api.get('/api/audit/my-logs?limit=5&offset=0').catch(() => ({ data: { logs: [] } }))
    ]).then(([appsRes, certsRes, monRes, actRes]) => ({
      applications: appsRes.data.applications || appsRes.data || [],
      certificates: certsRes.data || [],
      monitoring: monRes.data || null,
      recentActivity: actRes.data.logs || actRes.data || [],
    })),
    refetchInterval: 60000,
    retry: false,
  });
  const applications = appData?.applications || [];
  const certificates = appData?.certificates || [];
  const monitoring = appData?.monitoring || null;
  const recentActivity = appData?.recentActivity || [];

  const STAGES = [
    { key: 'pending',      label: 'Submitted' },
    { key: 'under_review', label: 'In Review' },
    { key: 'approved',     label: 'Approved' },
    { key: 'testing',      label: 'Testing' },
    { key: 'conformant',   label: 'Conformant' },
  ];

  const stageIdx = (state) => STAGES.findIndex(s => s.key === state);

  const nextAction = (state) => {
    switch (state) {
      case 'pending':      return 'Awaiting review';
      case 'under_review': return 'Under evaluation';
      case 'approved':     return 'Preparing CAT-72 test';
      case 'testing':      return 'ENVELO Interlock test in progress';
      case 'conformant':   return 'Certificate issued';
      case 'revoked':      return 'Suspended — contact support';
      default:             return 'Pending';
    }
  };

  const stateColor = (state) => {
    if (state === 'conformant')                       return styles.accentGreen;
    if (state === 'revoked' || state === 'suspended') return styles.accentRed;
    if (state === 'testing' || state === 'approved')  return styles.purpleBright;
    return styles.accentAmber;
  };

  const timeAgo = (ts) => {
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(ts).toLocaleDateString();
  };

  if (loading) return (
    <div style={{ color: styles.textTertiary, padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center' }}>Loading…</div>
  );

  return (
    <div className="space-y-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>ODDC Certification</p>
          <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>Welcome{user?.full_name ? ', ' + user.full_name.split(' ')[0] : ''}</h1>
          <p style={{ color: styles.textSecondary, marginTop: '8px' }}>{user?.organization ? user.organization + ' · ' : ''}Track your certification progress and manage your systems.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '140px' : '200px'}, 1fr))`, gap: isMobile ? '10px' : '16px' }}>
        <StatCard onClick={() => navigate('/applications')} label="Applications" value={applications.length} color={styles.purpleBright} icon={<FileText fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: styles.purpleBright }} />} subtitle={applications.filter(a => a.state === 'pending' || a.state === 'under_review').length > 0 ? applications.filter(a => a.state === 'pending' || a.state === 'under_review').length + ' in review' : null} />
        <StatCard onClick={() => navigate('/certificates')} label="Certificates" value={certificates.length} color={styles.accentGreen} icon={<Award fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: styles.accentGreen }} />} subtitle={certificates.filter(c => c.state === 'conformant').length > 0 ? certificates.filter(c => c.state === 'conformant').length + ' active' : null} />
        <StatCard onClick={() => navigate('/cat72')} label="Active Tests" value={applications.filter(a => a.state === 'testing').length} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: styles.accentAmber }} />} />
        {(() => {
          const sessions = monitoring?.sessions || [];
          const online = sessions.filter(s => { const la = s.last_heartbeat_at || s.last_telemetry_at || s.last_activity || s.started_at; return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000; }).length;
          const total = monitoring?.summary?.total || 0;
          const hasInterlocks = total > 0;
          const statusColor = hasInterlocks ? (online > 0 ? styles.accentGreen : styles.accentAmber) : styles.textTertiary;
          const statusText = hasInterlocks ? (online > 0 ? online + ' of ' + total + ' online' : 'All interlocks offline') : 'No active interlocks';
          return <StatCard onClick={() => navigate('/monitoring')} label="Live Interlocks" value={hasInterlocks ? online : '—'} color={statusColor} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: statusColor }} />} subtitle={statusText} />;
        })()}
      </div>

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Your Applications</h2>
          {applications.length > 0 && <Link to="/applications" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px' }}>View All →</Link>}
        </div>
        {applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px' }}>
            <div style={{ margin: '0 auto 20px', width: 72, height: 72 }}>
              <BrandMark size={72} />
            </div>
            <p style={{ color: styles.textPrimary, fontSize: '17px', fontWeight: 500, marginBottom: '8px', fontFamily: "Georgia, 'Source Serif 4', serif" }}>Begin Your Certification</p>
            <p style={{ color: styles.textTertiary, fontSize: '13px', maxWidth: '380px', margin: '0 auto 28px', lineHeight: '1.6' }}>Submit your autonomous system for ODDC certification. The CAT-72 test verifies your system's ENVELO Interlock is enforcing ODD boundaries in real time across a continuous 72-hour window.</p>
            <Link to="/applications/new" style={{ display: 'inline-block', background: styles.purplePrimary, color: '#fff', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', border: 'none' }}>
              + New Application
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const idx = stageIdx(app.state);
              const isStuck = ['pending', 'under_review'].includes(app.state) && app.updated_at;
              const stuckDays = isStuck ? Math.floor((Date.now() - new Date(app.updated_at).getTime()) / (1000*60*60*24)) : 0;
              return (
                <Link key={app.id} to={'/applications/' + app.id} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ padding: '20px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = styles.purpleBright} onMouseLeave={e => e.currentTarget.style.borderColor = styles.borderGlass}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 500, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px' }}>{app.system_name}</div>
                        <div style={{ fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono }}>{app.application_number} · {app.system_type?.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: styles.textTertiary }}>{nextAction(app.state)}</span>
                        {isStuck && stuckDays > 3 && <span style={{ fontSize: '11px', color: styles.accentAmber, fontFamily: styles.mono }}>{stuckDays}d in queue</span>}
                        <span style={{ padding: '4px 12px', fontSize: '10px', fontFamily: styles.mono, textTransform: 'uppercase', letterSpacing: '1px', background: stateColor(app.state) + '06', color: stateColor(app.state), border: '1px solid ' + stateColor(app.state) + '10' }}>{app.state}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '3px', height: '4px' }}>
                      {STAGES.map((s, i) => <div key={s.key} style={{ flex: 1, background: i <= idx ? stateColor(app.state) : 'rgba(0,0,0,0.05)' }} />)}
                    </div>
                    {['pending', 'under_review'].includes(app.state) && (
                      <div style={{ marginTop: '12px', fontSize: '11px', color: styles.textTertiary }}>
                        Questions about this review? <a href="mailto:review@sentinelauthority.org" style={{ color: styles.purpleBright, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>Contact your review officer →</a>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      {certificates.length === 0 ? (
        <EmptyState icon={Award} title="No Certificates Yet" description="Certificates are issued after your system passes the 72-hour CAT-72 ENVELO Interlock conformance test. Submit an application to begin." />
      ) : (
        <Panel>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px' }}>Your Certificates</h2>
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} style={{ padding: '16px', background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, color: styles.accentGreen, marginBottom: '4px', fontFamily: styles.mono, fontSize: '14px' }}>{cert.certificate_number}</div>
                  <div style={{ fontSize: '12px', color: styles.textTertiary }}>Issued: {new Date(cert.issued_at).toLocaleDateString()}{cert.expires_at ? ' · Expires: ' + new Date(cert.expires_at).toLocaleDateString() : ''}</div>
                </div>
                <a href={API_BASE + '/api/certificates/' + cert.certificate_number + '/pdf'} target="_blank" rel="noreferrer noopener" style={{ padding: '8px 16px', background: 'transparent', color: styles.purpleBright, fontSize: '11px', fontFamily: styles.mono, textDecoration: 'none' }}>Download PDF</a>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Recent Activity</h2>
          <Link to="/my-activity" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px' }}>View All →</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p style={{ color: styles.textTertiary, fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No activity yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {recentActivity.map((log, i) => {
              const actionLabels = { user_login: 'Signed in', user_registered: 'Account created', login_failed: 'Failed login attempt', application_submitted: 'Application submitted', application_state_changed: 'Application status updated', application_deleted: 'Application deleted', test_created: 'CAT-72 test scheduled', test_started: 'CAT-72 test started', test_completed: 'CAT-72 test completed', certificate_issued: 'Certificate issued', certificate_suspended: 'Certificate suspended', certificate_revoked: 'Certificate revoked', certificate_reinstated: 'Certificate reinstated', api_key_created: 'API key created', api_key_revoked: 'API key revoked', password_changed: 'Password changed', profile_updated: 'Profile updated', '2fa_enabled': 'Two-factor authentication enabled', '2fa_disabled': 'Two-factor authentication disabled' };
              const actionColors = { user_login: styles.textTertiary, login_failed: styles.accentRed, application_submitted: styles.purpleBright, application_state_changed: styles.accentAmber, test_created: styles.purpleBright, test_started: styles.accentAmber, test_completed: styles.accentGreen, certificate_issued: styles.accentGreen, certificate_suspended: styles.accentAmber, certificate_revoked: styles.accentRed, api_key_created: styles.purpleBright, api_key_revoked: styles.accentRed };
              const label = actionLabels[log.action] || log.action.replace(/_/g, ' ');
              const color = actionColors[log.action] || styles.textSecondary;
              const detail = log.details?.system_name || log.details?.application_number || log.details?.test_id || log.details?.certificate_number || log.details?.key_name || '';
              return (
                <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid ' + styles.borderSubtle : 'none' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: styles.textPrimary }}>{label}</span>
                    {detail && <span style={{ fontSize: '12px', color: styles.textTertiary, marginLeft: '8px' }}>{detail}</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono, flexShrink: 0 }}>{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);
  const { data: adminData, refetch } = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: () => Promise.all([
      api.get('/api/dashboard/stats').catch(() => ({ data: null })),
      api.get('/api/dashboard/recent-applications').catch(() => ({ data: [] })),
      api.get('/api/dashboard/active-tests').catch(() => ({ data: [] })),
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/dashboard/recent-certificates').catch(() => ({ data: [] })),
      api.get('/api/envelo/monitoring/overview').catch(() => ({ data: null })),
      api.get('/api/audit/admin-logs?limit=8&offset=0').catch(() => ({ data: { logs: [] } }))
    ]).then(([statsR, recentR, testsR, appsR, certsR, monR, actR]) => ({
      stats: statsR.data,
      recentApps: recentR.data,
      activeTests: testsR.data,
      allApps: appsR.data.applications || appsR.data || [],
      recentCerts: certsR.data,
      monitoring: monR.data,
      recentActivity: actR.data.logs || actR.data || [],
    })),
    refetchInterval: 30000,
    retry: false,
  });
  const stats = adminData?.stats || null;
  const recentApps = adminData?.recentApps || [];
  const activeTests = adminData?.activeTests || [];
  const allApps = adminData?.allApps || [];
  const recentCerts = adminData?.recentCerts || [];
  const monitoring = adminData?.monitoring || null;
  const recentActivity = adminData?.recentActivity || [];
  const [justifyModal, setJustifyModal] = useState(null);
  const [justifyNote, setJustifyNote] = useState('');

  const loadData = (manual) => {
    if (manual) { setRefreshing(true); refetch().finally(() => setTimeout(() => setRefreshing(false), 800)); }
  };

  const pipeline = {
    pending: allApps.filter(a => a.state === 'pending').length,
    under_review: allApps.filter(a => a.state === 'under_review').length,
    approved: allApps.filter(a => a.state === 'approved').length,
    testing: allApps.filter(a => a.state === 'testing').length,
    conformant: allApps.filter(a => a.state === 'conformant').length,
    revoked: allApps.filter(a => a.state === 'revoked' || a.state === 'suspended').length,
  };

  const needsAction = allApps.filter(a => a.state === 'pending' || a.state === 'under_review');

  const openJustify = (appId, newState, label) => { setJustifyNote(''); setJustifyModal({ appId, newState, label }); };

  const submitJustify = async () => {
    if (!justifyNote.trim()) { toast.show('A justification note is required', 'error'); return; }
    const { appId, newState, label } = justifyModal;
    setJustifyModal(null);
    try {
      await api.patch('/api/applications/' + appId + '/state?new_state=' + newState, { note: justifyNote });
      if (newState === 'approved') {
        try { await api.post('/api/apikeys/admin/provision', null, { params: { application_id: appId, send_email: true } }); toast.show('Approved — API key provisioned and emailed to applicant', 'success'); }
        catch { toast.show('Approved — applicant can generate key from their dashboard', 'success'); }
      } else { toast.show(label + ' recorded', newState === 'suspended' ? 'error' : 'success'); }
      loadData();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleBeginReview = async (appId, appName) => {
    if (!await confirm({ title: 'Begin Review', message: 'Start review for ' + appName + '?' })) return;
    try { await api.patch('/api/applications/' + appId + '/state?new_state=under_review'); toast.show('Review started', 'success'); loadData(); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const timeAgo = (ts) => { if (!ts) return ''; const diff = Date.now() - new Date(ts).getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return 'just now'; if (mins < 60) return mins + 'm ago'; const hrs = Math.floor(mins / 60); if (hrs < 24) return hrs + 'h ago'; return Math.floor(hrs / 24) + 'd ago'; };

  const adminActivityLabels = { application_state_changed: 'Status changed', application_submitted: 'Application received', certificate_issued: 'Certificate issued', certificate_suspended: 'Certificate suspended', certificate_revoked: 'Certificate revoked', certificate_reinstated: 'Certificate reinstated', test_created: 'CAT-72 test created', test_started: 'CAT-72 test started', test_completed: 'CAT-72 test completed', user_registered: 'New account registered', api_key_created: 'API key provisioned', api_key_revoked: 'API key revoked' };
  const adminActivityColors = { certificate_issued: styles.accentGreen, certificate_revoked: styles.accentRed, certificate_suspended: styles.accentAmber, application_state_changed: styles.accentAmber, test_completed: styles.accentGreen, test_started: styles.purpleBright, user_registered: styles.purpleBright };

  return (
    <div className="space-y-6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>Administration
          </p>
          <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>Welcome{user?.full_name ? ', ' + user.full_name.split(' ')[0] : ''}</h1>
          <p style={{ color: styles.textTertiary, marginTop: '6px', fontSize: '13px', fontFamily: styles.mono }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => loadData(true)} style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '10px 16px', color: styles.textSecondary, cursor: 'pointer', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {(() => {
        const onlineInterlocks = monitoring?.sessions?.filter(s => { const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at; return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000; }).length || monitoring?.summary?.active || 0;
        const expiringCount = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000)).length;
        const actionCount = needsAction.length + expiringCount;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '140px' : '220px'}, 1fr))`, gap: isMobile ? '10px' : '16px' }}>
            <StatCard onClick={() => navigate('/applications')} label="Needs Action" value={actionCount} color={actionCount > 0 ? styles.accentAmber : styles.textTertiary} icon={<AlertCircle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: actionCount > 0 ? styles.accentAmber : styles.textTertiary }} />} subtitle={actionCount > 0 ? needsAction.length + ' pending · ' + expiringCount + ' expiring' : 'All clear'} />
            <StatCard onClick={() => navigate('/cat72')} label="Active Tests" value={stats?.active_tests || 0} color={styles.accentAmber} icon={<Activity fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: styles.accentAmber }} />} />
            <StatCard onClick={() => navigate('/certificates')} label="Active Certificates" value={stats?.certificates_active || 0} color={styles.accentGreen} icon={<BrandMark size={20} />} />
            <StatCard onClick={() => navigate('/monitoring')} label="Online Interlocks" value={onlineInterlocks} color={onlineInterlocks > 0 ? styles.accentGreen : styles.textTertiary} icon={<Wifi fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-5 h-5" style={{ color: onlineInterlocks > 0 ? styles.accentGreen : styles.textTertiary }} />} subtitle={monitoring?.summary?.total ? 'of ' + monitoring.summary.total + ' registered' : null} />
          </div>
        );
      })()}

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Certification Pipeline</h2>
          <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{allApps.length} total</span>
        </div>
        {allApps.length === 0 ? (
          <p style={{ color: styles.textTertiary, fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No applications yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { key: 'pending', label: 'Pending', color: styles.accentAmber, count: pipeline.pending },
              { key: 'under_review', label: 'In Review', color: styles.accentAmber, count: pipeline.under_review },
              { key: 'approved', label: 'Approved', color: styles.purpleBright, count: pipeline.approved },
              { key: 'testing', label: 'Testing', color: styles.purpleBright, count: pipeline.testing },
              { key: 'conformant', label: 'Conformant', color: styles.accentGreen, count: pipeline.conformant },
              { key: 'revoked', label: 'Suspended', color: styles.accentRed, count: pipeline.revoked },
            ].filter(s => s.count > 0).map(stage => {
              const pct = Math.max((stage.count / allApps.length) * 100, 4);
              return (
                <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, width: isMobile ? '60px' : '80px', textAlign: 'right', flexShrink: 0 }}>{stage.label}</span>
                  <div style={{ flex: 1, height: '20px', background: 'rgba(0,0,0,0.03)', position: 'relative' }}>
                    <div style={{ width: pct + '%', height: '100%', background: stage.color + '14', borderLeft: '3px solid ' + stage.color, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontFamily: styles.mono, fontSize: '12px', color: stage.color, width: '24px', flexShrink: 0 }}>{stage.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {needsAction.length > 0 && (
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0 }}>⚡ Review Queue ({needsAction.length})</h2>
            <Link to="/applications" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>View All →</Link>
          </div>
          <div className="space-y-3">
            {needsAction.slice(0, 5).map(app => (
              <div key={app.id} style={{ padding: isMobile ? '12px' : '14px 16px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flexWrap: 'wrap' }}>
                  <Link to={'/applications/' + app.id} style={{ color: styles.purpleBright, textDecoration: 'none', fontWeight: 500, fontSize: '14px' }}>{app.system_name}</Link>
                  <span style={{ color: styles.textTertiary, fontSize: '12px' }}>{app.organization_name}</span>
                  <span style={{ color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{app.state?.replace('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                  {app.state === 'pending' && <button onClick={() => handleBeginReview(app.id, app.system_name)} style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 10px', borderRadius: 8 }}>Begin Review</button>}
                  <button onClick={() => openJustify(app.id, 'approved', 'Approve ' + app.system_name)} style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 10px', borderRadius: 8 }}>Approve</button>
                  <button onClick={() => openJustify(app.id, 'suspended', 'Suspend ' + app.system_name)} style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentRed, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 10px', borderRadius: 8 }}>Suspend</button>
                  <Link to={'/applications/' + app.id} style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none', padding: '4px 10px' }}>View</Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {justifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', border: '1px solid ' + styles.borderGlass, padding: isMobile ? '20px 16px' : '32px', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontWeight: 400, fontSize: '20px', marginBottom: '8px' }}>{justifyModal.label}</h3>
            <p style={{ color: styles.textTertiary, fontSize: '13px', marginBottom: '20px' }}>A justification note is required for all certification decisions. This is recorded in the audit log.</p>
            <textarea autoFocus value={justifyNote} onChange={e => setJustifyNote(e.target.value)} placeholder="Describe the basis for this decision…" rows={4} style={{ width: '100%', padding: '12px', border: '1px solid ' + styles.borderGlass, fontFamily: styles.mono, fontSize: '13px', color: styles.textPrimary, background: styles.cardSurface, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setJustifyModal(null)} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitJustify} style={{ padding: '8px 20px', background: justifyModal.newState === 'suspended' ? styles.accentRed : styles.accentGreen, border: 'none', color: '#fff', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Confirm {justifyModal.newState === 'suspended' ? 'Suspension' : 'Approval'}</button>
            </div>
          </div>
        </div>
      )}

      {activeTests.length > 0 && (
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Active CAT-72 Tests</h2>
            <Link to="/cat72" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>Console →</Link>
          </div>
          <div className="space-y-3">
            {activeTests.map(test => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id} style={{ padding: '16px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright }}>{test.organization_name} — {test.system_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{hoursLeft}h remaining</span>
                      <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.accentAmber }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.05)' }}>
                    <div style={{ width: pct + '%', height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purpleBright, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {(() => {
        const expiring = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000));
        if (expiring.length === 0) return null;
        return (
          <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, padding: '16px', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={16} style={{ color: styles.accentAmber }} />
              <span style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.accentAmber }}>{expiring.length} Certificate{expiring.length > 1 ? 's' : ''} Expiring Within 30 Days</span>
            </div>
            {expiring.map(c => {
              const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '10px 0', borderTop: '1px solid ' + styles.borderSubtle }}>
                  <div>
                    <span style={{ color: styles.textPrimary, fontWeight: 500, fontSize: '13px' }}>{c.system_name}</span>
                    <span style={{ color: styles.textTertiary, fontSize: '12px', marginLeft: '12px' }}>{c.organization_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: styles.mono, fontSize: '11px', color: daysLeft <= 7 ? styles.accentRed : styles.accentAmber }}>{daysLeft}d remaining</span>
                    <Link to={'/verify?cert=' + c.certificate_number} style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>{c.certificate_number}</Link>
                    <button onClick={async () => { try { await api.post('/api/certificates/' + c.id + '/notify-renewal'); toast.show('Renewal notice sent to ' + c.organization_name, 'success'); } catch { toast.show('Could not send notice — contact licensee directly', 'error'); } }} style={{ background: 'transparent', border: '1px solid ' + styles.accentAmber + '40', color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '3px 8px', borderRadius: 4 }}>Notify</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {recentCerts.length > 0 && (
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Recent Certificates</h2>
            <Link to="/certificates" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>View All →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid ' + styles.borderGlass }}>
                  {['Certificate', 'System', 'Status', 'Issued', 'Expires'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {recentCerts.slice(0, 5).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid ' + styles.borderGlass }}>
                    <td style={{ padding: '12px 16px' }}><Link to={'/verify?cert=' + c.certificate_number} style={{ color: styles.purpleBright, textDecoration: 'none', fontFamily: styles.mono, fontSize: '12px' }}>{c.certificate_number}</Link></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ color: styles.textPrimary, fontSize: '13px' }}>{c.system_name}</span><span style={{ color: styles.textTertiary, fontSize: '11px', marginLeft: '8px' }}>{c.organization_name}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 8px', background: c.state === 'conformant' ? 'rgba(22,135,62,0.06)' : 'rgba(180,52,52,0.06)', color: c.state === 'conformant' ? styles.accentGreen : styles.accentRed }}>{c.state}</span></td>
                    <td style={{ padding: '12px 16px', color: styles.textTertiary, fontSize: '13px' }}>{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', fontFamily: styles.mono, fontSize: '12px', color: c.expires_at && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000) ? styles.accentAmber : styles.textTertiary }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Recent Applications</h2>
          <Link to="/applications" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>View All →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid ' + styles.borderGlass }}>
                {['System', 'Organization', 'State', 'Submitted'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recentApps.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid ' + styles.borderGlass }}>
                  <td style={{ padding: '12px 16px' }}><Link to={'/applications/' + app.id} style={{ color: styles.purpleBright, textDecoration: 'none' }}>{app.system_name}</Link></td>
                  <td style={{ padding: '12px 16px', color: styles.textSecondary }}>{app.organization_name}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: app.state === 'conformant' ? 'rgba(22,135,62,0.06)' : app.state === 'revoked' ? 'rgba(180,52,52,0.06)' : 'rgba(158,110,18,0.06)', color: app.state === 'conformant' ? styles.accentGreen : app.state === 'revoked' ? styles.accentRed : styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 8px' }}>{app.state}</span></td>
                  <td style={{ padding: '12px 16px', color: styles.textTertiary, fontSize: '13px' }}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>System Activity</h2>
          <Link to="/activity" style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none' }}>Full Log →</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p style={{ color: styles.textTertiary, fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No recent activity</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {recentActivity.map((log, i) => {
              const label = adminActivityLabels[log.action] || log.action.replace(/_/g, ' ');
              const color = adminActivityColors[log.action] || styles.textSecondary;
              const detail = log.details?.system_name || log.details?.application_number || log.details?.certificate_number || log.details?.organization_name || '';
              return (
                <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid ' + styles.borderSubtle : 'none' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: styles.textPrimary }}>{label}</span>
                    {detail && <span style={{ fontSize: '12px', color: styles.textTertiary, marginLeft: '8px' }}>{detail}</span>}
                    {log.actor_name && <span style={{ fontSize: '11px', color: styles.textTertiary, marginLeft: '8px', fontFamily: styles.mono }}>by {log.actor_name}</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono, flexShrink: 0 }}>{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Dashboard />;
  return <CustomerDashboard />;
}

export { CustomerDashboard, RoleBasedDashboard };
export default Dashboard;
