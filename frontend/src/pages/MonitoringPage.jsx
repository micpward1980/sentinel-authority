import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('last_activity');
  const [sortOrder, setSortOrder] = useState('desc');
  const perPage = 25;
  const [hideEnded, setHideEnded] = useState(true);
  
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const fetchData = async () => {
    try {
      const [overviewRes, alertsRes] = await Promise.all([
        api.get(`/api/envelo/monitoring/overview?page=${currentPage}&per_page=${perPage}&sort=${sortField}&order=${sortOrder}&session_type=production`),
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
  }, [autoRefresh, currentPage, sortField, sortOrder]);

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
      fetchTimeline(selectedSession.session_id);
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
        last_activity: s.last_activity || ''
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
        <RefreshCw size={24} style={{animation: 'spin 1s linear infinite', color: '#a896d6'}} />
        <p style={{marginTop: '16px', color: 'rgba(255,255,255,.78)'}}>Loading monitoring data...</p>
      </div>
    );
  }

  const summary = overview?.summary || {};
  const sessions = overview?.sessions || [];
  const filteredSessions = sessions.filter(s => {
    if ((s.session_type || 'production') !== 'production') return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!(s.session_id || '').toLowerCase().includes(q) && !(s.certificate_id || '').toLowerCase().includes(q) && !(s.organization_name || '').toLowerCase().includes(q) && !(s.system_name || '').toLowerCase().includes(q)) return false;
      }
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
          <p style={{color: 'rgba(255,255,255,.78)', marginTop: '4px', fontSize: '14px'}}>
            {user?.role === 'admin' ? 'Real-time ENVELO Interlock status and telemetry' : 'Track your certified systems\' compliance status'}
          </p>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn"
            style={{padding: '6px 12px', color: autoRefresh ? 'var(--accent-green)' : 'var(--text-tertiary)', borderColor: autoRefresh ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.06)'}}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button 
            onClick={async () => { setRefreshing(true); await fetchData(); setTimeout(() => setRefreshing(false), 600); }}
            className="btn"
          >
            <RefreshCw size={14} style={refreshing ? {animation: "spin 1s linear infinite"} : {}} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {user?.role === 'admin' && <button 
            onClick={exportSessionsCSV}
            className="btn"
          >
            <Download size={14} /> Export CSV
          </button>}
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{
          background: 'rgba(214, 92, 92, 0.1)',
          border: '1px solid rgba(255,255,255,.10)',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
            <AlertTriangle fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={18} style={{color: '#D65C5C'}} />
            <span style={{fontWeight: 500, color: '#D65C5C'}}>{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {alerts.map((alert, i) => (
              <div key={i} onClick={() => {
                const s = sessions.find(s => s.session_id === alert.session_id);
                if (s) setSelectedSession(s);
              }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                background: 'transparent', padding: '10px 14px', cursor: 'pointer',
                transition: 'background .15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(214,92,92,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <span style={{
                    fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                    textTransform: 'uppercase', letterSpacing: '1px',
                    color: alert.severity === 'critical' ? '#D65C5C' : '#D6A05C',
                    marginRight: '12px'
                  }}>
                    {alert.severity}
                  </span>
                  <span style={{color: 'rgba(255,255,255,.94)'}}>{alert.message}</span>
                </div>
                <span style={{color: 'rgba(255,255,255,.50)', fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace"}}>
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
        const cardStyle = {padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.04)'};
        const labelStyle = {fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,.50)', marginBottom: '8px'};
        const subStyle = {fontSize: '12px', color: 'rgba(255,255,255,.78)', marginTop: '4px'};
        return (
          <div style={{marginBottom: '32px'}}>
            {/* Fleet Health Bar */}
            {totalFleet > 0 && (
              <div style={{marginBottom: '20px', padding: '16px 20px', ...cardStyle}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '10px'}}>
                  <div style={labelStyle}>Fleet Health</div>
                  <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: healthPct >= 90 ? '#5CD685' : healthPct >= 70 ? '#D6A05C' : '#D65C5C', fontWeight: 500}}>
                    {healthPct.toFixed(0)}% Online
                  </div>
                </div>
                <div style={{height: '8px', background: 'transparent', overflow: 'hidden', display: 'flex'}}>
                  {onlineCount > 0 && <div style={{width: (onlineCount / totalFleet * 100) + '%', background: '#5CD685', transition: 'width 0.5s'}} />}
                  {offlineCount > 0 && <div style={{width: (offlineCount / totalFleet * 100) + '%', background: '#D65C5C', transition: 'width 0.5s'}} />}
                </div>
                <div style={{display: 'flex', gap: '16px', marginTop: '8px'}}>
                  <span style={{fontSize: '11px', color: '#5CD685', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#5CD685', display: 'inline-block'}} /> {onlineCount} online
                  </span>
                  <span style={{fontSize: '11px', color: '#D65C5C', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#D65C5C', display: 'inline-block'}} /> {offlineCount} offline
                  </span>

                </div>
              </div>
            )}
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
              <div style={cardStyle}>
                <div style={labelStyle}>{user?.role === 'admin' ? 'Active Sessions' : 'Active Systems'}</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: '#5CD685'}}>{summary.active || 0}</div>
                <div style={subStyle}>{summary.offline || 0} offline</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Actions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: 'rgba(255,255,255,.94)'}}>{(summary.total_actions || 0).toLocaleString()}</div>
                <div style={subStyle}>{summary.total_pass?.toLocaleString() || 0} passed, {summary.total_block?.toLocaleString() || 0} blocked</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Pass Rate</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: summary.pass_rate >= 99 ? '#5CD685' : summary.pass_rate >= 95 ? '#D6A05C' : '#D65C5C'}}>{summary.pass_rate?.toFixed(1) || 0}%</div>
                <div style={subStyle}>enforcement success</div>
              </div>


              {user?.role === 'admin' && <div style={cardStyle}>
                <div style={labelStyle}>Organizations</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: '#a896d6'}}>{[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].length}</div>
                <div style={subStyle}>{[...new Set(sessions.map(s => s.system_name).filter(Boolean))].length} unique systems</div>
              </div>}
            </div>
          </div>
        );
      })()}

      {/* Sessions Table */}
      <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden'}}>
        <div style={{padding: '16px 20px', borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
          <div className="hud-label" style={{marginBottom: '16px'}}>{user?.role === 'admin' ? 'Interlock Sessions' : 'System Monitoring'}</div>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <input type="text" placeholder="Search session, system..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'6px 12px',fontFamily:"Consolas, monospace",fontSize:'11px',width:'200px',outline:'none'}} />
            {user?.role === 'admin' && <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{background: '#2a2f3d', border: `1px solid ${'rgba(255,255,255,.07)'}`, padding: '6px 10px', color: 'rgba(255,255,255,.94)', fontSize: '12px'}}>
              <option value="">All Customers</option>
              {[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].map(org => <option key={org} value={org}>{org}</option>)}
            </select>}
            <button onClick={() => setHideEnded(!hideEnded)} className="btn" style={{padding: '4px 10px', color: hideEnded ? 'var(--accent-green)' : 'var(--text-tertiary)', borderColor: hideEnded ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.06)'}}>
              Hide ended {hideEnded ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => setOnlineOnly(!onlineOnly)} className="btn" style={{padding: '4px 10px', color: onlineOnly ? 'var(--accent-green)' : 'var(--text-tertiary)', borderColor: onlineOnly ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.06)'}}>
              Online only {onlineOnly ? 'ON' : 'OFF'}
            </button>

          </div>
        </div>        
        {filteredSessions.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.78)'}}>
            {user?.role === 'admin' ? 'No ENVELO sessions found. Deploy an Interlock to begin monitoring.' : 'No active systems. Once your system is ODDC certified and running the ENVELO Interlock, real-time monitoring data will appear here.'}
          </div>
        ) : (
          <div className='table-scroll' style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: 'transparent'}}>
                  {(() => {
                    const thBase = {padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,.50)'};
                    const sortable = (label, field, align) => {
                      const active = sortField === field;
                      const style = {...thBase, textAlign: align || 'left', cursor: 'pointer', userSelect: 'none', color: active ? '#a896d6' : 'rgba(255,255,255,.50)', transition: 'color .15s'};
                      const arrow = active ? (sortOrder === 'asc' ? ' \u25B2' : ' \u25BC') : '';
                      return <th style={style} onClick={() => { if (active) { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); } else { setSortField(field); setSortOrder('desc'); } setCurrentPage(1); }}>{label}{arrow}</th>;
                    };
                    return (<>
                    {sortable('Status', 'status')}
                    {sortable('Organization', 'organization_name')}
                    {sortable('System / Certificate', 'system_name')}
                    {sortable('Session', 'started_at')}
                    {sortable('Uptime', 'uptime')}
                    {sortable('Actions', 'pass_count', 'right')}
                    {sortable('Pass Rate', 'pass_rate', 'right')}
                    {sortable('Last Activity', 'last_activity')}
                    </>);
                  })()}
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  const total = session.pass_count + session.block_count;
                  const passRate = total > 0 ? (session.pass_count / total * 100) : 0;
                  const isSelected = selectedSession?.id === session.id;
                  
                  return (<>
                    <tr 
                      key={session.id}
                      onClick={() => setSelectedSession(isSelected ? null : session)}
                      style={{
                        borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`,
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
                            background: session.is_online ? '#5CD685' : session.status === 'ended' ? 'rgba(255,255,255,.50)' : '#D65C5C',
                            boxShadow: session.is_online ? `0 0 8px ${'#5CD685'}` : 'none'
                          }} />
                          <span style={{
                            fontSize: '11px', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                            textTransform: 'uppercase', letterSpacing: '1px',
                            color: session.is_online ? '#5CD685' : session.status === 'ended' ? 'rgba(255,255,255,.50)' : '#D65C5C'
                          }}>
                            {session.is_online ? 'Online' : session.status === 'ended' ? 'Ended' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: 'rgba(255,255,255,.94)', fontWeight: 500}}>{session.organization_name || 'Unknown'}</div>
                      </td>
                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: 'rgba(255,255,255,.94)'}}>{session.system_name || '-'}</div>
                        <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', marginTop: '2px'}}>{session.certificate_id || '-'}</div>
                      </td>
                      <td style={{padding: '14px 16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>
                        {session.session_id?.slice(0, 12)}...
                      </td>
                      <td style={{padding: '14px 16px', color: 'rgba(255,255,255,.78)', fontSize: '13px'}}>
                        {session.uptime_hours?.toFixed(1)}h
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right', color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px'}}>
                        {total.toLocaleString()}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right'}}>
                        <span style={{
                          color: passRate >= 99 ? '#5CD685' : passRate >= 95 ? '#D6A05C' : '#D65C5C',
                          fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px'
                        }}>
                          {passRate.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{padding: '14px 16px', color: 'rgba(255,255,255,.50)', fontSize: '12px'}}>
                        {session.last_activity ? new Date(session.last_activity).toLocaleString() : '-'}
                      </td>
                    </tr>
                    {isSelected && selectedSession && (
                      <tr><td colSpan={8} style={{padding: 0, border: 'none'}}>
                        <div style={{background: 'rgba(91,75,138,0.08)', borderBottom: '1px solid rgba(91,75,138,0.25)', padding: '20px'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px'}}>
                            <div>
                              <h3 style={{margin: '0 0 4px 0', fontSize: '18px', fontWeight: 400, color: 'rgba(255,255,255,.94)'}}>{selectedSession.organization_name || 'Unknown Organization'}</h3>
                              <p style={{margin: 0, fontSize: '13px', color: 'rgba(255,255,255,.78)'}}>{selectedSession.system_name || 'Unknown System'} · {selectedSession.certificate_id || 'No certificate'}</p>
                              <p style={{margin: '4px 0 0', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>Interlock v{selectedSession.agent_version || '1.0.0'} · Session {selectedSession.session_id}</p>
                            </div>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                              {selectedSession.is_online && (
                                <button onClick={async (e) => { e.stopPropagation(); if (!await confirm({title: 'End Session', message: 'Force-end this session?', danger: true})) return; try { await api.post('/api/envelo/sessions/' + selectedSession.session_id + '/end', { ended_at: new Date().toISOString(), final_stats: { pass_count: selectedSession.pass_count, block_count: selectedSession.block_count } }); setSelectedSession(null); fetchData(); } catch (e2) { toast.show('Failed: ' + e2.message, 'error'); } }} className="btn">Force End</button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setSelectedSession(null); }} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: '18px', padding: '4px 8px'}}>×</button>
                            </div>
                          </div>

                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px'}}>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Started</div><div style={{color: 'rgba(255,255,255,.94)', fontSize: '12px'}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Uptime</div><div style={{color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{selectedSession.uptime_hours?.toFixed(1) || '0'}h</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Passed</div><div style={{color: '#5CD685', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{(selectedSession.pass_count || 0).toLocaleString()}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Blocked</div><div style={{color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{(selectedSession.block_count || 0).toLocaleString()}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Pass Rate</div>{(() => { const t2 = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); const r2 = t2 > 0 ? (selectedSession.pass_count / t2 * 100) : 0; return <div style={{color: r2 >= 99 ? '#5CD685' : r2 >= 95 ? '#D6A05C' : '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{r2.toFixed(1)}%</div>; })()}</div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Certificate</div><div style={{color: '#a896d6', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>{selectedSession.certificate_id || '-'}</div></div>
                          </div>

                          {(() => { const t3 = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); if (t3 === 0) return null; const pp = selectedSession.pass_count / t3 * 100; return (
                            <div style={{marginBottom: '20px'}}>
                              <div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Enforcement Distribution</div>
                              <div style={{height: '8px', background: 'transparent', overflow: 'hidden', display: 'flex'}}>
                                <div style={{width: pp + '%', background: '#5CD685'}} />
                                <div style={{width: (100 - pp) + '%', background: '#D65C5C'}} />
                              </div>
                              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px'}}>
                                <span style={{color: '#5CD685'}}>Pass: {pp.toFixed(1)}%</span>
                                <span style={{color: '#D65C5C'}}>Block: {(100 - pp).toFixed(1)}%</span>
                              </div>
                            </div>
                          ); })()}

                          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px'}}>
                            <button onClick={async (e) => { e.stopPropagation(); try { const isAdmin = user?.role === 'admin'; const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + selectedSession.session_id + '/telemetry'); const records = res.data.records || []; if (records.length === 0) { toast.show('No telemetry data yet', 'info'); return; } const headers = ['timestamp','action_id','action_type','result','execution_time_ms']; const csv = [headers.join(','), ...records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n'); const blob = new Blob([csv], {type: 'text/csv'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'telemetry-' + selectedSession.session_id + '.csv'; link.click(); } catch (e2) { toast.show('Failed to download telemetry', 'error'); } }} className="btn" style={{fontSize: '11px', padding: '6px 12px'}}>↓ Telemetry CSV</button>
                            <button onClick={async (e) => { e.stopPropagation(); try { const isAdmin = user?.role === 'admin'; const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + selectedSession.session_id + '/violations'); const violations = res.data.violations || []; if (violations.length === 0) { toast.show('No violations recorded', 'info'); return; } const headers = ['timestamp','boundary_name','violation_message']; const csv = [headers.join(','), ...violations.map(v => headers.map(h => JSON.stringify(v[h] ?? '')).join(','))].join('\n'); const blob = new Blob([csv], {type: 'text/csv'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'violations-' + selectedSession.session_id + '.csv'; link.click(); } catch (e2) { toast.show('Failed to download violations', 'error'); } }} className="btn" style={{fontSize: '11px', padding: '6px 12px'}}>↓ Violations CSV</button>
                            <button onClick={async (e) => { e.stopPropagation(); try { const isAdmin = user?.role === 'admin'; const base = isAdmin ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + selectedSession.session_id + '/report', { responseType: 'blob' }); const blob = new Blob([res.data], {type: 'application/pdf'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'CAT72-Report-' + selectedSession.session_id + '.pdf'; link.click(); } catch (e2) { toast.show('Failed to download report', 'error'); } }} className="btn" style={{fontSize: '11px', padding: '6px 12px'}}>↓ CAT-72 Report PDF</button>
                          </div>

                          {timeline.length > 0 && (
                            <div>
                              <div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>24-Hour Activity</div>
                              <div style={{display: 'flex', gap: '2px', height: '40px', alignItems: 'flex-end'}}>
                                {timeline.map((point, i) => { const maxTotal = Math.max(...timeline.map(t => t.total), 1); const height = (point.total / maxTotal) * 100; const passRatio = point.total > 0 ? point.pass / point.total : 1; return (<div key={i} style={{flex: 1, height: Math.max(height, 2) + '%', background: passRatio >= 0.99 ? '#5CD685' : passRatio >= 0.95 ? '#D6A05C' : '#D65C5C', opacity: 0.8}} title={new Date(point.hour).toLocaleTimeString() + ': ' + point.total + ' actions'} />); })}
                              </div>
                              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: 'rgba(255,255,255,.50)'}}><span>24h ago</span><span>Now</span></div>
                            </div>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </>);
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}


// User Management Page (Admin Only)

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'8px',padding:'16px 0'}}>
      <button disabled={page<=1} onClick={() => onChange(page-1)} className="btn" style={{padding:'4px 12px',opacity:page<=1?.3:1}}>Prev</button>
      <span style={{fontFamily:"Consolas, monospace",fontSize:'11px',color:'rgba(255,255,255,.60)'}}>Page {page} of {pages}</span>
      <button disabled={page>=pages} onClick={() => onChange(page+1)} className="btn" style={{padding:'4px 12px',opacity:page>=pages?.3:1}}>Next</button>
    </div>
  );
}

export default MonitoringPage;

