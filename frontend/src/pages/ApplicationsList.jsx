import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Plus } from "lucide-react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../config/api';
import { styles } from '../config/styles';
import SectionHeader from '../components/SectionHeader';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import useIsMobile from '../hooks/useIsMobile';

// ─── BulkImportModal (unchanged) ─────────────────────────────────────────────

export function BulkImportModal({ isOpen, onClose, onImport, boundaryType }) {
  const [raw, setRaw] = React.useState('');
  const [format, setFormat] = React.useState('json');
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(null);

  const templates = {
    numeric: { json: '[{"name":"Speed Limit","parameter":"speed","min_value":0,"max_value":100,"unit":"km/h","tolerance":5}]', csv: 'name,parameter,min_value,max_value,hard_limit,unit,tolerance\nSpeed Limit,speed,0,100,120,km/h,5' },
    geo:     { json: '[{"name":"Operating Zone","boundary_type":"circle","lat":30.123,"lon":-97.456,"radius_meters":500}]', csv: 'name,boundary_type,lat,lon,radius_meters,altitude_max\nOperating Zone,circle,30.123,-97.456,500,120' },
    time:    { json: '[{"name":"Business Hours","start_hour":6,"end_hour":22,"timezone":"America/Chicago","days":[0,1,2,3,4]}]', csv: 'name,start_hour,end_hour,timezone,days\nBusiness Hours,6,22,America/Chicago,0;1;2;3;4' },
    state:   { json: '[{"name":"Mode Check","parameter":"mode","allowed_values":"autonomous,semi-auto","forbidden_values":"manual_override"}]', csv: 'name,parameter,allowed_values,forbidden_values\nMode Check,mode,"autonomous,semi-auto",manual_override' },
  };

  const parseData = () => {
    setError(''); setPreview(null);
    try {
      let rows = [];
      if (format === 'json') {
        const parsed = JSON.parse(raw);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = raw.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV needs header + data rows');
        const headers = lines[0].split(',').map(h => h.trim());
        rows = lines.slice(1).map(line => {
          const vals = line.match(/(".*?"|[^,]+)/g) || [];
          const obj = {};
          headers.forEach((h, i) => {
            let v = (vals[i] || '').replace(/^"|"$/g, '').trim();
            obj[h] = h === 'days' ? v.split(';').map(Number) : v;
          });
          return obj;
        });
      }
      if (!rows.length) throw new Error('No data found');
      setPreview(rows);
    } catch (e) { setError(e.message); }
  };

  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: styles.bgDeep, border: '1px solid rgba(29,26,59,0.2)', padding: '32px', maxWidth: 'min(700px, 95vw)', width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: styles.serif, fontSize: '20px', fontWeight: 200, margin: 0 }}>Bulk Import — {boundaryType}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: styles.textTertiary, fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['json', 'csv'].map(f => (
            <button key={f} onClick={() => { setFormat(f); setError(''); setPreview(null); }} style={{ padding: '6px 16px', border: `1px solid ${format === f ? styles.purpleBright : styles.borderGlass}`, background: format === f ? 'rgba(29,26,59,0.08)' : 'transparent', color: format === f ? styles.purpleBright : styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>{f}</button>
          ))}
          <button onClick={() => setRaw(templates[boundaryType]?.[format] || '')} style={{ marginLeft: 'auto', padding: '6px 12px', border: `1px solid ${styles.borderGlass}`, background: 'transparent', color: styles.textTertiary, fontSize: '11px', cursor: 'pointer' }}>Load Example</button>
        </div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={10} placeholder={format === 'json' ? 'Paste JSON array...' : 'Paste CSV with header row...'} style={{ width: '100%', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '12px', color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', lineHeight: '1.5', resize: 'vertical', outline: 'none' }} />
        {error && <p style={{ color: styles.accentRed, fontSize: '12px', marginTop: '8px' }}>⚠ {error}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={parseData} style={{ padding: '8px 20px', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, background: 'transparent', color: styles.purpleBright, fontSize: '12px', cursor: 'pointer' }}>Preview</button>
          {preview && <button onClick={() => { onImport(preview); onClose(); setRaw(''); setPreview(null); }} style={{ padding: '8px 20px', border: 'none', background: 'transparent', color: styles.textPrimary, fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Import {preview.length} {preview.length === 1 ? 'boundary' : 'boundaries'}</button>}
        </div>
        {preview && (
          <div style={{ marginTop: '16px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
            <p style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, marginBottom: '8px' }}>PREVIEW ({preview.length} rows)</p>
            {preview.map((row, i) => (
              <div key={i} style={{ fontSize: '11px', color: styles.textTertiary, padding: '4px 0', borderBottom: `1px solid ${styles.borderSubtle}` }}>
                {Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateColor(state) {
  if (state === 'conformant') return styles.accentGreen;
  if (state === 'failed' || state === 'test_failed') return styles.accentRed;
  if (state === 'revoked' || state === 'suspended') return styles.accentRed;
  if (state === 'testing' || state === 'approved' || state === 'observe' || state === 'bounded') return styles.purpleBright;
  return styles.accentAmber;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

const TH = {
  fontFamily: styles.mono, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: styles.textTertiary,
  padding: '10px 16px', textAlign: 'left',
  borderBottom: `1px solid ${styles.borderGlass}`,
  whiteSpace: 'nowrap',
};

const ACTION_BTN = (color) => ({
  background: styles.cardSurface,
  border: `1px solid ${styles.borderSubtle}`,
  color, fontFamily: styles.mono,
  fontSize: '9px', letterSpacing: '0.06em',
  textTransform: 'uppercase', cursor: 'pointer',
  padding: '3px 8px',
});

// ─── ApplicationsList ─────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',          label: 'All'        },
  { key: 'pending',      label: 'Pending'    },
  { key: 'under_review', label: 'Review'     },
  { key: 'approved',     label: 'Approved'   },
  { key: 'observe',     label: 'Observe'    },
  { key: 'bounded',     label: 'CAT-72'     },
  { key: 'conformant',   label: 'Conformant' },
  { key: 'failed',       label: 'Failed'     },
  { key: 'revoked',      label: 'Suspended'  },
];

function ApplicationsList() {
  const toast = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Debounce search input (fixed)
  const searchTimer = React.useRef(null);
  const handleSearch = (val) => {
    setSearchQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 150);
  };

  // React Query — refetches when filter or debounced search changes
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['applications', filter, debouncedSearch],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (filter && filter !== 'all') params.state = filter;
      return api.get('/api/applications/', { params }).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const applications = data?.applications ?? data ?? [];
  const appTotal = data?.total ?? applications.length;
  const stateCounts = data?.state_counts ?? {};

  const invalidate = () => qc.invalidateQueries({ queryKey: ['applications'] });

  const prefetchApp = (id) => {
    qc.prefetchQuery({
      queryKey: ['application', id],
      queryFn: () => api.get(`/api/applications/${id}`).then(r => r.data),
      staleTime: 30000,
    });
  };

  const toggleSelect = useCallback((id) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  }), []);

  const selectAll  = () => setSelected(new Set(applications.map(a => a.id)));
  const selectNone = () => setSelected(new Set());

  const handleBulkAction = async (action, newState) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!await confirm({ title: 'Confirm', message: `${action} ${ids.length} application(s)?` })) return;
    setBulkLoading(true);
    try {
      if (action === 'delete') {
        await api.post('/api/applications/bulk-delete', { ids });
      } else {
        await api.post('/api/applications/bulk-state', { ids, new_state: newState });
      }
      setSelected(new Set());
      invalidate();
    } catch (err) {
      toast.show('Bulk operation failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setBulkLoading(false);
  };

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({ title: 'Confirm', message: label + '?' })) return;
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      invalidate();
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <SectionHeader
        label={isAdmin ? 'Conformance' : 'My Organization'}
        title={isAdmin ? 'Applications' : 'Certification Status'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isFetching && !isLoading && (
              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>Updating…</span>
            )}
            <Link to="/applications/new" className="no-underline" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
              background: styles.purplePrimary, borderRadius: '6px', color: '#fff',
              fontFamily: styles.mono, fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
            }}>
              <Plus size={12} />&nbsp;New Application
            </Link>
          </div>
        }
      />

      {/* Search */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 'min(400px, 90vw)' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textTertiary }} />
            <input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, org, or ID..."
              style={{ width: '100%', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '8px 12px 8px 36px', color: styles.textPrimary, fontSize: '13px', fontFamily: styles.mono, outline: 'none' }}
            />
          </div>
          <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{applications.length} of {appTotal}</span>
        </div>
      )}

      {/* Filter tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? (stateCounts.all || 0)
              : f.key === 'revoked'
                ? ((stateCounts.suspended || 0) + (stateCounts.revoked || 0))
                : (stateCounts[f.key] || 0);
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', cursor: 'pointer',
                fontFamily: styles.mono, fontSize: '10px', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background: active ? 'rgba(29,26,59,0.10)' : 'transparent',
                border: `1px solid ${active ? styles.purpleBright : styles.borderGlass}`,
                color: active ? styles.purpleBright : styles.textTertiary,
              }}>
                {f.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Panel>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ ...TH, width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.size > 0 && selected.size === applications.length} onChange={e => e.target.checked ? selectAll() : selectNone()} style={{ cursor: 'pointer', accentColor: styles.purpleBright }} />
                  </th>
                )}
                <th style={TH}>System Name</th>
                {isAdmin && <th style={TH}>Organization</th>}
                <th style={TH}>State</th>
                <th style={TH}>Submitted (UTC)</th>
                {isAdmin && <th style={TH}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={isAdmin ? 6 : 3} style={{ padding: '40px', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim }}>LOADING...</td></tr>
              ) : applications.map(app => (
                <tr key={app.id} onMouseEnter={() => prefetchApp(app.id)} style={{ borderBottom: `1px solid ${styles.borderSubtle}`, background: selected.has(app.id) ? 'rgba(29,26,59,0.04)' : 'transparent' }}>
                  {isAdmin && (
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelect(app.id)} style={{ cursor: 'pointer', accentColor: styles.purpleBright }} />
                    </td>
                  )}
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/applications/${app.id}`} style={{ color: styles.purpleBright, textDecoration: 'none', fontWeight: 500 }}>{app.system_name}</Link>
                    <CopyableId id={app.application_number} style={{ fontSize: '11px', color: styles.textDim }} />
                  </td>
                  {isAdmin && <td style={{ padding: '12px 16px', color: styles.textSecondary, fontSize: '13px' }}>{app.organization_name}</td>}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontFamily: styles.mono, fontSize: '10px', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '2px 8px',
                      background: `${stateColor(app.state)}10`,
                      color: stateColor(app.state),
                    }}>{app.state?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: styles.textTertiary, fontSize: '13px', fontFamily: styles.mono }}>{fmtDate(app.submitted_at)}</td>
                  {isAdmin && (
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {app.state === 'pending' && <button onClick={() => handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`)} style={ACTION_BTN(styles.accentAmber)}>Review</button>}
                        {(app.state === 'pending' || app.state === 'under_review') && <button onClick={() => handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`)} style={ACTION_BTN(styles.accentGreen)}>Approve</button>}
                        {app.state === 'approved' && <Link to={`/applications/${app.id}`} style={{ ...ACTION_BTN(styles.purpleBright), textDecoration: 'none' }}>Schedule Test</Link>}
                        {app.state === 'bounded' && <Link to="/cat72" style={{ ...ACTION_BTN(styles.purpleBright), textDecoration: 'none' }}>View Test</Link>}
                        {app.state === 'conformant' && <span style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.accentGreen }}>✓ Certified</span>}
                        {['pending', 'under_review', 'approved', 'observe', 'bounded', 'conformant', 'failed', 'test_failed'].includes(app.state) && <button onClick={() => handleQuickAdvance(app.id, 'suspended', `Suspend ${app.system_name}`)} style={ACTION_BTN(styles.accentRed)}>Suspend</button>}
                        {(app.state === 'suspended' || app.state === 'revoked') && <button onClick={() => handleQuickAdvance(app.id, 'pending', `Reinstate ${app.system_name}`)} style={ACTION_BTN(styles.accentGreen)}>Reinstate</button>}
                        {(app.state === 'failed' || app.state === 'test_failed') && <button onClick={() => handleQuickAdvance(app.id, 'bounded', `Retry CAT-72 for ${app.system_name}`)} style={ACTION_BTN(styles.accentAmber)}>Retry</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && isAdmin && (
          <div style={{ position: 'sticky', bottom: '16px', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '12px', padding: isMobile ? '12px 14px' : '12px 20px', margin: '16px 0 0', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', border: 'none', borderBottom: `1px solid ${styles.purpleBright}` }}>
            <span style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright }}>{selected.size} selected</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-end' }}>
              <button onClick={() => handleBulkAction('approve', 'approved')}   disabled={bulkLoading} style={ACTION_BTN(styles.accentGreen)}>Approve</button>
              <button onClick={() => handleBulkAction('review', 'under_review')} disabled={bulkLoading} style={ACTION_BTN(styles.accentAmber)}>Review</button>
              <button onClick={() => handleBulkAction('suspend', 'suspended')}  disabled={bulkLoading} style={ACTION_BTN(styles.accentRed)}>Suspend</button>
              <button onClick={() => handleBulkAction('reinstate', 'pending')}  disabled={bulkLoading} style={ACTION_BTN(styles.accentGreen)}>Reinstate</button>
              <div style={{ width: '1px', height: '20px', background: styles.borderGlass , borderRadius: 8}} />
              <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} style={ACTION_BTN(styles.accentRed)}>Delete</button>
              <button onClick={selectNone} style={ACTION_BTN(styles.textTertiary)}>Cancel</button>
              {bulkLoading && <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>Processing…</span>}
            </div>
          </div>
        )}

        {!isLoading && applications.length === 0 && (
          <EmptyState icon={FileText} title="No Applications Found" description={!data ? 'You haven\'t submitted any certification applications yet.' : 'No applications match your current filter.'} />
        )}
      </Panel>
    </div>
  );
}

export default ApplicationsList;

// This file was already written — patch only the prefetch hook into the component