import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Shield, AlertTriangle, RefreshCw, CheckCircle, XCircle, Activity, Clock, Eye } from 'lucide-react';
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
    case 'suspended': return styles.accentRed;
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
  const suspensions = suspensionsData?.suspended_certificates ?? [];
  const bd = status?.status_breakdown ?? {};

  const ackMutation = useMutation({
    mutationFn: (alertId) => api.post('/api/surveillance/alerts/' + alertId + '/acknowledge'),
    onSuccess: () => { qc.invalidateQueries(['surveillance-alerts']); toast.success('Alert acknowledged'); },
  });
  const reinstateMutation = useMutation({
    mutationFn: (certId) => api.post('/api/surveillance/reinstate/' + certId, null, { params: { reason: 'Manual reinstatement via dashboard' } }),
    onSuccess: () => { qc.invalidateQueries(['surveillance-suspensions']); qc.invalidateQueries(['surveillance-scores']); toast.success('Certificate reinstated'); },
  });

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

  const handleReinstate = async (certId) => {
    const yes = await confirm.ask('Reinstate certificate ' + certId + '? This will resume active monitoring.');
    if (yes) reinstateMutation.mutate(certId);
  };

  const filteredAlerts = alertFilter === 'all' ? alerts
    : alertFilter === 'unacked' ? alerts.filter(a => !a.acknowledged)
    : alerts.filter(a => a.severity === alertFilter);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' }}>
      <SectionHeader label="ENVELO Interlock" title="Continuous Enforcement" />

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
            <StatBlock label="HEALTHY" value={bd.healthy ?? 0} color={styles.accentGreen} />
            <StatBlock label="DEGRADED" value={bd.degraded ?? 0} color={(bd.degraded ?? 0) > 0 ? styles.accentAmber : styles.textDim} />
            <StatBlock label="CRITICAL" value={bd.critical ?? 0} color={(bd.critical ?? 0) > 0 ? styles.accentRed : styles.textDim} />
            <StatBlock label="OFFLINE" value={bd.offline ?? 0} color={(bd.offline ?? 0) > 0 ? styles.accentRed : styles.textDim} />
            <StatBlock label="SUSPENDED" value={bd.suspended ?? 0} color={(bd.suspended ?? 0) > 0 ? styles.accentRed : styles.textDim} />
            <StatBlock label="ALERTS" value={status?.unacknowledged_alerts ?? 0} color={(status?.unacknowledged_alerts ?? 0) > 0 ? styles.accentAmber : styles.textDim} />
          </div>
        )}
      </Panel>

      <Panel style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={Object.assign({}, label9, { marginBottom: 14 })}>CONFORMANCE SCORES</div>
        {scoresLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div>
        : scores.length === 0 ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '12px 0' }}>No active sessions being monitored</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['STATUS','SESSION','CERTIFICATE','SCORE','PASS','BLOCK','BLOCK RATE','LAST HEARTBEAT'].map(h => (
                  <th key={h} style={{ ...label9, textAlign: 'left', padding: '6px 10px 8px', borderBottom: '1px solid ' + styles.textDim + '22' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.session_id} style={{ borderBottom: i < scores.length - 1 ? '1px solid ' + styles.textDim + '11' : 'none' }}>
                    <td style={{ padding: '10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusDot status={s.status} /><span style={{ ...mono, fontSize: '10px', textTransform: 'uppercase', color: statusColor(s.status) }}>{s.status}</span></div></td>
                    <td style={{ ...mono, fontSize: '11px', padding: '10px', color: styles.textPrimary }}>{(s.session_id || '').substring(0, 16)}</td>
                    <td style={{ ...mono, fontSize: '11px', padding: '10px', color: styles.textSecondary }}>{s.certificate_id || '\u2014'}</td>
                    <td style={{ padding: '10px' }}><ScoreBar score={s.score ?? 0} /></td>
                    <td style={{ ...mono, fontSize: '12px', padding: '10px', color: styles.accentGreen }}>{(s.pass_count ?? 0).toLocaleString()}</td>
                    <td style={{ ...mono, fontSize: '12px', padding: '10px', color: (s.block_count ?? 0) > 0 ? styles.accentRed : styles.textDim }}>{(s.block_count ?? 0).toLocaleString()}</td>
                    <td style={{ ...mono, fontSize: '11px', padding: '10px', color: (s.block_rate ?? 0) > 0.02 ? styles.accentRed : styles.textSecondary }}>{((s.block_rate ?? 0) * 100).toFixed(2)}%</td>
                    <td style={{ ...mono, fontSize: '11px', padding: '10px', color: styles.textTertiary }}>{timeAgo(s.last_heartbeat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {suspensions.length > 0 && (
        <Panel style={{ marginBottom: 20, padding: '20px 24px', border: '1px solid ' + styles.accentRed + '33' }}>
          <div style={Object.assign({}, label9, { marginBottom: 14, color: styles.accentRed })}>AUTO-SUSPENDED CERTIFICATES</div>
          {suspensions.map(certId => (
            <div key={certId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + styles.textDim + '11' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StatusDot status="suspended" /><span style={{ ...mono, fontSize: '12px', color: styles.textPrimary }}>{certId}</span></div>
              <button onClick={() => handleReinstate(certId)} disabled={reinstateMutation.isLoading} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 4, border: '1px solid ' + styles.accentGreen + '55', background: styles.accentGreen + '0a', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', cursor: 'pointer' }}>
                <CheckCircle size={11} /> REINSTATE
              </button>
            </div>
          ))}
        </Panel>
      )}

      <Panel style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={label9}>ALERTS</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','unacked','warn','critical','suspension'].map(f => (
              <button key={f} onClick={() => setAlertFilter(f)} style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid ' + (alertFilter === f ? styles.purplePrimary : styles.textDim) + '33', background: alertFilter === f ? styles.purplePrimary + '0c' : 'transparent', color: alertFilter === f ? styles.purplePrimary : styles.textDim, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                {f === 'unacked' ? 'UNACKED' : f}
              </button>
            ))}
          </div>
        </div>
        {alertsLoading ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim }}>Loading...</div>
        : filteredAlerts.length === 0 ? <div style={{ ...mono, fontSize: '12px', color: styles.textDim, padding: '20px 0', textAlign: 'center' }}>{alerts.length === 0 ? 'No alerts \u2014 all systems nominal' : 'No alerts match this filter'}</div>
        : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredAlerts.slice().reverse().map((a, i) => (
              <div key={a.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + styles.textDim + '11', opacity: a.acknowledged ? 0.5 : 1 }}>
                <div style={{ width: 4, minHeight: 32, borderRadius: 2, flexShrink: 0, marginTop: 2, background: severityColor(a.severity) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ ...mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 2, background: severityColor(a.severity) + '15', color: severityColor(a.severity) }}>{a.severity}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim }}>{(a.alert_type || '').replace(/_/g, ' ')}</span>
                    <span style={{ ...mono, fontSize: '9px', color: styles.textDim, marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.5, color: styles.textPrimary }}>{a.message}</div>
                  <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary, marginTop: 2 }}>{a.certificate_id}{a.session_id ? ' \u00b7 ' + a.session_id.substring(0, 16) : ''}</div>
                </div>
                {!a.acknowledged && (
                  <button onClick={() => ackMutation.mutate(a.id)} disabled={ackMutation.isLoading} title="Acknowledge" style={{ padding: '3px 6px', border: '1px solid ' + styles.textDim + '33', background: 'transparent', borderRadius: 3, cursor: 'pointer', color: styles.textDim, flexShrink: 0, marginTop: 2 }}>
                    <Eye size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {status?.thresholds && (
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(status.thresholds).map(([k, v]) => (
            <div key={k} style={{ ...mono, fontSize: '9px', color: styles.textDim, padding: '3px 8px', border: '1px solid ' + styles.textDim + '22', borderRadius: 3 }}>
              {k.replace(/_/g, ' ')}: {v}
            </div>
          ))}
        </div>
      )}

      <style>{'\
        @keyframes sa-pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }\
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\
      '}</style>
    </div>
  );
}
