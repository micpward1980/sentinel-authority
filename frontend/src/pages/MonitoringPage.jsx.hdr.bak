import React, { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

function MonitoringPage() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const detailRef = useRef(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('last_activity');
  const [sortOrder, setSortOrder] = useState('desc');
  const perPage = 25;
  
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
      if (overviewRes.data?.total_pages) setTotalPages(overviewRes.data.total_pages);
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
        status: s.is_online ? 'Online' : 'Offline',
        organization: s.organization_name || '',
        system_name: s.system_name || '',
        certificate: s.certificate_id || '',
        session_id: s.session_id || '',
        started_at: s.started_at || '',
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
    if (statusFilter === 'online' && !s.is_online) return false;
    if (statusFilter === 'offline' && s.is_online) return false;
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

      {/* Alert Bar — only shows when there are issues */}
      {(() => {
        const offlineCount = sessions.filter(s => !s.is_online).length;
        const lowConformance = sessions.filter(s => s.is_online && s.pass_count + s.block_count > 0 && (s.pass_count / (s.pass_count + s.block_count) * 100) < 95).length;
        if (!offlineCount && !lowConformance) return null;
        return (
          <div style={{padding:'10px 16px',marginBottom:'16px',border:'1px solid rgba(214,160,92,0.2)',background:'rgba(214,160,92,0.04)',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',color:'#D6A05C',display:'flex',gap:'16px',flexWrap:'wrap'}}>
            {offlineCount > 0 && <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setStatusFilter('offline')}>⚠ {offlineCount} system{offlineCount > 1 ? 's' : ''} offline</span>}
            {lowConformance > 0 && <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setStatusFilter('all')}>⚠ {lowConformance} system{lowConformance > 1 ? 's' : ''} below 95% conformance</span>}
          </div>
        );
      })()}

      {/* Sessions Table */}
      <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'auto'}}>
        <div style={{padding: '16px 20px', borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
          <div className="hud-label" style={{marginBottom: '16px'}}>{user?.role === 'admin' ? 'Interlock Sessions' : 'System Monitoring'}</div>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <input type="text" placeholder="Search session, system..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'6px 12px',fontFamily:"Consolas, monospace",fontSize:'11px',width:'200px',outline:'none'}} />
{['all','online','offline'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className="btn" style={{padding: '4px 10px', color: statusFilter === f ? (f === 'offline' ? '#D65C5C' : f === 'online' ? '#5CD685' : 'rgba(255,255,255,.94)') : 'var(--text-tertiary)', borderColor: statusFilter === f ? (f === 'offline' ? 'rgba(214,92,92,0.3)' : f === 'online' ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)', textTransform: 'capitalize', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px'}}>
                {f}
              </button>
            ))}

          </div>
        </div>        
        {filteredSessions.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.78)'}}>
            {user?.role === 'admin' ? 'No ENVELO sessions found. Deploy an Interlock to begin monitoring.' : 'No active systems. Once your system is ODDC certified and running the ENVELO Interlock, real-time monitoring data will appear here.'}
          </div>
        ) : (
          <div className='table-scroll' style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '1000px'}}>
              <colgroup>
                <col style={{width:'100px'}} />
                <col style={{width:'160px'}} />
                <col style={{width:'180px'}} />
                <col style={{width:'120px'}} />
                <col style={{width:'80px'}} />
                <col style={{width:'90px'}} />
                <col style={{width:'90px'}} />
                <col style={{width:'140px'}} />
              </colgroup>
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
                  const isSelected = selectedSession?.id === session.id || expandedId === session.id;
                  
                  return (<>
                    <tr 
                      key={session.id}
                      onClick={() => {
                        if (isSelected) { const scrollY = window.scrollY; setExpandedId(null); setTimeout(() => { setSelectedSession(null); requestAnimationFrame(() => window.scrollTo(0, scrollY)); }, 300); }
                        else { setSelectedSession(session); requestAnimationFrame(() => setExpandedId(session.id)); }
                      }}
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
                            background: session.is_online ? '#5CD685' : '#D65C5C',
                            boxShadow: session.is_online ? `0 0 8px ${'#5CD685'}` : 'none'
                          }} />
                          <span style={{
                            fontSize: '11px', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                            textTransform: 'uppercase', letterSpacing: '1px',
                            color: session.is_online ? '#5CD685' : '#D65C5C'
                          }}>
                            {session.is_online ? 'Online' : 'Offline'}
                          {!session.is_online && <div style={{fontSize:'9px',color:'rgba(214,92,92,0.6)',marginTop:'2px',textTransform:'none',letterSpacing:'0'}}>{session.offline_reason || (() => { const lh = session.last_heartbeat_at || session.last_activity; const h = lh ? Math.round((Date.now() - new Date(lh).getTime()) / 3600000) : null; return h ? h + 'h ago' : 'no signal'; })()}</div>}
                          </span>
                          {session.is_online && <span style={{fontSize:'13px',color:'#D66A6A',animation:'heartbeat 1.2s ease-in-out infinite'}}>♥</span>}
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
                    {selectedSession?.id === session.id && (
                      <tr><td colSpan={8} style={{padding: 0, border: 'none'}}>
                        <div ref={detailRef} style={{
                          background: 'rgba(91,75,138,0.08)',
                          borderBottom: '1px solid rgba(91,75,138,0.25)',
                          maxHeight: expandedId === session.id ? '800px' : '0px',
                          opacity: expandedId === session.id ? 1 : 0,
                          overflow: 'hidden',
                          transition: 'max-height 0.35s ease, opacity 0.25s ease',
                          padding: expandedId === session.id ? '20px' : '0 20px'
                        }}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px'}}>
                            <div>
                              <h3 style={{margin: '0 0 4px 0', fontSize: '18px', fontWeight: 400, color: 'rgba(255,255,255,.94)'}}>{selectedSession.organization_name || 'Unknown Organization'}</h3>
                              <p style={{margin: 0, fontSize: '13px', color: 'rgba(255,255,255,.78)'}}>{selectedSession.system_name || 'Unknown System'} · {selectedSession.certificate_id || 'No certificate'}</p>
                              <p style={{margin: '4px 0 0', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>Interlock v{selectedSession.agent_version || '1.0.0'} · Session {selectedSession.session_id}</p>
                            </div>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                                {user?.role === 'admin' && selectedSession.certificate_id && (
                                  <button onClick={async (e) => { e.stopPropagation(); if (!await confirm({title:'Reinstate Certificate',message:`Reinstate ${selectedSession.certificate_id} for ${selectedSession.organization_name}? System is back online.`})) return; try { await api.patch(`/api/certificates/${selectedSession.certificate_id}/reinstate`); toast.show('Certificate reinstated','success'); fetchData(); } catch(err) { toast.show('Failed: '+(err.response?.data?.detail||err.message),'error'); }}} className="btn" style={{padding:'3px 8px',fontSize:'9px',fontFamily:"Consolas,monospace",letterSpacing:'1px',textTransform:'uppercase',color:'#5CD685',borderColor:'rgba(92,214,133,0.3)'}}>Reinstate</button>
                                )}
                                {user?.role === 'admin' && selectedSession.certificate_id && (
                                  <button onClick={async (e) => { e.stopPropagation(); if (!await confirm({title:'Suspend Certificate',message:`Suspend ${selectedSession.certificate_id} for ${selectedSession.organization_name}? System is offline.`,danger:true})) return; try { await api.patch(`/api/certificates/${selectedSession.certificate_id}/suspend`,null,{params:{reason:'System offline — suspended by admin'}}); toast.show('Certificate suspended','warning'); fetchData(); } catch(err) { toast.show('Failed: '+(err.response?.data?.detail||err.message),'error'); }}} className="btn" style={{padding:'3px 8px',fontSize:'9px',fontFamily:"Consolas,monospace",letterSpacing:'1px',textTransform:'uppercase',color:'#D6A05C',borderColor:'rgba(214,160,92,0.3)'}}>Suspend</button>
                                )}
                                {user?.role === 'admin' && selectedSession.certificate_id && (
                                  <button onClick={async (e) => { e.stopPropagation(); if (!await confirm({title:'Revoke Certificate',message:`Permanently revoke ${selectedSession.certificate_id} for ${selectedSession.organization_name}? This cannot be undone.`,danger:true})) return; try { await api.patch(`/api/certificates/${selectedSession.certificate_id}/revoke`,null,{params:{reason:'Revoked by admin'}}); toast.show('Certificate revoked','error'); fetchData(); } catch(err) { toast.show('Failed: '+(err.response?.data?.detail||err.message),'error'); }}} className="btn" style={{padding:'3px 8px',fontSize:'9px',fontFamily:"Consolas,monospace",letterSpacing:'1px',textTransform:'uppercase',color:'#D65C5C',borderColor:'rgba(214,92,92,0.3)'}}>Revoke</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setSelectedSession(null); }} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: '18px', padding: '4px 8px'}}>×</button>
                              </div>
                            </div>
                          </div>

                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px'}}>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Last Heartbeat</div><div style={{color: selectedSession.is_online ? '#5CD685' : '#D65C5C', fontSize: '12px', display:'flex', alignItems:'center', gap:'6px'}}>{selectedSession.is_online && <span style={{animation:'heartbeat 1.2s ease-in-out infinite',fontSize:'13px',color:'#D66A6A'}}>♥</span>}{selectedSession.last_heartbeat_at ? new Date(selectedSession.last_heartbeat_at).toLocaleString() : selectedSession.last_activity ? new Date(selectedSession.last_activity).toLocaleString() : '-'}</div></div>
                            {!selectedSession.is_online && (() => {
                              const lastHb = selectedSession.last_heartbeat_at || selectedSession.last_activity;
                              const hoursAgo = lastHb ? Math.round((Date.now() - new Date(lastHb).getTime()) / 3600000) : null;
                              const reason = hoursAgo > 72 ? 'Connection lost — no heartbeat for ' + hoursAgo + 'h' : hoursAgo > 24 ? 'Interlock unresponsive — offline ' + hoursAgo + 'h (auto-suspend eligible)' : hoursAgo ? 'Heartbeat stopped ' + hoursAgo + 'h ago' : 'No heartbeat received';
                              return <div style={{gridColumn:'1 / -1', padding:'8px 12px', background:'rgba(214,92,92,0.06)', border:'1px solid rgba(214,92,92,0.15)', marginBottom:'4px'}}><div style={{fontSize:'9px',color:'#D65C5C',fontFamily:"Consolas,monospace",textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>⚠ Offline Reason</div><div style={{fontSize:'12px',color:'rgba(255,255,255,.80)'}}>{reason}</div></div>;
                            })()}
                            {!selectedSession.is_online && <div style={{gridColumn:'1 / -1', padding:'8px 12px', background:'rgba(214,92,92,0.06)', border:'1px solid rgba(214,92,92,0.15)', marginBottom:'4px'}}><div style={{fontSize:'9px',color:'#D65C5C',fontFamily:"Consolas,monospace",textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>Offline Reason</div><div style={{fontSize:'12px',color:'rgba(255,255,255,.80)'}}>{selectedSession.offline_reason || (() => { const lh = selectedSession.last_heartbeat_at || selectedSession.last_activity; const h = lh ? Math.round((Date.now() - new Date(lh).getTime()) / 3600000) : null; return h > 72 ? 'Connection lost - no heartbeat for ' + h + 'h' : h > 24 ? 'Interlock unresponsive - offline ' + h + 'h' : h ? 'Heartbeat stopped ' + h + 'h ago' : 'No heartbeat received'; })()}</div></div>}
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Started</div><div style={{color: 'rgba(255,255,255,.94)', fontSize: '12px'}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Uptime</div><div style={{color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{selectedSession.uptime_hours?.toFixed(1) || '0'}h</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Passed</div><div style={{color: '#5CD685', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{(selectedSession.pass_count || 0).toLocaleString()}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Blocked</div><div style={{color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{(selectedSession.block_count || 0).toLocaleString()}</div></div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Pass Rate</div>{(() => { const t2 = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); const r2 = t2 > 0 ? (selectedSession.pass_count / t2 * 100) : 0; return <div style={{color: r2 >= 99 ? '#5CD685' : r2 >= 95 ? '#D6A05C' : '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '16px'}}>{r2.toFixed(1)}%</div>; })()}</div>
                            <div><div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Certificate</div><div style={{color: '#a896d6', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>{selectedSession.certificate_id ? <a href={'/verify?cert=' + selectedSession.certificate_id} style={{color:'#a896d6',textDecoration:'none'}}>{selectedSession.certificate_id}</a> : '-'}</div></div>
                          </div>

                          {(() => { const t3 = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); if (t3 === 0) return null; const pp = selectedSession.pass_count / t3 * 100; return (
                            <div style={{marginBottom: '20px'}}>
                              <div style={{fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Enforcement Distribution</div>
                              <div style={{height: '8px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex'}}>
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

      <Pagination page={currentPage} pages={totalPages} onChange={setCurrentPage} />    </div>
  );
}



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

const MonHeartStyle = () => <style>{`@keyframes heartbeat { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.3); opacity: 1; } }`}</style>;

export default MonitoringPage;

