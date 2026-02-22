import React, { useMemo } from 'react';
import { styles } from '../config/styles';
import { ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import { processAuditTrail } from '../logic/auditProcessor';

const thStyle = {
  padding: '12px 16px',
  fontSize: '10px',
  fontWeight: 700,
  color: '#666666',
  textAlign: 'left',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  fontFamily: styles.mono,
  background: '#f3f3f3',
  borderBottom: '2px solid #dddbda',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '11px 16px',
  fontSize: '13px',
  color: styles.textPrimary,
  borderBottom: `1px solid ${styles.borderSubtle}`,
  verticalAlign: 'middle',
};

export default function AuditTrailView({ logs = [], certNumber, nodeId = '0847' }) {
  const { summary, logs: processedLogs, conformance_score } = processAuditTrail(logs);
  const integrityOk = summary.integrity_status === 'VALIDATED';

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${styles.borderGlass}`,
      borderRadius: 4,
      boxShadow: '0 2px 2px 0 rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${styles.borderGlass}`,
        background: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color={styles.purplePrimary} />
          <span style={{ fontSize: 13, fontWeight: 700, color: styles.textPrimary, letterSpacing: '0.3px' }}>
            CAT-72 ENFORCEMENT LOG
          </span>
        </div>
        <div style={{ fontFamily: styles.mono, fontSize: 10, color: integrityOk ? styles.accentGreen : styles.accentRed, fontWeight: 700 }}>
          BLOCK_INTEGRITY: {integrityOk ? 'VERIFIED' : 'COMPROMISED'}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${styles.borderGlass}`,
        background: '#fafafa',
      }}>
        {[
          { label: 'Interventions', value: summary.successful_interventions, color: styles.accentGreen, tooltip: 'High counts provide increased statistical confidence in ENVELO enforcement persistence' },
          { label: 'Proximity Alerts', value: summary.boundary_proximity_events, color: styles.accentAmber },
          { label: 'Enforcement Failures', value: summary.enforcement_failures, color: styles.accentRed },
          { label: 'Conformance Score', value: conformance_score + '%', color: conformance_score === 100 ? styles.accentGreen : styles.accentRed },
        ].map((item, i) => (
          <div key={i} title={item.tooltip || ''} style={{
            flex: 1,
            padding: '10px 16px',
            borderRight: i < 3 ? `1px solid ${styles.borderGlass}` : 'none',
            cursor: item.tooltip ? 'help' : 'default',
          }}>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: styles.mono, fontSize: 18, fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Event Type</th>
              <th style={thStyle}>ODD Parameter</th>
              <th style={thStyle}>Enforcement Action</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {processedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: styles.textDim, fontStyle: 'italic' }}>
                  No telemetry events recorded
                </td>
              </tr>
            ) : processedLogs.map((log, i) => (
              <tr key={i} style={{ background: log.intent === 'FAILURE' ? 'rgba(234,0,27,0.02)' : 'transparent' }}>
                <td style={{ ...tdStyle, fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary }}>
                  {log.timestamp ? log.timestamp.split('T')[1]?.split('.')[0] + 'Z' : '--'}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12 }}>
                  {log.event_name || log.classification}
                </td>
                <td style={{ ...tdStyle, fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary }}>
                  {log.parameter || '--'}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: styles.mono,
                    padding: '2px 8px',
                    borderRadius: 2,
                    background: log.intent === 'SUCCESS' ? 'rgba(46,132,74,0.09)' : '#f3f3f3',
                    color: log.intent === 'SUCCESS' ? styles.accentGreen : '#666666',
                    border: `1px solid ${log.intent === 'SUCCESS' ? 'rgba(46,132,74,0.22)' : styles.borderGlass}`,
                  }}>
                    {log.interlock_action || 'LOG_ONLY'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {log.intent === 'SUCCESS' ? (
                    <span style={{ color: styles.accentGreen, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, fontFamily: styles.mono }}>
                      <ShieldCheck size={13} /> PASS
                    </span>
                  ) : log.intent === 'FAILURE' ? (
                    <span style={{ color: styles.accentRed, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, fontFamily: styles.mono }}>
                      <AlertTriangle size={13} /> FAIL
                    </span>
                  ) : (
                    <span style={{ color: '#aaaaaa', fontSize: 10, fontFamily: styles.mono }}>NOMINAL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attestation footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: `1px solid ${styles.borderGlass}`,
        background: '#fafafa',
        fontFamily: styles.mono,
        fontSize: 10,
        color: '#888888',
        letterSpacing: '0.3px',
      }}>
        ATTESTATION: Sentinel Authority Node #{nodeId} verifies that the above enforcement events are cryptographically linked
        {certNumber ? ` to Certificate ${certNumber}` : ' to the active CAT-72 session'}.
        {' '}INTEGRITY: {summary.integrity_status}
      </div>
    </div>
  );
}
