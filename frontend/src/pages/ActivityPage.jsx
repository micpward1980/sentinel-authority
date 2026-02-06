import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function ActivityPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [quickRange, setQuickRange] = useState('30');

  const applyQuickRange = (range) => {
    setQuickRange(range);
    setPage(0);
    if (range === 'all') {
      setDateFrom('');
      setDateTo('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(range));
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo('');
    }
  };

  const verifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await api.get('/api/audit/verify?limit=5000');
      setVerifyResult(res.data);
      toast.show(res.data.integrity === 'passed' ? `Integrity verified — ${res.data.valid} entries valid` : `Integrity check FAILED — ${res.data.invalid} tampered entries`, res.data.integrity === 'passed' ? 'success' : 'error');
    } catch (err) { toast.show('Verification failed', 'error'); }
    setVerifying(false);
  };
  const [actions, setActions] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const PAGE_SIZE = 50;

  useEffect(() => {
    api.get('/api/audit/actions').then(r => setActions(r.data.actions || [])).catch(() => {});
    api.get('/api/audit/resource-types').then(r => setResourceTypes(r.data.resource_types || [])).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);
      if (emailFilter) params.set('user_email', emailFilter);
      if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
      params.set('limit', PAGE_SIZE);
      params.set('offset', page * PAGE_SIZE);
      const res = await api.get(`/api/audit/logs?${params}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
    setLoading(false);
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);
      if (emailFilter) params.set('user_email', emailFilter);
      if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
      params.set('limit', 10000);
      params.set('offset', 0);
      const res = await api.get(`/api/audit/logs?${params}`);
      const rows = res.data.logs || [];
      if (rows.length === 0) { toast.show('No entries to export', 'warning'); return; }
      const header = 'Timestamp,User,Action,Resource Type,Resource ID,Details,Hash';
      const csv = [header, ...rows.map(r => {
        const details = r.details ? Object.entries(r.details).map(([k,v]) => k + '=' + v).join('; ') : '';
        return [r.timestamp || '', r.user_email || '', r.action || '', r.resource_type || '', r.resource_id || '', '"' + details.replace(/"/g, '""') + '"', r.log_hash || ''].join(',');
      })].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'audit-log-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click(); URL.revokeObjectURL(url);
      toast.show('CSV exported (' + rows.length + ' entries)', 'success');
    } catch (err) { toast.show('Export failed', 'error'); }
  };

  useEffect(() => { fetchLogs(); }, [actionFilter, resourceFilter, emailFilter, dateFrom, dateTo, page]);

  const actionColor = (action) => {
    if (action?.includes('issued') || action?.includes('approved') || action?.includes('conformant')) return styles.accentGreen;
    if (action?.includes('suspended') || action?.includes('revoked') || action?.includes('failed')) return '#D65C5C';
    if (action?.includes('pending') || action?.includes('under_review')) return '#D6A05C';
    return styles.purpleBright;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <SectionHeader label="Administration" title="Activity History" />

      {/* Filters */}
      <Panel>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", minWidth: '180px'}}>
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={resourceFilter} onChange={e => { setResourceFilter(e.target.value); setPage(0); }} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", minWidth: '150px'}}>
            <option value="">All Resources</option>
            {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={emailFilter} onChange={e => { setEmailFilter(e.target.value); setPage(0); }} placeholder="Filter by email..." style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", flex: 1, minWidth: '150px'}} />
          {['7', '30', '90', 'all'].map(r => (
              <button key={r} onClick={() => applyQuickRange(r)} style={{padding: '5px 10px', background: quickRange === r ? 'rgba(168,150,214,0.15)' : 'transparent', border: `1px solid ${quickRange === r ? 'rgba(168,150,214,0.4)' : styles.borderGlass}`, borderRadius: '6px', color: quickRange === r ? styles.purpleBright : styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s ease'}}>
                {r === 'all' ? 'All' : r + 'd'}
              </button>
            ))}
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); setQuickRange(''); }} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", colorScheme: 'dark'}} />
          <span style={{fontSize: '11px', color: styles.textTertiary}}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); setQuickRange(''); }} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", colorScheme: 'dark'}} />
          <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{total.toLocaleString()} entries</span>
          <button onClick={exportCSV} style={{padding: '6px 14px', background: 'rgba(157,140,207,0.12)', border: '1px solid ' + 'rgba(157,140,207,0.3)', borderRadius: '8px', color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase'}}>Export CSV</button>
          <button onClick={verifyIntegrity} disabled={verifying} style={{padding: '6px 14px', background: verifyResult ? (verifyResult.integrity === 'passed' ? 'rgba(92,214,133,0.12)' : 'rgba(214,92,92,0.12)') : 'rgba(157,140,207,0.12)', border: '1px solid ' + (verifyResult ? (verifyResult.integrity === 'passed' ? 'rgba(92,214,133,0.3)' : 'rgba(214,92,92,0.3)') : 'rgba(157,140,207,0.3)'), borderRadius: '8px', color: verifyResult ? (verifyResult.integrity === 'passed' ? styles.accentGreen : '#D65C5C') : styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: verifying ? 'wait' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase'}}>
            {verifying ? 'Verifying...' : verifyResult ? (verifyResult.integrity === 'passed' ? `✓ ${verifyResult.valid} Verified` : `✗ ${verifyResult.invalid} Invalid`) : '⛓ Verify Chain'}
          </button>
        </div>
      </Panel>

      {/* Logs Table */}
      <Panel noPad>
        {loading ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: styles.textTertiary}}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', color: styles.textTertiary}}>No audit log entries found</div>
        ) : (
          <div className='table-scroll' style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: 'rgba(0,0,0,0.2)'}}>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Timestamp</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>User</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Action</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Resource</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Details</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Hash</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{borderBottom: `1px solid ${styles.borderSubtle}`}}>
                    <td style={{padding: '12px 16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textSecondary, whiteSpace: 'nowrap'}}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                    <td style={{padding: '12px 16px', fontSize: '13px', color: styles.textPrimary}}>{log.user_email || '-'}</td>
                    <td style={{padding: '12px 16px'}}>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: actionColor(log.action), letterSpacing: '0.5px'}}>{log.action}</span>
                    </td>
                    <td style={{padding: '12px 16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>
                      {log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ''}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '12px', color: styles.textTertiary, maxWidth: '300px'}}>
                      {log.details ? Object.entries(log.details).filter(([k]) => k !== 'old_state').map(([k, v]) => (
                        <span key={k} style={{marginRight: '12px'}}><span style={{color: styles.textTertiary}}>{k.replace(/_/g, ' ')}:</span> <span style={{color: styles.textSecondary}}>{String(v)}</span></span>
                      )) : '-'}
                    </td>
                    <td style={{padding: '12px 16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, letterSpacing: '0.5px'}}>{log.log_hash || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: `1px solid ${styles.borderSubtle}`}}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{padding: '6px 12px', background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: page === 0 ? styles.textTertiary : styles.textPrimary, cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>← Prev</button>
            <span style={{padding: '6px 12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textSecondary}}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={{padding: '6px 12px', background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: page >= totalPages - 1 ? styles.textTertiary : styles.textPrimary, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>Next →</button>
          </div>
        )}
      </Panel>
    </div>
  );
}


// ═══ My Activity (User-Facing Audit Log) ═══


export default ActivityPage;

