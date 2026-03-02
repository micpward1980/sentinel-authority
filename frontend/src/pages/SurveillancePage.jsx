import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, AlertTriangle, RefreshCw, CheckCircle, XCircle, Activity, Clock } from 'lucide-react';
import { api } from '../config/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { styles } from '../config/styles';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function statusColor(status) {
  switch (status) {
    case 'healthy': return styles.accentGreen;
    case 'initializing': return styles.accentBlue;
    case 'degraded': case 'stale': return styles.accentAmber;
    case 'critical': case 'failing': case 'offline': return styles.accentRed;
    case 'non_conformant': return styles.accentRed;
    default: return styles.textDim;
  }
}

function severityColor(severity) {
  switch (severity) {
    case 'info': return styles.accentBlue;
    case 'warn': return styles.accentAmber;
    case 'critical': case 'suspension': case 'revocation': return styles.accentRed;
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

const mono = { fontFamily: styles.mono, letterSpacing: '0.5px' };
const label9 = { ...mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary };

function StatusDot({ status, size = 8 }) {
  const color = statusColor(status);
  const pulse = status === 'healthy' || status === 'initializing';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, boxShadow: pulse ? '0 0 6px ' + color : 'none',
      animation: pulse ? 'sa-pulse 2s ease-in-out infinite' : 'none', flexShrink: 0,
    }} />
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ ...mono, fontSize: '28px', fontWeight: 300, color: color || styles.textPrimary, lineHeight: 1.1 }}>{value}</div>
      <div style={{ ...label9, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ScoreBar({ score, width = 120 }) {
  const color = score >= 95 ? styles.accentGreen : score >= 80 ? styles.accentAmber : styles.accentRed;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width, height: 6, borderRadius: 3, background: styles.textDim + '22', overflow: 'hidden' }}>
        <div style={{ width: Math.min(100, Math.max(0, score)) + '%', height: '100%', borderRadius: 3, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ ...mono, fontSize: '12px', fontWeight: 600, color }}>{score.toFixed(1)}</span>
    </div>
  );
}

export default function SurveillancePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertFilter, setAlertFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  
  
  
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['surveillance-status'],
    queryFn: () => api.get('/api/surveillance/status').then(r => r.data),
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ['surveillance-scores'],
    queryFn: () => api.get('/api/surveillance/scores').then(r => r.data),
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const { data: certsData } = useQuery({
    queryKey: ['surveillance-certs'],
    queryFn: () => api.get('/api/v1/certificates/list').then(r => r.data),
    staleTime: 60000,
  });
  const { data: appsData } = useQuery({
    queryKey: ['surveillance-apps'],
    queryFn: () => api.get('/api/applications').then(r => r.data),
    staleTime: 60000,
  });
  const certLookup = (() => {
    const map = {};
    (certsData?.certificates ?? certsData ?? []).forEach(c => {
      map[c.certificate_number] = { org: c.organization_name || c.organization, system: c.system_name };
    });
    (appsData?.applications ?? appsData ?? []).forEach(a => {
      if (a.application_number) map[a.application_number] = { org: a.organization_name || a.organization, system: a.system_name };
      if (a.certificate_number) map[a.certificate_number] = { org: a.organization_name || a.organization, system: a.system_name };
    });
    return map;
  })();

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['surveillance-alerts'],
    queryFn: () => api.get('/api/surveillance/alerts?limit=100').then(r => r.data),
    refetchInterval: autoRefresh ? 15000 : false,
  });
  const { data: suspensionsData } = useQuery({
    queryKey: ['surveillance-suspensions'],
    queryFn: () => api.get('/api/surveillance/suspensions').then(r => r.data),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const status = statusData ?? null;
  const scores = scoresData?.scores ?? [];
  const alerts = alertsData?.alerts ?? [];
  const suspensions = suspensionsData?.non_conformant_certificates ?? [];
  const bd = status?.status_breakdown ?? {};

  const problemStatuses = ['degraded', 'stale', 'critical', 'failing', 'offline', 'non_conformant'];




  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries(['surveillance-status']),
      qc.invalidateQueries(['surveillance-scores']),
      qc.invalidateQueries(['surveillance-alerts']),
      qc.invalidateQueries(['surveillance-suspensions']),
    ]);
    setTimeout(() => setRefreshing(false), 600);
  }, [qc]);



  const filteredAlerts = alertFilter === 'all' ? alerts
    : alerts.filter(a => a.severity === alertFilter);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' }}>
      <SectionHeader label="Post-Certification" title="Conformance Surveillance" />

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

      <Panel style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={Object.assign({}, label9, { marginBottom: 14 })}>MONITORED SESSIONS</div>
        {statusLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'flex-start' }}>
            <StatBlock label="TOTAL" value={status?.monitored_sessions ?? 0} />
            <StatBlock label="CONFORMANT" value={bd.healthy ?? 0} color={(bd.healthy ?? 0) > 0 ? styles.accentGreen : styles.textDim} />
            <StatBlock label="NON-CONFORMANT" value={(bd.degraded ?? 0) + (bd.critical ?? 0) + (bd.offline ?? 0) + (bd.non_conformant ?? 0)} color={((bd.degraded ?? 0) + (bd.critical ?? 0) + (bd.offline ?? 0) + (bd.non_conformant ?? 0)) > 0 ? styles.accentRed : styles.textDim} />
            <StatBlock label="ALERTS" value={alerts.length} color={(alerts.length) > 0 ? styles.accentAmber : styles.textDim} />
          </div>
        )}
      </Panel>




      <Panel style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={label9}>ALERTS</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','warn','critical'].map(f => (
              <button key={f} onClick={() => setAlertFilter(f)} style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid ' + (alertFilter === f ? styles.purplePrimary : styles.textDim) + '33', background: alertFilter === f ? styles.purplePrimary + '0c' : 'transparent', color: alertFilter === f ? styles.purplePrimary : styles.textDim, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                {f === 'unreviewed' ? 'UNREVIEWED' : f}
              </button>
            ))}
          </div>
        </div>
        {alertsLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div>
        : filteredAlerts.length === 0 ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '20px 0', textAlign: 'center' }}>{alerts.length === 0 ? 'No alerts \u2014 all systems nominal' : 'No alerts match this filter'}</div>
        : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredAlerts.slice().reverse().map((a, i) => (
              <div key={a.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + styles.textDim + '11', opacity: 1 }}>
                <div style={{ width: 4, minHeight: 32, borderRadius: 2, flexShrink: 0, marginTop: 2, background: severityColor(a.severity) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ ...mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 2, background: severityColor(a.severity) + '15', color: severityColor(a.severity) }}>{a.severity}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim }}>{(a.alert_type || '').replace(/_/g, ' ')}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim, marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.5, color: styles.textPrimary }}>{a.message}</div>
                  <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary, marginTop: 2 }}>
                    {a.organization ? (
                      <><span style={{ color: styles.textSecondary, fontWeight: 600 }}>{a.organization}</span> — {a.system_name} · </>
                    ) : null}
                    {a.certificate_id}{a.session_id ? ' · ' + a.session_id.substring(0, 16) : ''}
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
