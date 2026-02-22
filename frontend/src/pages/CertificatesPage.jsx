import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import CopyableId from '../components/CopyableId';

function fmtUTC(ts) {
  if (!ts) return '—';
  return new Date(ts).toISOString().substring(0, 10);
}

function certVariant(state) {
  if (state === 'conformant' || state === 'active' || state === 'issued') return 'green';
  if (state === 'suspended') return 'amber';
  if (state === 'revoked')   return 'red';
  return 'dim';
}

function isActive(state) {
  return state === 'conformant' || state === 'active' || state === 'issued';
}

const TABS = [
  { key: 'active',    label: 'Active'    },
  { key: 'suspended', label: 'Suspended' },
  { key: 'revoked',   label: 'Revoked'   },
  { key: 'all',       label: 'All'       },
];

function CertificatesPage() {
  const [statusFilter, setStatusFilter] = useState('active');

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.get('/api/certificates/').then(r => r.data),
  });

  const counts = useMemo(() => ({
    all:       certificates.length,
    active:    certificates.filter(c => isActive(c.state)).length,
    suspended: certificates.filter(c => c.state === 'suspended').length,
    revoked:   certificates.filter(c => c.state === 'revoked').length,
  }), [certificates]);

  const filtered = useMemo(() => certificates.filter(c => {
    if (statusFilter === 'all')    return true;
    if (statusFilter === 'active') return isActive(c.state);
    return c.state === statusFilter;
  }), [certificates, statusFilter]);

  const COLUMNS = [
    {
      key: 'certificate_number',
      label: 'Certificate #',
      render: c => <CopyableId id={c.certificate_number} href={"/verify?cert=" + c.certificate_number} />,
    },
    {
      key: 'system_name',
      label: 'System',
      render: c => <span style={{ color: styles.textPrimary, fontWeight: 500 }}>{c.system_name}</span>,
    },
    { key: 'organization_name', label: 'Organization', style: { color: styles.textSecondary } },
    {
      key: 'state',
      label: 'Status',
      render: c => <Badge variant={certVariant(c.state)}>{c.state}</Badge>,
    },
    {
      key: 'expires_at',
      label: 'Expires (UTC)',
      style: { fontFamily: styles.mono, fontSize: '12px', color: styles.textTertiary },
      render: c => fmtUTC(c.expires_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: c => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isActive(c.state) ? (
            <a
              href={API_BASE + "/api/certificates/" + c.certificate_number + "/pdf"}
              target="_blank"
              rel="noreferrer noopener"
              style={{ padding: '3px 10px', background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
            >
              PDF
            </a>
          ) : (
            <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, textTransform: 'uppercase' }}>{c.state}</span>
          )}
          <Link
            to={"/verify?cert=" + c.certificate_number}
            style={{ padding: '3px 8px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textTertiary, fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
          >
            Verify
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>Records</p>
        <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>Certificates</h1>
        <p style={{ color: styles.textSecondary, marginTop: '8px', marginBottom: 0 }}>Issued ODDC conformance determinations</p>
      </div>

      <div style={{ display: 'flex', gap: '4px', border: `1px solid ${styles.borderGlass}`, padding: '4px' }}>
        {TABS.map(tab => {
          const active = statusFilter === tab.key;
          return (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} style={{
              flex: 1, padding: '7px 12px', border: 'none', cursor: 'pointer',
              fontFamily: styles.mono, fontSize: '10px', fontWeight: active ? 600 : 400,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: active ? 'rgba(29,26,59,0.08)' : 'transparent',
              color: active ? styles.purpleBright : styles.textTertiary,
            }}>
              {tab.label}{counts[tab.key] > 0 ? ` (${counts[tab.key]})` : ''}
            </button>
          );
        })}
      </div>

      <Panel>
        <DataTable
          columns={COLUMNS}
          rows={filtered}
          loading={isLoading}
          emptyMessage={certificates.length === 0 ? 'No certificates issued' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}certificates`}
        />
      </Panel>
    </div>
  );
}

export default CertificatesPage;
