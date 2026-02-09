import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function MyActivityPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState('30');
  const PAGE_SIZE = 30;

  const getDateFrom = () => {
    if (dateRange === 'all') return '';
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d.toISOString();
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE);
      params.set('offset', page * PAGE_SIZE);
      const df = getDateFrom();
      if (df) params.set('date_from', df);
      const res = await api.get(`/api/audit/my-logs?${params}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error('Failed to load activity:', err); }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page, dateRange]);

  const actionIcon = (action) => {
    if (action?.includes('approved') || action?.includes('issued') || action?.includes('conformant')) return { icon: '\u2713', color: '#5CD685' };
    if (action?.includes('failed') || action?.includes('revoked') || action?.includes('suspended')) return { icon: '\u2717', color: '#D65C5C' };
    if (action?.includes('pending') || action?.includes('under_review')) return { icon: '\u25CF', color: '#D6A05C' };
    return { icon: '\u25CF', color: '#a896d6' };
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6" style={{maxWidth: 'min(800px, 95vw)', margin: '0 auto'}}>
      <SectionHeader label="Account" title="My Activity" />

      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px'}}>
          <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)', letterSpacing: '1px', textTransform: 'uppercase'}}>Activity Log</span>
          <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
            {['7', '30', '90', 'all'].map(r => (
              <button key={r} onClick={() => { setDateRange(r); setPage(0); }} style={{padding: '4px 10px', background: dateRange === r ? 'rgba(168,150,214,0.15)' : 'transparent', border: `1px solid ${dateRange === r ? 'rgba(168,150,214,0.4)' : 'rgba(255,255,255,.07)'}`, color: dateRange === r ? '#a896d6' : 'rgba(255,255,255,.50)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s ease'}}>
                {r === 'all' ? 'All' : r + 'd'}
              </button>
            ))}
            <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', marginLeft: '8px'}}>{total} entries</span>
          </div>
        </div>

        {loading ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.50)'}}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.50)'}}>No activity yet</div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {logs.map(log => {
              const ai = actionIcon(log.action);
              return (
                <div key={log.id} style={{display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderBottom: `1px solid ${'rgba(255,255,255,.04)'}`}}>
                  <div style={{width: '28px', height: '28px', borderRadius: '50%', background: `${ai.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px'}}>
                    <span style={{color: ai.color, fontSize: '13px', fontWeight: 'bold'}}>{ai.icon}</span>
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '4px'}}>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: ai.color, letterSpacing: '0.5px'}}>{log.action?.replace(/_/g, ' ')}</span>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', whiteSpace: 'nowrap'}}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                    </div>
                    <div style={{fontSize: '12px', color: 'rgba(255,255,255,.78)'}}>
                      {log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ''}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span style={{color: 'rgba(255,255,255,.50)', marginLeft: '8px'}}>
                          {Object.entries(log.details).filter(([k]) => k !== 'old_state').slice(0, 3).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' \u00B7 ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{display: 'flex', justifyContent: 'center', gap: '8px', paddingTop: '16px', marginTop: '16px', borderTop: `1px solid ${'rgba(255,255,255,.04)'}`}}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{padding: '6px 12px', background: '#2a2f3d', border: `1px solid ${'rgba(255,255,255,.07)'}`, color: page === 0 ? 'rgba(255,255,255,.50)' : 'rgba(255,255,255,.94)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>\u2190 Prev</button>
            <span style={{padding: '6px 12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.78)'}}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={{padding: '6px 12px', background: '#2a2f3d', border: `1px solid ${'rgba(255,255,255,.07)'}`, color: page >= totalPages - 1 ? 'rgba(255,255,255,.50)' : 'rgba(255,255,255,.94)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>Next \u2192</button>
          </div>
        )}
      </Panel>
    </div>
  );
}


export default MyActivityPage;

