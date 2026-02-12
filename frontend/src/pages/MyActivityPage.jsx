import React, { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function MyActivityPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [quickRange, setQuickRange] = useState('30');
  const PAGE_SIZE = 30;

  const getDateFrom = () => {
    if (quickRange === 'all') return '';
    const d = new Date();
    d.setDate(d.getDate() - parseInt(quickRange));
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

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      const df = getDateFrom();
      if (df) params.set('date_from', df);
      params.set('limit', 10000);
      params.set('offset', 0);
      const res = await api.get(`/api/audit/my-logs?${params}`);
      const rows = res.data.logs || [];
      if (rows.length === 0) { toast.show('No entries to export', 'warning'); return; }
      const header = 'Timestamp,Action,Resource Type,Resource ID,Details';
      const csv = [header, ...rows.map(r => {
        const details = r.details ? Object.entries(r.details).map(([k,v]) => k + '=' + v).join('; ') : '';
        return [r.timestamp || '', r.action || '', r.resource_type || '', r.resource_id || '', '"' + details.replace(/"/g, '""') + '"'].join(',');
      })].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-activity-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click(); URL.revokeObjectURL(url);
      toast.show('CSV exported (' + rows.length + ' entries)', 'success');
    } catch (err) { toast.show('Export failed', 'error'); }
  };

  useEffect(() => { fetchLogs(); }, [page, quickRange]);

  const actionColor = (action) => {
    if (action?.includes('issued') || action?.includes('approved') || action?.includes('conformant')) return '#5CD685';
    if (action?.includes('suspended') || action?.includes('revoked') || action?.includes('failed')) return '#D65C5C';
    if (action?.includes('pending') || action?.includes('under_review')) return '#D6A05C';
    return '#a896d6';
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const mono = "Consolas, 'IBM Plex Mono', monospace";
  const thStyle = {padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: mono, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,.50)'};

  return (
    <>
      <SectionHeader label="Account" title="My Activity" />
      <div className="space-y-6" style={{maxWidth: 'min(900px, 95vw)', margin: '0 auto'}}>

      <Panel>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
          {['7', '30', '90', 'all'].map(r => (
            <button key={r} onClick={() => { setQuickRange(r); setPage(0); }} style={{padding: '5px 10px', background: quickRange === r ? 'rgba(168,150,214,0.15)' : 'transparent', border: `1px solid ${quickRange === r ? 'rgba(168,150,214,0.4)' : 'rgba(255,255,255,.07)'}`, color: quickRange === r ? '#a896d6' : 'rgba(255,255,255,.50)', fontFamily: mono, fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px'}}>
              {r === 'all' ? 'All' : r + 'd'}
            </button>
          ))}
          <span style={{fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>{total.toLocaleString()} entries</span>
          <button onClick={exportCSV} style={{marginLeft: 'auto', padding: '6px 14px', background: 'rgba(157,140,207,0.12)', border: '1px solid rgba(157,140,207,0.3)', color: '#a896d6', fontFamily: mono, fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase'}}>Export CSV</button>
        </div>
      </Panel>

      <Panel noPad>
        {loading ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.50)'}}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: 'rgba(255,255,255,.50)'}}>No activity yet</div>
        ) : (
          <div style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr>
                  <th style={thStyle}>Timestamp</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Resource</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{borderBottom: '1px solid rgba(255,255,255,.04)'}}>
                    <td style={{padding: '12px 16px', fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,.78)', whiteSpace: 'nowrap'}}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                    <td style={{padding: '12px 16px'}}>
                      <span style={{fontFamily: mono, fontSize: '11px', color: actionColor(log.action), letterSpacing: '0.5px'}}>{log.action?.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{padding: '12px 16px', fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>
                      {log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ''}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '12px', color: 'rgba(255,255,255,.50)', maxWidth: '300px'}}>
                      {log.details ? Object.entries(log.details).filter(([k]) => k !== 'old_state').map(([k, v]) => (
                        <span key={k} style={{marginRight: '12px'}}><span style={{color: 'rgba(255,255,255,.50)'}}>{k.replace(/_/g, ' ')}:</span> <span style={{color: 'rgba(255,255,255,.78)'}}>{String(v)}</span></span>
                      )) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: '1px solid rgba(255,255,255,.04)'}}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{padding: '6px 12px', background: '#2a2f3d', border: '1px solid rgba(255,255,255,.07)', color: page === 0 ? 'rgba(255,255,255,.50)' : 'rgba(255,255,255,.94)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: '11px'}}>{'\u2190'} Prev</button>
            <span style={{padding: '6px 12px', fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,.78)'}}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={{padding: '6px 12px', background: '#2a2f3d', border: '1px solid rgba(255,255,255,.07)', color: page >= totalPages - 1 ? 'rgba(255,255,255,.50)' : 'rgba(255,255,255,.94)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: '11px'}}>Next {'\u2192'}</button>
          </div>
        )}
      </Panel>
    </div>
    </>
  );
}

export default MyActivityPage;
