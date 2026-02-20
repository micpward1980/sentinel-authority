import React, { useState, useEffect } from 'react';
import { styles } from '../config/styles';

function fmtUTC(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}

function telemetryStatus(monitoring) {
  if (!monitoring) return { label: 'NO DATA', color: styles.textTertiary };
  const sessions = monitoring.sessions || [];
  if (!sessions.length) return { label: 'NO AGENTS', color: styles.textTertiary };
  const now = Date.now();
  const fresh = sessions.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.last_activity || s.started_at;
    return la && (now - new Date(la).getTime()) < 120000;
  }).length;
  if (fresh === sessions.length) return { label: 'FRESH', color: styles.accentGreen };
  if (fresh > 0) return { label: 'PARTIAL', color: styles.accentAmber };
  return { label: 'STALE', color: styles.accentRed };
}

function conformanceStatus(applications = [], degraded = false) {
  if (degraded) return { label: 'DEGRADED', color: styles.accentRed };
  const revoked = applications.filter(a => a.state === 'revoked' || a.state === 'suspended').length;
  if (revoked > 0) return { label: 'ATTENTION', color: styles.accentAmber };
  if (applications.some(a => a.state === 'conformant')) return { label: 'OK', color: styles.accentGreen };
  return { label: 'NOMINAL', color: styles.textTertiary };
}

function Indicator({ label, value, color, title }) {
  return (
    <div title={title} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 14px',
      borderRight: '1px solid rgba(15,18,30,0.07)',
      height: '100%', flexShrink: 0,
    }}>
      <span style={{
        display: 'inline-block', width: '5px', height: '5px',
        borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: `0 0 5px ${color}`,
      }} />
      <div>
        <div style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, lineHeight: 1, marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.5px', color, lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function StatusStrip({ monitoring, applications = [], lastUpdated, degraded = false }) {
  const [utcNow, setUtcNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const iv = setInterval(() => setUtcNow(new Date().toISOString()), 1000);
    return () => clearInterval(iv);
  }, []);

  const conformance = conformanceStatus(applications, degraded);
  const telemetry   = telemetryStatus(monitoring);
  const registry    = degraded
    ? { label: 'DELAYED', color: styles.accentAmber }
    : { label: 'SYNCED',  color: styles.accentGreen };

  return (
    <div style={{
      position: 'sticky', top: '72px', zIndex: 20,
      display: 'flex', alignItems: 'stretch',
      height: '38px',
      background: 'rgba(245,245,247,0.97)',
      borderBottom: '1px solid rgba(15,18,30,0.08)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      overflowX: 'auto', overflowY: 'hidden',
      scrollbarWidth: 'none',
      outline: degraded ? `1px solid ${styles.accentAmber}` : 'none',
    }}>
      {/* Label anchor */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRight: '1px solid rgba(15,18,30,0.07)', flexShrink: 0 }}>
        <span style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(15,18,30,0.30)' }}>
          OPERATIONAL STATUS
        </span>
      </div>

      <Indicator label="Conformance"         value={conformance.label} color={conformance.color} title="Overall registry conformance state" />
      <Indicator label="Interlock Telemetry" value={telemetry.label}   color={telemetry.color}   title="ENVELO agent heartbeat freshness (2-min window)" />
      <Indicator label="Registry"            value={registry.label}    color={registry.color}    title="Certificate registry sync status" />
      <Indicator label="Standard"            value="ODDC v1.0"         color={styles.purpleBright} title="Active conformance standard — effective Jan 2026" />

      <div style={{ flex: 1 }} />

      {/* Timestamps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 14px', borderLeft: '1px solid rgba(15,18,30,0.07)', flexShrink: 0 }}>
        {lastUpdated && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, lineHeight: 1, marginBottom: '2px' }}>Last Update</div>
            <div style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textSecondary, lineHeight: 1 }}>{fmtUTC(lastUpdated)}</div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, lineHeight: 1, marginBottom: '2px' }}>UTC</div>
          <div style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, lineHeight: 1 }}>{fmtUTC(utcNow)}</div>
        </div>
      </div>
    </div>
  );
}
