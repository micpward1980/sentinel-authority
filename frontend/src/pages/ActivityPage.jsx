import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUTC(ts) {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}

function actionVariant(action) {
  if (!action) return 'dim';
  if (action.includes('issued') || action.includes('approved') || action.includes('conformant')) return 'green';
  if (action.includes('suspended') || action.includes('revoked') || action.includes('failed')) return 'red';
  if (action.includes('pending') || action.includes('under_review')) return 'amber';
  return 'purple';
}

function buildParams({ actionFilter, resourceFilter, emailFilter, dateFrom, dateTo, page, limit }) {
  const p = new URLSearchParams();
  if (actionFilter)   p.set('action', actionFilter);
  if (resourceFilter) p.set('resource_type', resourceFilter);
  if (emailFilter)    p.set('user_email', emailFilter);
  if (dateFrom)       p.set('date_from', new Date(dateFrom).toISOString());
  if (dateTo)         p.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
  p.set('limit',  limit);
  p.set('offset', page * limit);
  return p.toString();
}

const PAGE_SIZE = 50;

const FILTER_INPUT = {
  background: styles.cardSurface,
  border: `1px solid ${styles.borderGlass}`,
  padding: '7px 12px',
  color: styles.textPrimary,
  fontSize: '12px',
  fontFamily: styles.mono,
  outline: 'none',
};

// ─── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: 'timestamp',
    label: 'Timestamp (UTC)',
    style: { whiteSpace: 'nowrap', fontFamily: styles.mono, fontSize: '11px', color: styles.textSecondary },
    render: r => fmtUTC(r.timestamp),
  },
  {
    key: 'user_email',
    label: 'User',
    render: r => r.user_email || '—',
  },
  {
    key: 'action',
    label: 'Action',
    render: r => <Badge variant={actionVariant(r.action)}>{r.action}</Badge>,
  },
  {
    key: 'resource',
    label: 'Resource',
    style: { fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary },
    render: r => r.resource_type ? `${r.resource_type}${r.resource_id ? ` #${r.resource_id}` : ''}` : '—',
  },
  {
    key: 'details',
    label: 'Details',
    style: { maxWidth: '280px', fontSize: '12px' },
    render: r => r.details
      ? Object.entries(r.details).filter(([k]) => k !== 'old_state').map(([k, v]) => (
          <span key={k} style={{ marginRight: '10px' }}>
            <span style={{ color: styles.textTertiary }}>{k.replace(/_/g, ' ')}:</span>{' '}
            <span style={{ color: styles.textSecondary }}>{String(v)}</span>
          </span>
        ))
      : '—',
  },
  {
    key: 'log_hash',
    label: 'Hash',
    style: { fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, letterSpacing: '0.04em', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    render: r => r.log_hash ? r.log_hash.substring(0, 16) + '…' : '—',
  },
];

// ─── ActivityPage ─────────────────────────────────────────────────────────────

