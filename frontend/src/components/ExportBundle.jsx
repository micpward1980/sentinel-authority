import React, { useState } from 'react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';

function fmtUTC(ts) {
  if (!ts) return null;
  return new Date(ts).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(rows, headers, filename) {
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = String(r[h] ?? '').replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? '"' + val + '"' : val;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const BTN = (color) => ({
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '7px 14px', background: styles.cardSurface,
  border: '1px solid ' + styles.borderGlass,
  color: color || styles.purpleBright,
  fontFamily: styles.mono, fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none',
});

export default function ExportBundle({ app, history = [], comments = [], isAdmin = false }) {
  const [loading, setLoading] = useState({});
  const [certs, setCerts] = React.useState([]);

  React.useEffect(() => {
    api.get('/api/certificates/').then(res => {
      const all = res.data ?? [];
      setCerts(all.filter(c => c.application_id === app.id || c.system_name === app.system_name));
    }).catch(() => {});
  }, [app.id]);

  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  const activeCert = certs.find(c => ['conformant','active','issued'].includes(c.state));

  const exportJSON = async () => {
    setLoad('json', true);
    try {
      let auditLogs = [];
      try {
        const res = await api.get('/api/audit/logs?resource_type=application&resource_id=' + app.id + '&limit=200&offset=0');
        auditLogs = res.data.logs ?? [];
      } catch {}

      const bundle = {
        _meta: {
          export_type: 'ODDC Conformance Application Bundle',
          standard: 'ODDC v1.0',
          issuer: 'Sentinel Authority',
          exported_at: new Date().toISOString(),
          exported_by: isAdmin ? 'admin' : 'applicant',
        },
        application: { ...app, submitted_at: fmtUTC(app.submitted_at), updated_at: fmtUTC(app.updated_at) },
        state_history: history.map(h => ({ ...h, timestamp: fmtUTC(h.timestamp) })),
        certificates: certs.map(c => ({ ...c, issued_at: fmtUTC(c.issued_at), expires_at: fmtUTC(c.expires_at) })),
        comments: (isAdmin ? comments : comments.filter(c => !c.is_internal)).map(c => ({ ...c, created_at: fmtUTC(c.created_at) })),
        audit_logs: auditLogs.map(l => ({ ...l, timestamp: fmtUTC(l.timestamp) })),
      };

      downloadJSON(bundle, 'ODDC-Bundle-' + app.application_number + '-' + new Date().toISOString().split('T')[0] + '.json');
    } catch (e) { console.error('Export failed', e); }
    setLoad('json', false);
  };

  const exportHistoryCSV = () => {
    if (!history.length) return;
    const rows = history.map(h => ({
      timestamp: fmtUTC(h.timestamp) ?? '',
      action: h.action ?? '',
      user_email: h.user_email ?? '',
      old_state: h.details?.old_state ?? '',
      new_state: h.details?.new_state ?? '',
    }));
    downloadCSV(rows, ['timestamp','action','user_email','old_state','new_state'], 'StateHistory-' + app.application_number + '.csv');
  };

  const exportAuditCSV = async () => {
    setLoad('audit', true);
    try {
      const res = await api.get('/api/audit/logs?resource_type=application&resource_id=' + app.id + '&limit=200&offset=0');
      const logs = res.data.logs ?? [];
      if (!logs.length) { setLoad('audit', false); return; }
      const rows = logs.map(l => ({
        timestamp: fmtUTC(l.timestamp) ?? '',
        user_email: l.user_email ?? '',
        action: l.action ?? '',
        resource_type: l.resource_type ?? '',
        resource_id: l.resource_id ?? '',
        details: l.details ? JSON.stringify(l.details) : '',
        log_hash: l.log_hash ?? '',
      }));
      downloadCSV(rows, ['timestamp','user_email','action','resource_type','resource_id','details','log_hash'], 'AuditLog-' + app.application_number + '.csv');
    } catch (e) { console.error('Audit export failed', e); }
    setLoad('audit', false);
  };

  return (
    <div style={{ border: '1px solid ' + styles.borderGlass, padding: '20px' , borderRadius: 8}}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '4px' }}>
          Export & Records
        </div>
        <div style={{ fontSize: '12px', color: styles.textDim }}>
          {app.application_number} · {new Date().toISOString().split('T')[0]}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={exportJSON} disabled={loading.json} style={BTN(styles.purpleBright)}>
          {loading.json ? '↻ Building…' : '↓ Full Bundle (JSON)'}
        </button>
        {history.length > 0 && (
          <button onClick={exportHistoryCSV} style={BTN(styles.textSecondary)}>
            ↓ State History (CSV)
          </button>
        )}
        {isAdmin && (
          <button onClick={exportAuditCSV} disabled={loading.audit} style={BTN(styles.textSecondary)}>
            {loading.audit ? '↻ Fetching…' : '↓ Audit Log (CSV)'}
          </button>
        )}
        {activeCert && (
          <a href={API_BASE + '/api/certificates/' + activeCert.certificate_number + '/pdf'} target="_blank" rel="noreferrer noopener" style={BTN(styles.accentGreen)}>
            ↓ Certificate PDF
          </a>
        )}
      </div>
      <div style={{ marginTop: '12px', fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, lineHeight: 1.6 }}>
        JSON bundle: application record · state history · certificates · {isAdmin ? 'all comments' : 'public comments'} · audit log
      </div>
    </div>
  );
}
