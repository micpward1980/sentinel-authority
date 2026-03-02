import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import Panel from '../components/Panel';
import Pagination from '../components/Pagination';
import SectionHeader from '../components/SectionHeader';

function statusColor(status) {
  switch (status) {
    case 'healthy': case 'conformant': return styles.accentGreen;
    case 'degraded': return styles.accentAmber;
    case 'critical': case 'offline': case 'non_conformant': return styles.accentRed;
    default: return styles.textDim;
  }
}

function severityColor(severity) {
  switch (severity) {
    case 'info': return styles.accentBlue || '#4A90D9';
    case 'warn': return styles.accentAmber;
    case 'critical': case 'non_conformant': return styles.accentRed;
    default: return styles.textDim;
  }
}

function timeAgo(isoString) {
  if (!isoString) return '\u2014';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function lastSeenLabel(seconds) {
  if (seconds == null) return '\u2014';
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

const mono = { fontFamily: styles.mono, letterSpacing: '0.5px' };
const label9 = { ...mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary };

function StatusDot({ status, size = 8 }) {
  const color = statusColor(status);
  const pulse = status === 'healthy' || status === 'conformant';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, boxShadow: pulse ? '0 0 6px ' + color : 'none',
      animation: pulse ? 'sa-pulse 2s ease-in-out infinite' : 'none', flexShrink: 0,
    }} />
  );
}

function StatBlock({ label, value, color, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      textAlign: 'center', minWidth: 80, cursor: onClick ? 'pointer' : 'default',
      padding: '8px 16px', borderRadius: 6, transition: 'all 0.15s',
      background: active ? (color || styles.purplePrimary) + '08' : 'transparent',
      border: active ? '1px solid ' + (color || styles.purplePrimary) + '33' : '1px solid transparent',
    }}>
      <div style={{ ...mono, fontSize: '28px', fontWeight: 300, color: color || styles.textPrimary, lineHeight: 1.1 }}>{value}</div>
      <div style={{ ...label9, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ScoreBar({ score, width = 80 }) {
  const color = score >= 95 ? styles.accentGreen : score >= 80 ? styles.accentAmber : styles.accentRed;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width, height: 5, borderRadius: 3, background: styles.textDim + '22', overflow: 'hidden' }}>
        <div style={{ width: Math.min(100, Math.max(0, score)) + '%', height: '100%', borderRadius: 3, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ ...mono, fontSize: '11px', fontWeight: 600, color }}>{score.toFixed(1)}</span>
    </div>
  );
}

