import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import Panel from '../components/Panel';

function MonitoringPage() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [hideEnded, setHideEnded] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const fetchData = async () => {
    try {
      const [overviewRes, alertsRes] = await Promise.all([
        api.get('/api/envelo/monitoring/overview'),
        api.get('/api/envelo/monitoring/alerts')
      ]);
      setOverview(overviewRes.data);
      setAlerts(alertsRes.data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchTimeline = async (sessionId) => {
    try {
      const res = await api.get(`/api/envelo/monitoring/session/${sessionId}/timeline?hours=24`);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  };

  useEffect(() => {
    if (selectedSession) {
      fetchTimeline(selectedSession.id);
    }
  }, [selectedSession]);

  const exportSessionsCSV = () => {
    const rows = filteredSessions.map(s => {
      const total = (s.pass_count || 0) + (s.block_count || 0);
      const passRate = total > 0 ? (s.pass_count / total * 100).toFixed(2) : '0.00';
      return {
        status: s.is_online ? 'Online' : s.status === 'ended' ? 'Ended' : 'Offline',
        organization: s.organization_name || '',
        system_name: s.system_name || '',
        certificate: s.certificate_id || '',
        session_id: s.session_id || '',
        started_at: s.started_at || '',
        ended_at: s.ended_at || '',
        uptime_hours: s.uptime_hours?.toFixed(2) || '0',
        pass_count: s.pass_count || 0,
        block_count: s.block_count || 0,
        total_actions: total,
        pass_rate: passRate + '%',
        agent_version: s.agent_version || '',
        last_activity: s.last_activity || '',
      };
    });
    if (rows.length === 0) { toast.show('No sessions to export', 'warning'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = String(r[h]).replace(/"/g, '""');
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `envelo-sessions-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center'}}>
        <RefreshCw size={24} style={{animation: 'spin 1s linear infinite', color: styles.purpleBright}} />
        <p style={{marginTop: '16px', color: styles.textSecondary}}>Loading monitoring data...</p>
      </div>
    );
  }

  const summary = overview?.summary || {};
  const sessions = overview?.sessions || [];
  const filteredSessions = sessions.filter(s => {
    if (customerFilter && s.organization_name !== customerFilter) return false;
    if (onlineOnly && !s.is_online) return false;
    if (hideEnded && (s.status === 'ended' || s.status === 'completed' || s.status === 'disconnected')) return false;
    return true;
  });

  return (
    <div style={{maxWidth: '1400px', margin: '0 auto'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px'}}>
        <div>
          <h1 className="sa-page-title" style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 300, margin: 0}}>
            System Monitoring
          </h1>
          <p style={{color: styles.textSecondary, marginTop: '4px', fontSize: '14px'}}>
            {user?.role === 'admin' ? 'Real-time ENVELO agent status and telemetry' : 'Track your certified systems\' compliance status'}
          </p>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: styles.textSecondary, fontSize: '13px', cursor: 'pointer'}}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{accentColor: styles.purpleBright}}
            />
            Auto-refresh
          </label>
          <button 
            onClick={async () => { setRefreshing(true); await fetchData(); setTimeout(() => setRefreshing(false), 600); }}
            style={{
              background: styles.bgPanel, border: `1px solid ${styles.borderGlass}`,
              borderRadius: '8px', padding: '8px 16px', color: styles.textPrimary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <RefreshCw size={14} style={refreshing ? {animation: "spin 1s linear infinite"} : {}} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {user?.role === 'admin' && <button 
            onClick={exportSessionsCSV}
            style={{
              background: styles.bgPanel, border: `1px solid ${styles.borderGlass}`,
              borderRadius: '8px', padding: '8px 16px', color: styles.textPrimary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.5px'
            }}
          >
            <Download size={14} /> Export CSV
          </button>}
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{
          background: 'rgba(214, 92, 92, 0.1)',
          border: '1px solid rgba(214, 92, 92, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
            <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={18} style={{color: '#D65C5C'}} />
            <span style={{fontWeight: 500, color: '#D65C5C'}}>{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 14px'
              }}>
                <div>
                  <span style={{
                    fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                    textTransform: 'uppercase', letterSpacing: '1px',
                    color: alert.severity === 'critical' ? '#D65C5C' : '#D6A05C',
                    marginRight: '12px'
                  }}>
                    {alert.severity}
                  </span>
                  <span style={{color: styles.textPrimary}}>{alert.message}</span>
                </div>
                <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace"}}>
                  {alert.session_id?.slice(0, 8)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {(() => {
        const onlineCount = sessions.filter(s => s.is_online).length;
        const offlineCount = sessions.filter(s => !s.is_online && s.status !== 'ended').length;
        const totalFleet = onlineCount + offlineCount;
        const healthPct = totalFleet > 0 ? (onlineCount / totalFleet * 100) : 0;
        const cardStyle = {background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'};
        const labelStyle = {fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'};
        const subStyle = {fontSize: '12px', color: styles.textSecondary, marginTop: '4px'};
        return (
          <div style={{marginBottom: '32px'}}>
            {/* Fleet Health Bar */}
            {totalFleet > 0 && (
              <div style={{marginBottom: '20px', padding: '16px 20px', ...cardStyle}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '10px'}}>
                  <div style={labelStyle}>Fleet Health</div>
                  <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: healthPct >= 90 ? styles.accentGreen : healthPct >= 70 ? '#D6A05C' : '#D65C5C', fontWeight: 500}}>
                    {healthPct.toFixed(0)}% Online
                  </div>
                </div>
                <div style={{height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex'}}>
                  {onlineCount > 0 && <div style={{width: (onlineCount / totalFleet * 100) + '%', background: styles.accentGreen, borderRadius: '4px 0 0 4px', transition: 'width 0.5s'}} />}
                  {offlineCount > 0 && <div style={{width: (offlineCount / totalFleet * 100) + '%', background: '#D65C5C', transition: 'width 0.5s'}} />}
                </div>
                <div style={{display: 'flex', gap: '16px', marginTop: '8px'}}>
                  <span style={{fontSize: '11px', color: styles.accentGreen, display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen, display: 'inline-block'}} /> {onlineCount} online
                  </span>
                  <span style={{fontSize: '11px', color: '#D65C5C', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#D65C5C', display: 'inline-block'}} /> {offlineCount} offline
                  </span>
                  <span style={{fontSize: '11px', color: styles.textTertiary, display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.textTertiary, display: 'inline-block'}} /> {summary.ended || 0} ended
                  </span>
                </div>
              </div>
            )}
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
              <div style={cardStyle}>
                <div style={labelStyle}>{user?.role === 'admin' ? 'Active Sessions' : 'Active Systems'}</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.accentGreen}}>{summary.active || 0}</div>
                <div style={subStyle}>{summary.offline || 0} offline</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Actions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{(summary.total_actions || 0).toLocaleString()}</div>
                <div style={subStyle}>{summary.total_pass?.toLocaleString() || 0} passed, {summary.total_block?.toLocaleString() || 0} blocked</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Pass Rate</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: summary.pass_rate >= 99 ? styles.accentGreen : summary.pass_rate >= 95 ? '#D6A05C' : '#D65C5C'}}>{summary.pass_rate?.toFixed(1) || 0}%</div>
                <div style={subStyle}>enforcement success</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Violations (24h)</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: (summary.total_block || 0) > 0 ? '#D65C5C' : styles.accentGreen}}>{(summary.total_block || 0).toLocaleString()}</div>
                <div style={subStyle}>{((summary.total_block || 0) / Math.max(summary.total_actions || 1, 1) * 100).toFixed(2)}% of actions</div>
              </div>
              {user?.role === 'admin' && <div style={cardStyle}>
                <div style={labelStyle}>Total Sessions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{summary.total || 0}</div>
                <div style={subStyle}>{summary.ended || 0} completed</div>
              </div>}
              {user?.role === 'admin' && <div style={cardStyle}>
                <div style={labelStyle}>Unique Systems</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.purpleBright}}>{[...new Set(sessions.map(s => s.certificate_id).filter(Boolean))].length}</div>
                <div style={subStyle}>{[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].length} organizations</div>
              </div>}
            </div>
          </div>
        );
      })()}

      {/* Sessions Table */}
      <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', overflow: 'hidden'}}>
        <div style={{padding: '16px 20px', borderBottom: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
          <h2 style={{margin: 0, fontSize: '14px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary}}>{user?.role === 'admin' ? 'Agent Sessions' : 'System Monitoring'}</h2>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            {user?.role === 'admin' && <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', padding: '6px 10px', color: styles.textPrimary, fontSize: '12px'}}>
              <option value="">All Customers</option>
              {[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].map(org => <option key={org} value={org}>{org}</option>)}
            </select>}
            <label style={{display: 'flex', alignItems: 'center', gap: '6px', color: styles.textSecondary, fontSize: '12px', cursor: 'pointer'}}>
              <input type="checkbox" checked={hideEnded} onChange={(e) => setHideEnded(e.target.checked)} style={{accentColor: styles.purpleBright}} />
              Hide ended
            </label>
            <label style={{display: 'flex', alignItems: 'center', gap: '6px', color: styles.textSecondary, fontSize: '12px', cursor: 'pointer'}}>
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} style={{accentColor: styles.purpleBright}} />
              Online only
            </label>
          </div>
        </div>        
        {filteredSessions.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: styles.textSecondary}}>
            {user?.role === 'admin' ? 'No ENVELO sessions found. Deploy an agent to begin monitoring.' : 'No active systems. Once your system is ODDC certified and running the ENVELO agent, real-time monitoring data will appear here.'}
          </div>
        ) : (
          <div className='table-scroll' style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: 'rgba(0,0,0,0.2)'}}>
                  {(() => { const th = {padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}; const thr = {...th, textAlign: 'right'}; return (<>
                  <th style={th}>Status</th>
                  <th style={th}>Organization</th>
                  <th style={th}>System / Certificate</th>
                  <th style={th}>Session</th>
                  <th style={th}>Uptime</th>
                  <th style={thr}>Actions</th>
                  <th style={thr}>Pass Rate</th>
                  <th style={th}>Last Activity</th>
                  </>); })()}
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  const total = session.pass_count + session.block_count;
                  const passRate = total > 0 ? (session.pass_count / total * 100) : 0;
                  const isSelected = selectedSession?.id === session.id;
                  
                  return (
                    <tr 
                      key={session.id}
                      onClick={() => setSelectedSession(isSelected ? null : session)}
                      style={{
                        borderBottom: `1px solid ${styles.borderGlass}`,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(91, 75, 138, 0.15)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{padding: '14px 16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: session.is_online ? styles.accentGreen : session.status === 'ended' ? styles.textTertiary : '#D65C5C',
                            boxShadow: session.is_online ? `0 0 8px ${styles.accentGreen}` : 'none'
                          }} />
                          <span style={{
                            fontSize: '11px', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                            textTransform: 'uppercase', letterSpacing: '1px',
                            color: session.is_online ? styles.accentGreen : session.status === 'ended' ? styles.textTertiary : '#D65C5C'
                          }}>
                            {session.is_online ? 'Online' : session.status === 'ended' ? 'Ended' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: styles.textPrimary, fontWeight: 500}}>{session.organization_name || 'Unknown'}</div>
                      </td>
                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: styles.textPrimary}}>{session.system_name || '-'}</div>
                        <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>{session.certificate_id || '-'}</div>
                      </td>
                      <td style={{padding: '14px 16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>
                        {session.session_id?.slice(0, 12)}...
                      </td>
                      <td style={{padding: '14px 16px', color: styles.textSecondary, fontSize: '13px'}}>
                        {session.uptime_hours?.toFixed(1)}h
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right', color: styles.textPrimary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px'}}>
                        {total.toLocaleString()}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right'}}>
                        <span style={{
                          color: passRate >= 99 ? styles.accentGreen : passRate >= 95 ? '#D6A05C' : '#D65C5C',
                          fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px'
                        }}>
                          {passRate.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{padding: '14px 16px', color: styles.textTertiary, fontSize: '12px'}}>
                        {session.last_activity ? new Date(session.last_activity).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Detail Panel */}
      {selectedSession && (
        <div style={{
          marginTop: '24px',
          background: styles.bgPanel,
          border: `1px solid ${styles.borderGlass}`,
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{padding: '16px 20px', borderBottom: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
            <h2 style={{margin: 0, fontSize: '14px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary}}>
              Session Detail: {selectedSession.session_id}
            </h2>
            <button 
              onClick={() => setSelectedSession(null)}
              style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '18px'}}
            >
              ×
            </button>
          </div>
          
          <div style={{padding: '20px'}}>
            {/* Session Info Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px'}}>
              <div>
                <h3 style={{margin: '0 0 4px 0', fontSize: '18px', fontWeight: 400, color: styles.textPrimary}}>{selectedSession.organization_name || 'Unknown Organization'}</h3>
                <p style={{margin: 0, fontSize: '13px', color: styles.textSecondary}}>{selectedSession.system_name || 'Unknown System'} · {selectedSession.certificate_id || 'No certificate'}</p>
                <p style={{margin: '4px 0 0', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>Agent v{selectedSession.agent_version || '1.0.0'} · Session {selectedSession.session_id}</p>
              </div>
              {selectedSession.is_online && (
                <button
                  onClick={async () => {
                    if (!await confirm({title: 'End Session', message: 'Force-end this session?', danger: true})) return;
                    try {
                      await api.post('/api/envelo/sessions/' + selectedSession.session_id + '/end', { ended_at: new Date().toISOString(), final_stats: { pass_count: selectedSession.pass_count, block_count: selectedSession.block_count } });
                      setSelectedSession(null);
                      fetchData();
                    } catch (e) { toast.show('Failed: ' + e.message, 'error'); }
                  }}
                  style={{padding: '8px 16px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '8px', color: '#D65C5C', cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}
                >
                  Force End Session
                </button>
              )}
            </div>
            
            {/* Stats Grid */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px'}}>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Started</div>
                <div style={{color: styles.textPrimary, fontSize: '13px'}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div>
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Uptime</div>
                <div style={{color: styles.textPrimary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '18px'}}>{selectedSession.uptime_hours?.toFixed(1) || '0'}h</div>
              </div>
              <div style={{background: 'rgba(92,214,133,0.08)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Passed</div>
                <div style={{color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '18px'}}>{(selectedSession.pass_count || 0).toLocaleString()}</div>
              </div>
              <div style={{background: 'rgba(214,92,92,0.08)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Blocked</div>
                <div style={{color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '18px'}}>{(selectedSession.block_count || 0).toLocaleString()}</div>
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Pass Rate</div>
                {(() => { const t = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); const r = t > 0 ? (selectedSession.pass_count / t * 100) : 0; return (
                  <div style={{color: r >= 99 ? styles.accentGreen : r >= 95 ? '#D6A05C' : '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '18px'}}>{r.toFixed(1)}%</div>
                ); })()}
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Certificate</div>
                <div style={{color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px'}}>{selectedSession.certificate_id || '-'}</div>
              </div>
            </div>
            
            {/* Pass/Block Ratio Bar */}
            {(() => { const t = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); if (t === 0) return null; const pp = selectedSession.pass_count / t * 100; return (
              <div style={{marginBottom: '24px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Enforcement Distribution</div>
                <div style={{height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex'}}>
                  <div style={{width: pp + '%', background: 'linear-gradient(90deg, ' + styles.accentGreen + ', #4BC87A)', transition: 'width 0.5s'}} />
                  <div style={{width: (100 - pp) + '%', background: '#D65C5C', transition: 'width 0.5s'}} />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '4px', fontSize: '11px'}}>
                  <span style={{color: styles.accentGreen}}>Pass: {pp.toFixed(1)}%</span>
                  <span style={{color: '#D65C5C'}}>Block: {(100 - pp).toFixed(1)}%</span>
                </div>
              </div>
            ); })()}


            {/* Session Data Downloads */}
            <div style={{display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap'}}>
              <button
                onClick={async () => {
                  try {
                    const isAdmin = user?.role === 'admin';
                    const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/';
                    const res = await api.get(base + selectedSession.id + '/telemetry');
                    const records = res.data.records || [];
                    if (records.length === 0) { toast.show('No telemetry data yet', 'info'); return; }
                    const headers = ['timestamp','action_id','action_type','result','execution_time_ms'];
                    const csv = [headers.join(','), ...records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
                    const blob = new Blob([csv], {type: 'text/csv'});
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `telemetry-${selectedSession.session_id}.csv`;
                    link.click();
                  } catch (e) { toast.show('Failed to download telemetry', 'error'); }
                }}
                style={{padding: '8px 16px', background: 'rgba(157,140,207,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '8px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                ↓ Telemetry CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const isAdmin = user?.role === 'admin';
                    const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/';
                    const res = await api.get(base + selectedSession.id + '/violations');
                    const violations = res.data.violations || [];
                    if (violations.length === 0) { toast.show('No violations recorded', 'info'); return; }
                    const headers = ['timestamp','boundary_name','violation_message'];
                    const csv = [headers.join(','), ...violations.map(v => headers.map(h => JSON.stringify(v[h] ?? '')).join(','))].join('\n');
                    const blob = new Blob([csv], {type: 'text/csv'});
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `violations-${selectedSession.session_id}.csv`;
                    link.click();
                  } catch (e) { toast.show('Failed to download violations', 'error'); }
                }}
                style={{padding: '8px 16px', background: 'rgba(214,92,92,0.08)', border: '1px solid rgba(214,92,92,0.25)', borderRadius: '8px', color: '#D65C5C', cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                ↓ Violations CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const isAdmin = user?.role === 'admin';
                    const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/';
                    const res = await api.get(base + selectedSession.id + '/report', { responseType: 'blob' });
                    const blob = new Blob([res.data], {type: 'application/pdf'});
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `CAT72-Report-${selectedSession.session_id}.pdf`;
                    link.click();
                  } catch (e) { toast.show('Failed to download report', 'error'); }
                }}
                style={{padding: '8px 16px', background: 'rgba(92,214,133,0.08)', border: '1px solid rgba(92,214,133,0.25)', borderRadius: '8px', color: styles.accentGreen, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                ↓ CAT-72 Report PDF
              </button>
            </div>
            {/* Simple Timeline Bar Chart */}
            {timeline.length > 0 && (
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px'}}>
                  24-Hour Activity
                </div>
                <div style={{display: 'flex', gap: '2px', height: '60px', alignItems: 'flex-end'}}>
                  {timeline.map((point, i) => {
                    const maxTotal = Math.max(...timeline.map(t => t.total), 1);
                    const height = (point.total / maxTotal) * 100;
                    const passRatio = point.total > 0 ? point.pass / point.total : 1;
                    
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${Math.max(height, 2)}%`,
                          background: passRatio >= 0.99 ? styles.accentGreen : passRatio >= 0.95 ? '#D6A05C' : '#D65C5C',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8
                        }}
                        title={`${new Date(point.hour).toLocaleTimeString()}: ${point.total} actions (${point.pass} pass, ${point.block} block)`}
                      />
                    );
                  })}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '4px', fontSize: '10px', color: styles.textTertiary}}>
                  <span>24h ago</span>
                  <span>Now</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// User Management Page (Admin Only)

export default MonitoringPage;

