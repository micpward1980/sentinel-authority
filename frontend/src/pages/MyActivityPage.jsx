import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
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
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [quickRange, setQuickRange] = useState('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actions, setActions] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const PAGE_SIZE = 30;

  useEffect(() => {
    api.get('/api/audit/actions').then(r => setActions(r.data.actions || [])).catch(() => {});
    api.get('/api/audit/resource-types').then(r => setResourceTypes(r.data.resource_types || [])).catch(() => {});
  }, []);

  const applyQuickRange = (range) => {
    setQuickRange(range);
    setPage(0);
    if (range === 'all') { setDateFrom(''); setDateTo(''); }
    else {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(range));
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo('');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE);
      params.set('offset', page * PAGE_SIZE);
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);
      if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
      if (!dateFrom && quickRange !== 'all') {
        const d = new Date(); d.setDate(d.getDate() - parseInt(quickRange || '30'));
        params.set('date_from', d.toISOString());
      }
      const res = await api.get(`/api/audit/my-logs?${params}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error('Failed to load activity:', err); }
    setLoading(false);
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);
      if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
      if (!dateFrom && quickRange !== 'all') {
        const d = new Date(); d.setDate(d.getDate() - parseInt(quickRange || '30'));
        params.set('date_from', d.toISOString());
      }
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

  useEffect(() => { fetchLogs(); }, [actionFilter, resourceFilter, dateFrom, dateTo, page, quickRange]);

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
    <div className="space-y-6">
      <SectionHeader label="Account" title="Activity History" />

      <Panel>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} style={{background: '#2a2f3d', border: '1px solid rgba(255,255,255,.07)', padding: '8px 12px', color: 'rgba(255,255,255,.94)', fontSize: '12px', fontFamily: mono, minWidth: '180px'}}>
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={resourceFilter} onChange={e => { setResourceFilter(e.target.value); setPage(0); }} style={{background: '#2a2f3d', border: '1px solid rgba(255,255,255,.07)', padding: '8px 12px', color: 'rgba(255,255,255,.94)', fontSize: '12px', fontFamily: mono, minWidth: '150px'}}>
            <option value="">All Resources</option>
            {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {['7', '30', '90', 'all'].map(r => (
            <button key={r} onClick={() => applyQuickRange(r)} style={{padding: '5px 10px', background: quickRange === r ? 'rgba(168,150,214,0.15)' : 'transparent', border: `1px solid ${quickRange === r ? 'rgba(168,150,214,0.4)' : 'rgba(255,255,255,.07)'}`, color: quickRange === r ? '#a896d6' : 'rgba(255,255,255,.50)', fontFamily: mono, fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px'}}>
              {r === 'all' ? 'All' : r + 'd'}
            </button>
          ))}
          <span style={{fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>{total.toLocaleString()} entries</span>
          <button onClick={exportCSV} style={{padding: '6px 14px', background: 'rgba(157,140,207,0.12)', border: '1px solid rgba(157,140,207,0.3)', color: '#a896d6', fontFamily: mono, fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase'}}>Export CSV</button>
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
  );
}

export default MyActivityPage;