function SortTh({ label, field, currentSort, currentOrder, onSort }) {
  const active = currentSort === field;
  return (
    <div onClick={() => onSort(field, active && currentOrder === 'asc' ? 'desc' : 'asc')}
      style={{ ...label9, fontSize: '8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: active ? styles.purplePrimary : styles.textTertiary }}>
      {label}{active && <span style={{ marginLeft: 3, fontSize: '8px' }}>{currentOrder === 'asc' ? '\u2191' : '\u2193'}</span>}
    </div>
  );
}

export default function SurveillancePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemFilter, setSystemFilter] = useState('all');
  const [systemSearch, setSystemSearch] = useState('');
  const [systemSort, setSystemSort] = useState('system_name');
  const [systemOrder, setSystemOrder] = useState('asc');
  const [systemOffset, setSystemOffset] = useState(0);
  const [alertFilter, setAlertFilter] = useState('all');
  const systemLimit = 25;

  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['surveillance-status'],
    queryFn: () => api.get('/api/surveillance/status').then(r => r.data),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const systemsQueryKey = ['surveillance-systems', systemFilter, systemSearch, systemSort, systemOrder, systemOffset];
  const { data: systemsData, isLoading: systemsLoading } = useQuery({
    queryKey: systemsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        limit: systemLimit, offset: systemOffset, sort_by: systemSort, sort_order: systemOrder,
      });
      if (systemFilter !== 'all') params.set('status', systemFilter);
      if (systemSearch) params.set('search', systemSearch);
      return api.get('/api/surveillance/systems?' + params.toString()).then(r => r.data);
    },
    refetchInterval: autoRefresh ? 15000 : false,
    keepPreviousData: true,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['surveillance-alerts'],
    queryFn: () => api.get('/api/surveillance/alerts?limit=100').then(r => r.data),
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const status = statusData ?? null;
  const bd = status?.status_breakdown ?? {};
  const systems = systemsData?.systems ?? [];
  const systemsTotal = systemsData?.total ?? 0;
  const alerts = alertsData?.alerts ?? [];
  const filteredAlerts = alertFilter === 'all' ? alerts : alerts.filter(a => a.severity === alertFilter);
  const nonConformantCount = (bd.degraded ?? 0) + (bd.critical ?? 0) + (bd.offline ?? 0) + (bd.non_conformant ?? 0);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries(['surveillance-status']),
      qc.invalidateQueries(['surveillance-systems']),
      qc.invalidateQueries(['surveillance-alerts']),
    ]);
    setTimeout(() => setRefreshing(false), 600);
  }, [qc]);

  const handleSystemFilter = (filter) => {
    setSystemFilter(filter);
    setSystemOffset(0);
    
  };

  const handleSystemSort = (field, order) => {
    setSystemSort(field);
    setSystemOrder(order);
    setSystemOffset(0);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' }}>
      <SectionHeader label="Post-Certification" title="Conformance Surveillance" />

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, background: (status?.engine === 'running' ? styles.accentGreen : styles.accentRed) + '12', border: '1px solid ' + (status?.engine === 'running' ? styles.accentGreen : styles.accentRed) + '33' }}>
            <StatusDot status={status?.engine === 'running' ? 'healthy' : 'offline'} size={6} />
            <span style={{ ...mono, fontSize: '10px', color: status?.engine === 'running' ? styles.accentGreen : styles.accentRed }}>ENGINE {status?.engine === 'running' ? 'ACTIVE' : 'STOPPED'}</span>
          </div>
          <span style={{ ...mono, fontSize: '10px', color: styles.textDim }}>scan every {status?.scan_interval_seconds ?? '\u2014'}s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: styles.purplePrimary }} />
            <span style={{ ...mono, fontSize: '10px', color: styles.textSecondary }}>AUTO-REFRESH</span>
          </label>
          <button onClick={handleRefresh} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid ' + styles.purplePrimary + '33', background: 'transparent', color: styles.purplePrimary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', cursor: 'pointer', borderRadius: 4, opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      <Panel style={{ marginBottom: 20, padding: '20px 24px' }}>
        {statusLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' }}>
            <StatBlock label="TOTAL" value={status?.monitored_sessions ?? 0} active={systemFilter === 'all'} onClick={() => handleSystemFilter('all')} />
            <StatBlock label="CONFORMANT" value={bd.healthy ?? 0} color={(bd.healthy ?? 0) > 0 ? styles.accentGreen : styles.textDim} active={systemFilter === 'conformant'} onClick={() => handleSystemFilter('conformant')} />
            <StatBlock label="NON-CONFORMANT" value={nonConformantCount} color={nonConformantCount > 0 ? styles.accentRed : styles.textDim} active={systemFilter === 'non_conformant'} onClick={() => handleSystemFilter('non_conformant')} />
            <StatBlock label="ALERTS" value={alerts.length} color={alerts.length > 0 ? styles.accentAmber : styles.textDim} active={false} onClick={() => { setAlertFilter('all');  }} />
          </div>
        )}
      </Panel>

      {/* Systems Table */}
      <Panel id="systems-panel" style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={label9}>MONITORED SYSTEMS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
              <input type="text" placeholder="Search systems..." value={systemSearch}
                onChange={e => { setSystemSearch(e.target.value); setSystemOffset(0); }}
                style={{ padding: '5px 8px 5px 26px', border: '1px solid ' + styles.textDim + '33', borderRadius: 4, fontSize: '11px', fontFamily: styles.mono, color: styles.textPrimary, background: 'transparent', width: 180, outline: 'none' }} />
            </div>
            <span style={{ ...mono, fontSize: '10px', color: styles.textDim }}>{systemsTotal} system{systemsTotal !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {systemsLoading && systems.length === 0 ? (
          <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '24px 0', textAlign: 'center' }}>Loading...</div>
        ) : systems.length === 0 ? (
          <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '24px 0', textAlign: 'center' }}>
            {systemSearch ? 'No systems match your search' : 'No monitored systems'}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1.4fr 1fr 90px 110px 80px 80px 70px', gap: 8, padding: '8px 0', borderBottom: '1px solid ' + (styles.borderGlass || styles.textDim + '22'), alignItems: 'center' }}>
              <div />
              <SortTh label="SYSTEM" field="system_name" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
              <SortTh label="ORGANIZATION" field="organization_name" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
              <SortTh label="STATUS" field="status" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
              <SortTh label="SCORE" field="score" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
              <div style={{ ...label9, fontSize: '8px' }}>ACTIONS</div>
              <SortTh label="BLOCK %" field="block_rate" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
              <SortTh label="LAST SEEN" field="last_seen" currentSort={systemSort} currentOrder={systemOrder} onSort={handleSystemSort} />
            </div>

            {systems.map((s, i) => (
              <div key={s.session_id || i}
                onClick={() => s.application_id ? navigate('/applications/' + s.application_id) : null}
                onMouseEnter={e => e.currentTarget.style.background = styles.purplePrimary + '04'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ display: 'grid', gridTemplateColumns: '28px 1.4fr 1fr 90px 110px 80px 80px 70px', gap: 8, padding: '10px 0', borderBottom: '1px solid ' + styles.textDim + '0a', cursor: s.application_id ? 'pointer' : 'default', alignItems: 'center', transition: 'background 0.1s' }}>
                <StatusDot status={s.status} size={7} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: styles.textPrimary }}>{s.system_name}</div>
                  <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary }}>{s.certificate_number}</div>
                </div>
                <div style={{ fontSize: '12px', color: styles.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.organization_name}</div>
                <div style={{ ...mono, fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: s.status === 'conformant' ? styles.accentGreen : s.status === 'degraded' ? styles.accentAmber : styles.accentRed }}>
                  {s.status === 'conformant' ? 'Conformant' : s.status === 'degraded' ? 'Degraded' : 'Non-Conf.'}
                </div>
                <ScoreBar score={s.score} />
                <div style={{ ...mono, fontSize: '11px', color: styles.textSecondary }}>{s.total_actions.toLocaleString()}</div>
                <div style={{ ...mono, fontSize: '11px', color: s.block_rate > 1.5 ? styles.accentRed : s.block_rate > 0.5 ? styles.accentAmber : styles.textSecondary }}>{s.block_rate}%</div>
                <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary }}>{lastSeenLabel(s.last_seen_seconds)}</div>
              </div>
            ))}

            <Pagination total={systemsTotal} limit={systemLimit} offset={systemOffset} onChange={setSystemOffset} />
          </>
        )}
      </Panel>

      {/* Alerts */}
      <Panel id="alerts-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={label9}>ALERTS</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'warn', 'critical', 'info'].map(f => (
              <button key={f} onClick={() => setAlertFilter(f)} style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid ' + (alertFilter === f ? styles.purplePrimary : styles.textDim) + '33', background: alertFilter === f ? styles.purplePrimary + '0c' : 'transparent', color: alertFilter === f ? styles.purplePrimary : styles.textDim, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {alertsLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div>
        : filteredAlerts.length === 0 ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '20px 0', textAlign: 'center' }}>{alerts.length === 0 ? 'No alerts \u2014 all systems nominal' : 'No alerts match this filter'}</div>
        : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredAlerts.slice().reverse().map((a, i) => (
              <div key={a.id || i}
                onClick={() => navigate('/certificates')}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + styles.textDim + '11' }}>
                <div style={{ width: 4, minHeight: 32, borderRadius: 2, flexShrink: 0, marginTop: 2, background: severityColor(a.severity) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ ...mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 2, background: severityColor(a.severity) + '15', color: severityColor(a.severity) }}>{a.severity}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim }}>{(a.alert_type || '').replace(/_/g, ' ')}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim, marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.5, color: styles.textPrimary }}>{a.message}</div>
                  <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary, marginTop: 2 }}>
                    {a.certificate_id}{a.session_id ? ' \u00b7 ' + a.session_id.substring(0, 16) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <style>{'\
        @keyframes sa-pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }\
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\
      '}</style>
    </div>
  );
}