function ActivityPage() {
  const toast = useToast();

  const [actionFilter,   setActionFilter]   = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [emailFilter,    setEmailFilter]    = useState('');
  const [page,           setPage]           = useState(0);
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [quickRange,     setQuickRange]     = useState('30');
  const [verifyResult,   setVerifyResult]   = useState(null);
  const [verifying,      setVerifying]      = useState(false);

  // Reference data
  const { data: actionsData }  = useQuery({ queryKey: ['audit-actions'],  queryFn: () => api.get('/api/audit/actions').then(r => r.data.actions || []),         staleTime: Infinity });
  const { data: resourcesData } = useQuery({ queryKey: ['audit-resources'], queryFn: () => api.get('/api/audit/resource-types').then(r => r.data.resource_types || []), staleTime: Infinity });

  const actions       = actionsData  ?? [];
  const resourceTypes = resourcesData ?? [];

  // Logs query
  const queryKey = ['audit-logs', actionFilter, resourceFilter, emailFilter, dateFrom, dateTo, page];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = buildParams({ actionFilter, resourceFilter, emailFilter, dateFrom, dateTo, page, limit: PAGE_SIZE });
      return api.get(`/api/audit/logs?${qs}`).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const logs  = data?.logs  ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const applyQuickRange = useCallback((range) => {
    setQuickRange(range);
    setPage(0);
    if (range === 'all') {
      setDateFrom(''); setDateTo('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(range));
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo('');
    }
  }, []);

  const exportCSV = async () => {
    try {
      const qs = buildParams({ actionFilter, resourceFilter, emailFilter, dateFrom, dateTo, page: 0, limit: 10000 });
      const res = await api.get(`/api/audit/logs?${qs}`);
      const rows = res.data.logs || [];
      if (!rows.length) { toast.show('No entries to export', 'warning'); return; }
      const header = 'Timestamp,User,Action,Resource Type,Resource ID,Details,Hash';
      const csv = [header, ...rows.map(r => {
        const details = r.details ? Object.entries(r.details).map(([k, v]) => `${k}=${v}`).join('; ') : '';
        return [r.timestamp || '', r.user_email || '', r.action || '', r.resource_type || '', r.resource_id || '', `"${details.replace(/"/g, '""')}"`, r.log_hash || ''].join(',');
      })].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.show(`CSV exported (${rows.length} entries)`, 'success');
    } catch { toast.show('Export failed', 'error'); }
  };

  const verifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await api.get('/api/audit/verify?limit=5000');
      setVerifyResult(res.data);
      toast.show(
        res.data.integrity === 'passed'
          ? `Integrity verified — ${res.data.valid} entries valid`
          : `Integrity check FAILED — ${res.data.invalid} tampered entries`,
        res.data.integrity === 'passed' ? 'success' : 'error'
      );
    } catch { toast.show('Verification failed', 'error'); }
    setVerifying(false);
  };

  const resetFilter = (setter) => { setter(''); setPage(0); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader label="Administration" title="Activity Log" />

      {/* Filters */}
      <Panel>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} style={{ ...FILTER_INPUT, minWidth: '160px' }}>
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={resourceFilter} onChange={e => { setResourceFilter(e.target.value); setPage(0); }} style={{ ...FILTER_INPUT, minWidth: '140px' }}>
            <option value="">All Resources</option>
            {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <input
            value={emailFilter}
            onChange={e => { setEmailFilter(e.target.value); setPage(0); }}
            placeholder="Filter by email..."
            style={{ ...FILTER_INPUT, flex: 1, minWidth: '150px' }}
          />

          {/* Quick ranges */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['7', '30', '90', 'all'].map(r => (
              <button key={r} onClick={() => applyQuickRange(r)} style={{
                padding: '5px 10px', cursor: 'pointer',
                background: quickRange === r ? 'rgba(29,26,59,0.08)' : 'transparent',
                border: `1px solid ${quickRange === r ? styles.purpleBright : styles.borderGlass}`,
                color: quickRange === r ? styles.purpleBright : styles.textTertiary,
                fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
              }}>
                {r === 'all' ? 'All' : `${r}d`}
              </button>
            ))}
          </div>

          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); setQuickRange(''); }} style={{ ...FILTER_INPUT, colorScheme: 'light' }} />
          <span style={{ fontSize: '11px', color: styles.textTertiary }}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); setQuickRange(''); }} style={{ ...FILTER_INPUT, colorScheme: 'light' }} />

          <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, whiteSpace: 'nowrap' }}>
            {total.toLocaleString()} entries{isFetching && !isLoading ? ' ↻' : ''}
          </span>

          <button onClick={exportCSV} style={{ padding: '6px 14px', background: 'rgba(29,26,59,0.08)', border: `1px solid rgba(29,26,59,0.15)`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Export CSV
          </button>

          <button onClick={verifyIntegrity} disabled={verifying} style={{
            padding: '6px 14px', cursor: verifying ? 'wait' : 'pointer',
            fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: verifyResult ? (verifyResult.integrity === 'passed' ? 'rgba(22,135,62,0.08)' : 'rgba(180,52,52,0.08)') : 'rgba(29,26,59,0.08)',
            border: `1px solid ${verifyResult ? (verifyResult.integrity === 'passed' ? 'rgba(22,135,62,0.20)' : 'rgba(180,52,52,0.20)') : 'rgba(29,26,59,0.15)'}`,
            color: verifyResult ? (verifyResult.integrity === 'passed' ? styles.accentGreen : styles.accentRed) : styles.purpleBright,
          }}>
            {verifying ? 'Verifying…' : verifyResult
              ? (verifyResult.integrity === 'passed' ? `✓ ${verifyResult.valid} Verified` : `✗ ${verifyResult.invalid} Invalid`)
              : '⛓ Verify Chain'}
          </button>
        </div>
      </Panel>

      {/* Table */}
      <Panel>
        <DataTable
          columns={COLUMNS}
          rows={logs}
          loading={isLoading}
          emptyMessage="No audit log entries found"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px 0 0', borderTop: `1px solid ${styles.borderSubtle}` }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '5px 12px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: page === 0 ? styles.textDim : styles.textPrimary, cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: styles.mono, fontSize: '11px' }}>
              ← Prev
            </button>
            <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textSecondary }}>
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '5px 12px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: page >= totalPages - 1 ? styles.textDim : styles.textPrimary, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontFamily: styles.mono, fontSize: '11px' }}>
              Next →
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default ActivityPage;
