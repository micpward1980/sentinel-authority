import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wifi, FileText, Activity, Award, AlertTriangle, Plus, Download, RefreshCw, AlertCircle } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { api, API_BASE } from '../config/api';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';

/* ═══════════════════════════════════════
   CUSTOMER DASHBOARD
   ═══════════════════════════════════════ */
function CustomerDashboard() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
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
  const stateColor = (state) => {
    if (state === 'conformant') return 'var(--accent-green)';
    if (state === 'revoked' || state === 'suspended') return 'var(--accent-red)';
    if (state === 'testing' || state === 'approved') return 'var(--purple-bright)';
    return 'var(--accent-amber)';
  };
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

  if (loading) return <div className="hud-label" style={{padding:'60px',textAlign:'center'}}>Loading…</div>;

  const sessions = monitoring?.sessions || [];
  const online = sessions.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.last_activity || s.started_at;
    return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000;
  }).length;
  const totalSessions = monitoring?.summary?.total || 0;

  return (
    <div className='sa-dashboard' style={{maxWidth:'1000px',margin:'0 auto'}}>

      {/* ── Section Header ── */}
      <div style={{marginBottom:'32px'}}>
        <span className="hud-label" style={{color:'var(--purple-bright)',letterSpacing:'4px',display:'flex',alignItems:'center',gap:'12px',marginBottom:'10px'}}>
          <span style={{width:'24px',height:'1px',background:'var(--purple-bright)'}}></span>
          ODDC CERTIFICATION
        </span>
        <h1 style={{fontFamily:'var(--serif)',fontSize:'clamp(24px,4vw,32px)',fontWeight:200,margin:'0 0 6px',letterSpacing:'-0.02em'}}>
          Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p style={{color:'var(--text-tertiary)',fontFamily:'var(--mono)',fontSize:'11px',letterSpacing:'1px'}}>
          {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
          {user?.organization_name ? ` · ${user.organization_name}` : ''}
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className='sa-stat-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:'12px',marginBottom:'32px'}}>
        <StatCard onClick={() => navigate("/applications")} label="Applications" value={applications.length} color="var(--purple-bright)" icon={<FileText size={16} strokeWidth={1.5}/>}
          sublabel={applications.filter(a=>a.state==='pending'||a.state==='under_review').length>0 ? `${applications.filter(a=>a.state==='pending'||a.state==='under_review').length} in review` : null} />
        <StatCard onClick={() => navigate("/certificates")} label="Certificates" value={certificates.length} color="var(--accent-green)" icon={<Award size={16} strokeWidth={1.5}/>}
          sublabel={certificates.filter(c=>c.state==='conformant').length>0 ? `${certificates.filter(c=>c.state==='conformant').length} active` : null} />
        <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={applications.filter(a=>a.state==='testing').length} color="var(--accent-amber)" icon={<Activity size={16} strokeWidth={1.5}/>} />
        <StatCard onClick={() => navigate('/monitoring')} label="Live Status" value={totalSessions>0 ? online : '—'} color={totalSessions>0 ? (online>0?'var(--accent-green)':'var(--accent-amber)') : 'var(--text-tertiary)'} icon={<Wifi size={16} strokeWidth={1.5}/>}
          sublabel={totalSessions>0 ? (online>0?`${online} of ${totalSessions} online`:'All offline') : null} />
      </div>

      {/* ── Applications ── */}
      <div style={{marginBottom:'32px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <span className="hud-label">Your Applications</span>
          {applications.length>0 && <Link to="/applications" className="hud-link" style={{fontSize:'10px'}}>View All →</Link>}
        </div>
        {applications.length === 0 ? (
          <div className="hud-frame" style={{textAlign:'center',padding:'48px 20px'}}><i></i>
            <BrandMark size={28} />
            <p style={{fontFamily:'var(--serif)',fontSize:'17px',color:'var(--text-secondary)',marginBottom:'8px'}}>Begin Your Certification</p>
            <p style={{fontSize:'12px',color:'var(--text-tertiary)',maxWidth:'360px',margin:'0 auto 20px',lineHeight:1.7}}>Submit your autonomous system for ODDC certification. Our CAT-72 test validates real-time boundary enforcement over 72 hours.</p>
            <Link to="/applications/new" className="btn primary"><Plus size={12}/> New Application</Link>
          </div>
        ) : (
          <div className="hud-frame"><i></i>
            {applications.map((app, idx) => {
              const si = stageIdx(app.state);
              return (
                <Link key={app.id} to={`/applications/${app.id}`} style={{textDecoration:'none',display:'block'}}>
                  <div className="hud-row" style={{display:'flex',alignItems:'center',gap:'12px',cursor:'pointer',paddingTop:'14px',paddingBottom:'14px'}}>
                    <span className="hud-num" style={{minWidth:'20px'}}>{String(idx+1).padStart(2,'0')}</span>
                    <span className="hud-dot" style={{background:stateColor(app.state),marginRight:0}}></span>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="hud-title">{app.system_name}</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'1px',color:'var(--text-tertiary)',marginTop:'2px'}}>
                        {app.application_number} · {nextAction(app.state)}
                      </div>
                    </div>
                    <span style={{fontFamily:'var(--mono)',fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:stateColor(app.state)}}>{app.state?.replace(/_/g,' ')}</span>
                    {/* Mini progress */}
                    <div style={{display:'flex',gap:'2px',width:'60px'}}>
                      {STAGES.map((s,i) => (
                        <div key={s.key} className="sa-fill" style={{flex:1,height:'3px','--sa-bg':i<=si ? stateColor(app.state) : 'rgba(255,255,255,0.04)'}}/>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Certificates ── */}
      {certificates.length > 0 && (
        <div style={{marginBottom:'32px'}}>
          <span className="hud-label" style={{marginBottom:'16px',display:'block'}}>Your Certificates</span>
          <div className="hud-frame"><i></i>
            {certificates.map((cert,idx) => (
              <div key={cert.id} className="hud-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
                <div>
                  <div style={{fontFamily:'var(--mono)',fontSize:'13px',color:'var(--accent-green)',letterSpacing:'1px'}}>{cert.certificate_number}</div>
                  <div style={{fontSize:'11px',color:'var(--text-tertiary)',marginTop:'2px'}}>
                    Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}
                    {cert.expires_at ? ` · Expires: ${new Date(cert.expires_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <a href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`} target="_blank" className="btn" style={{padding:'6px 14px',fontSize:'9px'}}>
                  <Download size={11}/> PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {certificates.length === 0 && (
        <div style={{marginBottom:'32px'}}>
          <span className="hud-label" style={{marginBottom:'16px',display:'block'}}>Certificates</span>
          <div style={{textAlign:'center',padding:'32px 20px',borderTop:'none'}}>
            <p style={{fontSize:'12px',color:'var(--text-tertiary)',fontFamily:'var(--mono)',letterSpacing:'0.5px'}}>
              Certificates are issued after your system passes the 72-hour CAT-72 conformance test.
            </p>
          </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <span className="hud-label">Recent Activity</span>
          <Link to="/my-activity" className="hud-link" style={{fontSize:'10px'}}>View All →</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p style={{color:'var(--text-tertiary)',fontSize:'12px',fontFamily:'var(--mono)',textAlign:'center',padding:'20px 0'}}>No activity yet</p>
        ) : (
          <div className="hud-frame"><i></i>
            {recentActivity.map((log,i) => {
              const labels = {
                user_login:'Signed in', user_registered:'Account created', login_failed:'Failed login',
                application_submitted:'Application submitted', application_state_changed:'Status updated',
                application_deleted:'Application deleted', test_created:'CAT-72 test scheduled',
                test_started:'CAT-72 test started', test_completed:'CAT-72 test completed',
                certificate_issued:'Certificate issued', certificate_suspended:'Certificate suspended',
                certificate_revoked:'Certificate revoked', certificate_reinstated:'Certificate reinstated',
                api_key_created:'API key created', api_key_revoked:'API key revoked',
                password_changed:'Password changed', profile_updated:'Profile updated',
                '2fa_enabled':'2FA enabled', '2fa_disabled':'2FA disabled'
              };
              const dotColors = {
                certificate_issued:'var(--accent-green)', test_completed:'var(--accent-green)',
                certificate_revoked:'var(--accent-red)', login_failed:'var(--accent-red)', certificate_suspended:'var(--accent-amber)',
                application_submitted:'var(--purple-bright)', test_created:'var(--purple-bright)'
              };
              const label = labels[log.action] || log.action?.replace(/_/g,' ');
              const dotColor = dotColors[log.action] || 'rgba(157,140,207,0.5)';
              const detail = log.details?.system_name || log.details?.application_number || '';
              const timeAgo = (ts) => {
                const d = Date.now() - new Date(ts).getTime();
                const m = Math.floor(d/60000);
                if (m<1) return 'just now';
                if (m<60) return m+'m ago';
                const h = Math.floor(m/60);
                if (h<24) return h+'h ago';
                return Math.floor(h/24)+'d ago';
              };
              return (
                <div key={log.id||i} className="hud-row" style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <span className="hud-dot" style={{background:dotColor,marginRight:0}}></span>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{label}</span>
                    {detail && <span style={{fontSize:'11px',color:'var(--text-tertiary)',marginLeft:'8px'}}>{detail}</span>}
                  </div>
                  <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-tertiary)',letterSpacing:'0.5px',flexShrink:0}}>
                    {log.timestamp ? timeAgo(log.timestamp) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════
   ADMIN DASHBOARD
   ═══════════════════════════════════════ */
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
    // Recent apps now pulled from allApps (intake pipeline only)
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

  const pipeline = {
    pending: allApps.filter(a => a.state === 'pending').length,
    under_review: allApps.filter(a => a.state === 'under_review').length,
    approved: allApps.filter(a => a.state === 'approved').length,

  };
  const needsAction = allApps.filter(a => a.state === 'pending' || a.state === 'under_review');

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({title: 'Confirm', message: label + '?'})) return;
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, { params: { application_id: appId, send_email: true } });
          toast.show('Approved — API key provisioned', 'success');
        } catch { toast.show('Approved', 'success'); }
      }
      loadData();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const onlineAgents = monitoring?.sessions?.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
    return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120000;
  }).length || monitoring?.summary?.active || 0;
  const expiringCount = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000)).length;
  const actionCount = needsAction.length + expiringCount;

  return (
    <div className='sa-dashboard' style={{maxWidth:'1200px',margin:'0 auto'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'16px',marginBottom:'32px'}}>
        <div>
          <span className="hud-label" style={{color:'var(--purple-bright)',letterSpacing:'4px',display:'flex',alignItems:'center',gap:'12px',marginBottom:'10px'}}>
            <span style={{width:'24px',height:'1px',background:'var(--purple-bright)'}}></span>
            ADMINISTRATION
          </span>
          <h1 style={{fontFamily:'var(--serif)',fontSize:'clamp(24px,4vw,32px)',fontWeight:200,margin:'0 0 6px',letterSpacing:'-0.02em'}}>
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p style={{color:'var(--text-tertiary)',fontFamily:'var(--mono)',fontSize:'11px',letterSpacing:'1px'}}>
            {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
          </p>
        </div>
        <button onClick={() => loadData(true)} className="btn" style={{padding:'8px 16px'}}>
          <RefreshCw size={12} style={refreshing ? {animation:'spin 0.8s linear infinite'} : {}}/> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className='sa-stat-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:'12px',marginBottom:'32px'}}>
        <StatCard onClick={() => navigate("/applications")} label="In Pipeline" value={allApps.length} color="var(--purple-bright)" icon={<FileText size={16} strokeWidth={1.5}/>}/>
        <StatCard onClick={() => navigate("/cat72")} label="Active Tests" value={stats?.active_tests || 0} color="var(--accent-amber)" icon={<Activity size={16} strokeWidth={1.5}/>}/>
        <StatCard onClick={() => navigate("/certificates")} label="Active Certs" value={stats?.certificates_active || 0} color="var(--accent-green)" icon={<BrandMark size={16} />}/>
        <StatCard onClick={() => navigate("/monitoring")} label="Online Interlocks" value={onlineAgents} color={onlineAgents>0?'var(--accent-green)':'var(--text-tertiary)'} icon={<Wifi size={16} strokeWidth={1.5}/>}/>
        <StatCard onClick={() => navigate("/certificates")} label="Certs Issued" value={stats?.certificates_issued || 0} color="var(--purple-bright)" icon={<Award size={16} strokeWidth={1.5}/>}/>
      </div>

      {/* ── Pipeline ── */}
      <div style={{marginBottom:'32px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <span className="hud-label">Application Pipeline</span>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-tertiary)',letterSpacing:'1px'}}>{allApps.length} total</span>
        </div>
        <div style={{display:'flex',gap:'2px',height:'28px',overflow:'hidden'}}>
          {[
            {key:'pending',label:'Pending',color:'var(--accent-amber)',count:pipeline.pending},
            {key:'review',label:'Review',color:'var(--accent-amber)',count:pipeline.under_review},
            {key:'approved',label:'Awaiting Deploy',color:'var(--purple-bright)',count:pipeline.approved},
          ].map(s => {
            const total = allApps.length || 1;
            const pct = s.count > 0 ? Math.max((s.count/total)*100, 8) : 0;
            return (
              <div key={s.key} className="sa-fill" style={{width: s.count > 0 ? `${pct}%` : 'auto', minWidth:'32px', flex: s.count > 0 ? 'none' : 1, display:'flex', alignItems:'center', justifyContent:'center', '--sa-bg': s.count > 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.015)', '--sa-accent': s.count > 0 ? s.color : 'transparent', borderLeftWidth:'2px', opacity: s.count > 0 ? 1 : 0.4}} title={`${s.label}: ${s.count}`}>
                <span style={{fontFamily:'var(--mono)',fontSize:'9px',letterSpacing:'1px',color: s.count > 0 ? s.color : 'var(--text-tertiary)',whiteSpace:'nowrap'}}>{s.count > 0 ? `${s.count} ` : ''}{s.label}</span>
              </div>
            );
          })}
          {allApps.length===0 && <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.02)'}}>
            <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-tertiary)',letterSpacing:'1px'}}>No applications yet</span>
          </div>}
        </div>
      </div>

      {/* ── Review Queue ── */}
      {needsAction.length > 0 && (
        <div style={{marginBottom:'32px'}}>
          <span className="hud-label" style={{color:'var(--accent-amber)',marginBottom:'12px',display:'block'}}>
            ⚡ REVIEW QUEUE ({needsAction.length})
          </span>
          <div className="hud-frame"><i></i>
            {needsAction.slice(0,5).map((app,idx) => (
              <div key={app.id} className="hud-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'12px',minWidth:0,flex:1}}>
                  <span className="hud-num">{String(idx+1).padStart(2,'0')}</span>
                  <span className="hud-dot" style={{background:app.state==='pending'?'var(--accent-amber)':'var(--purple-bright)',marginRight:0}}></span>
                  <div style={{minWidth:0}}>
                    <Link to={`/applications/${app.id}`} className="hud-title" style={{textDecoration:'none',color:'var(--text-primary)'}}>{app.system_name}</Link>
                    <div style={{fontSize:'10px',color:'var(--text-tertiary)',fontFamily:'var(--mono)',letterSpacing:'0.5px'}}>{app.organization_name} · {app.state?.replace(/_/g,' ')}</div>
                  </div>
                </div>
                <div className='sa-action-btns' style={{display:'flex',gap:'6px',flexShrink:0}}>
                  {app.state === 'pending' && (
                    <button onClick={() => handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`)} className="btn" style={{padding:'5px 10px',fontSize:'8px',letterSpacing:'1px'}}>Review</button>
                  )}
                  <button onClick={() => handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`)} className="btn" style={{padding:'5px 10px',fontSize:'8px',letterSpacing:'1px',color:'var(--accent-green)',borderColor:'rgba(92,214,133,0.2)'}}>Approve</button>
                  <button onClick={() => handleQuickAdvance(app.id, 'suspended', `Withdraw ${app.system_name}`)} className="btn" style={{padding:'5px 10px',fontSize:'8px',letterSpacing:'1px',color:'var(--accent-red)',borderColor:'rgba(214,92,92,0.2)'}}>Withdraw</button>
                  <Link to={`/applications/${app.id}`} className="btn" style={{padding:'5px 10px',fontSize:'8px',letterSpacing:'1px'}}>View</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Tests ── */}
      {activeTests.length > 0 && (
        <div style={{marginBottom:'32px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <span className="hud-label">Active CAT-72 Tests</span>
            <Link to="/cat72" className="hud-link" style={{fontSize:'10px'}}>Console →</Link>
          </div>
          <div className="hud-frame"><i></i>
            {activeTests.map((test,idx) => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id} className="hud-row">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:'11px',letterSpacing:'1px',color:'var(--purple-bright)'}}>{test.organization_name} — {test.system_name}</span>
                    <div style={{display:'flex',gap:'16px'}}>
                      <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-tertiary)'}}>{hoursLeft}h remaining</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--accent-amber)'}}>{pct}%</span>
                    </div>
                  </div>
                  <div className="sa-fill" style={{height:'3px','--sa-bg':'rgba(255,255,255,0.04)',overflow:'hidden'}}>
                    <div className="sa-fill" style={{height:'100%',width:`${pct}%`,'--sa-bg':pct>=100?'var(--accent-green)':'var(--purple-bright)',transition:'width 0.4s ease'}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Expiring Certs Warning ── */}
      {(() => {
        const expiring = recentCerts.filter(c => c.expires_at && c.state === 'conformant' && new Date(c.expires_at) < new Date(Date.now() + 30*24*60*60*1000));
        if (expiring.length === 0) return null;
        return (
          <div style={{marginBottom:'32px'}}>
            <div className="hud-frame hud-frame-amber"><i></i>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <AlertTriangle size={14} style={{color:'var(--accent-amber)'}}/>
                <span className="hud-label" style={{color:'var(--accent-amber)'}}>{expiring.length} Certificate{expiring.length>1?'s':''} Expiring Within 30 Days</span>
              </div>
              {expiring.map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
                return (
                  <div key={c.id} className="hud-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
                    <div>
                      <span style={{color:'var(--text-primary)',fontSize:'13px'}}>{c.system_name}</span>
                      <span style={{color:'var(--text-tertiary)',fontSize:'11px',marginLeft:'10px'}}>{c.organization_name}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:daysLeft<=7?'var(--accent-red)':'var(--accent-amber)'}}>{daysLeft}d remaining</span>
                      <Link to={`/verify?cert=${c.certificate_number}`} className="hud-link" style={{fontSize:'10px'}}>{c.certificate_number}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Recent Certificates ── */}
      {recentCerts.length > 0 && (
        <div style={{marginBottom:'32px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <span className="hud-label">Recent Certificates</span>
            <Link to="/certificates" className="hud-link" style={{fontSize:'10px'}}>View All →</Link>
          </div>
          <Panel>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr>
                    {['Certificate','System','Status','Issued','Expires'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {recentCerts.slice(0,5).map(c => (
                    <tr key={c.id}>
                      <td><Link to={`/verify?cert=${c.certificate_number}`} style={{color:'var(--purple-bright)',fontFamily:'var(--mono)',fontSize:'12px',letterSpacing:'0.5px'}}>{c.certificate_number}</Link></td>
                      <td><span style={{color:'var(--text-primary)',fontSize:'13px'}}>{c.system_name}</span> <span style={{color:'var(--text-tertiary)',fontSize:'11px'}}>{c.organization_name}</span></td>
                      <td><span style={{fontFamily:'var(--mono)',fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:c.state==='conformant'?'var(--accent-green)':'var(--accent-red)'}}>{c.state}</span></td>
                      <td style={{color:'var(--text-tertiary)',fontSize:'12px'}}>{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'11px',color:c.expires_at && new Date(c.expires_at)<new Date(Date.now()+30*24*60*60*1000) ? 'var(--accent-amber)':'var(--text-tertiary)'}}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Recent Applications ── */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <span className="hud-label">Pending Applications</span>
          <Link to="/applications" className="hud-link" style={{fontSize:'10px'}}>View All →</Link>
        </div>
        <Panel>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  {['System','Organization','State','Submitted'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {allApps.slice(0,6).map(app => (
                  <tr key={app.id} style={{cursor:'pointer'}} onClick={() => navigate(`/applications/${app.id}`)}>
                    <td><Link to={`/applications/${app.id}`} style={{color:'var(--purple-bright)'}}>{app.system_name}</Link></td>
                    <td>{app.organization_name}</td>
                    <td><span style={{fontFamily:'var(--mono)',fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',
                      color:app.state==='conformant'?'var(--accent-green)':app.state==='revoked'?'var(--accent-red)':app.state==='testing'||app.state==='approved'?'var(--purple-bright)':'var(--accent-amber)'
                    }}>{app.state === 'approved' ? 'awaiting deploy' : app.state === 'under_review' ? 'in review' : app.state}</span></td>
                    <td style={{color:'var(--text-tertiary)',fontSize:'13px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════ */
function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Dashboard />;
  return <CustomerDashboard />;
}

export { CustomerDashboard, RoleBasedDashboard };
export default Dashboard;
