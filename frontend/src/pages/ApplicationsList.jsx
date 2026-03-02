import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Search, Plus, Clock, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
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

/* ── State helpers ──────────────────────────────────────────────────────────── */

function stateColor(state) {
  if (state === 'conformant') return styles.accentGreen;
  if (state === 'failed' || state === 'test_failed') return styles.accentRed;
  if (state === 'revoked' || state === 'suspended') return styles.accentRed;
  if (state === 'testing' || state === 'approved') return styles.purpleBright;
  return styles.accentAmber;
}

function stateLabel(state) {
  const labels = {
    pending: 'Pending Review',
    under_review: 'Under Review',
    approved: 'Awaiting Deploy',
    testing: 'CAT-72 Running',
    conformant: 'Certified',
    suspended: 'Suspended',
    revoked: 'Revoked',
    failed: 'Failed',
    test_failed: 'Test Failed',
  };
  return labels[state] || state?.replace(/_/g, ' ') || '—';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Workflow tab definitions ───────────────────────────────────────────────── */

const NEW_APPS = ['pending'];
const UNDER_REVIEW = ['under_review'];
const REJECTED = ['rejected', 'suspended'];

const TABS = [
  { key: 'new',       label: 'New',          states: NEW_APPS,     icon: AlertTriangle, color: styles.accentAmber },
  { key: 'review',    label: 'Under Review', states: UNDER_REVIEW, icon: Clock,         color: styles.purpleBright },
  { key: 'rejected',  label: 'Rejected',     states: REJECTED,     icon: AlertTriangle, color: styles.accentRed },
  { key: 'all',       label: 'All',          states: null,         icon: null,          color: styles.textTertiary },
];

const TH = {
  fontFamily: styles.mono, fontSize: '10px', fontWeight: 600,
  letterSpacing: '1px', textTransform: 'uppercase',
  color: styles.textTertiary, padding: '10px 16px', textAlign: 'left',
  borderBottom: '1px solid ' + styles.borderGlass, whiteSpace: 'nowrap',
};

/* ── Main component ─────────────────────────────────────────────────────────── */

function ApplicationsList() {
  const toast = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState('action');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchTimer = React.useRef(null);
  const handleSearch = (val) => {
    setSearchQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 200);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['applications', debouncedSearch],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      return api.get('/api/applications/', { params }).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const allApps = data?.applications ?? data ?? [];
  const stateCounts = data?.state_counts ?? {};
  const isAdmin = user?.role === 'admin';

  // Filter by tab
  const activeTab = TABS.find(t => t.key === tab);
  const filtered = activeTab?.states
    ? allApps.filter(a => activeTab.states.includes(a.state))
    : allApps;

  // Count per tab
  const tabCounts = {
    new: allApps.filter(a => NEW_APPS.includes(a.state)).length,
    review: allApps.filter(a => UNDER_REVIEW.includes(a.state)).length,
    rejected: allApps.filter(a => REJECTED.includes(a.state)).length,
    all: allApps.length,
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ['applications'] });

  const handleAction = async (appId, newState, label) => {
    if (!await confirm({ title: 'Confirm', message: label + '?' })) return;
    try {
      await api.patch('/api/applications/' + appId + '/state?new_state=' + newState);
      invalidate();
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <SectionHeader
        label={isAdmin ? 'Certification Pipeline' : 'My Organization'}
        title={isAdmin ? 'Applications' : 'Certification Status'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isFetching && !isLoading && (
              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>Updating…</span>
            )}
            {!isAdmin && (
              <Link to="/applications/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                background: styles.purplePrimary, color: '#fff',
                fontFamily: styles.mono, fontSize: '10px', fontWeight: 700,
                letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
              }}>
                <Plus size={12} /> New Application
              </Link>
            )}
          </div>
        }
      />

      {/* Search */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
            <input
              value={searchQuery} onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, org, or ID..."
              style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Workflow tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid ' + styles.borderSubtle, marginBottom: '16px' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const count = tabCounts[t.key] || 0;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'transparent',
                fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
                color: active ? (t.color || styles.purpleBright) : styles.textTertiary,
                borderBottom: active ? '2px solid ' + (t.color || styles.purpleBright) : '2px solid transparent',
                transition: 'color 0.2s',
              }}>
                {Icon && <Icon size={12} />}
                {t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {isAdmin && <th style={TH}>Organization</th>}
              <th style={TH}>System Name</th>
              <th style={TH}>State</th>
              <th style={TH}>Submitted</th>
              {isAdmin && <th style={TH}>Age</th>}
              {isAdmin && <th style={TH}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={isAdmin ? 6 : 3} style={{ padding: '40px', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={isAdmin ? 6 : 3} style={{ padding: '40px', textAlign: 'center' }}>
                <EmptyState
                  icon={tab === 'action' ? CheckCircle : FileText}
                  title={tab === 'action' ? "You're caught up" : 'No applications'}
                  description={tab === 'action' ? 'No applications need your attention right now.' : 'No applications match this filter.'}
                />
              </td></tr>
            ) : filtered.map(app => {
              const age = daysAgo(app.submitted_at);
              const stale = age !== null && age > 7 && NEW_APPS.includes(app.state) || UNDER_REVIEW.includes(app.state);
              return (
                <tr key={app.id} style={{
                  borderBottom: '1px solid ' + styles.borderSubtle,
                  borderLeft: stale ? '3px solid ' + styles.accentAmber : '3px solid transparent',
                  transition: 'background 0.15s', cursor: 'pointer',
                }}
                  onClick={() => navigate('/applications/' + app.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {isAdmin && <td style={{ padding: '12px 16px', fontWeight: 500, color: styles.textPrimary, fontSize: '13px' }}>{app.organization_name}</td>}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ color: styles.textSecondary, fontSize: '13px' }}>{app.system_name}</div>
                    <div style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, marginTop: '2px' }}>{app.application_number}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
                      padding: '3px 8px', color: stateColor(app.state),
                      background: stateColor(app.state) + '10',
                    }}>{stateLabel(app.state)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: styles.textTertiary, fontSize: '12px', fontFamily: styles.mono }}>{fmtDate(app.submitted_at)}</td>
                  {isAdmin && <td style={{ padding: '12px 16px', fontFamily: styles.mono, fontSize: '11px', color: stale ? styles.accentAmber : styles.textDim }}>
                    {age !== null ? age + 'd' : '—'}
                  </td>}
                  {isAdmin && (
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>

                        {/* NEEDS ACTION states */}
                        {app.state === 'pending' && (
                          <button onClick={() => handleAction(app.id, 'under_review', 'Begin review for ' + app.system_name)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Begin Review
                          </button>
                        )}
                        {app.state === 'under_review' && (<>
                          <button onClick={() => handleAction(app.id, 'approved', 'Approve ' + app.system_name)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Approve
                          </button>
                          <button onClick={() => handleAction(app.id, 'suspended', 'Reject ' + app.system_name)}
                            style={{ padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentRed, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Reject
                          </button>
                        </>)}

                        {/* IN PROGRESS — no admin action, just status */}
                        {app.state === 'approved' && (
                          <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, padding: '4px 0' }}>Awaiting customer deploy</span>
                        )}
                        {app.state === 'testing' && (
                          <Link to="/cat72" onClick={e => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' }}>
                            View Test <ArrowRight size={10} />
                          </Link>
                        )}

                        {/* No actions for approved+ states */}
                        {app.state === 'conformant' && (
                          <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.accentGreen }}>✓ Active</span>
                        )}

                        {/* ISSUES — recovery actions */}
                        {(app.state === 'suspended' || app.state === 'revoked') && (
                          <button onClick={() => handleAction(app.id, 'pending', 'Reinstate ' + app.system_name)}
                            style={{ padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Reinstate
                          </button>
                        )}
                        {(app.state === 'failed' || app.state === 'test_failed') && (
                          <button onClick={() => handleAction(app.id, 'testing', 'Retry CAT-72 for ' + app.system_name)}
                            style={{ padding: '4px 12px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Retry Test
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApplicationsList;
