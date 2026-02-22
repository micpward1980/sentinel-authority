// components/ExecutionMirror.jsx — Sentinel Authority v4
// Live YAML specification mirror for the ENVELO Interlock policy engine.
// Reads boundary config state and renders syntax-highlighted YAML in real time.
// Keys in amber, values in green, comments in gray, warnings in amber with annotation.
//
// Usage:
//   <ExecutionMirror
//     systemName="Meridian AV v3.2"
//     certNumber="SA-0042"
//     boundaries={[{ name: 'velocity_max', value: 35, min: 0, max: 35, unit: 'mph' }]}
//     geoType="polygon"
//     violationAction="HALT"
//     onCommit={handleCommit}
//   />

import React, { useMemo, useState } from 'react';
import { styles } from '../config/styles';
import { RefreshCcw, Download, CheckCircle2, Loader } from 'lucide-react';

// ── ODD thresholds per boundary name — used for validation warnings ────────────
const ODD_THRESHOLDS = {
  velocity_max:          { warn: 120, unit: 'mph',  label: 'EXCEEDS_GROUND_VEHICLE_STANDARD' },
  max_speed:             { warn: 120, unit: 'mph',  label: 'EXCEEDS_GROUND_VEHICLE_STANDARD' },
  speed_limit:           { warn: 120, unit: 'mph',  label: 'EXCEEDS_GROUND_VEHICLE_STANDARD' },
  acceleration_limit:    { warn: 1.5, unit: 'g',    label: 'EXCEEDS_PASSENGER_SAFETY_NORM' },
  operating_radius:      { warn: 5000, unit: 'm',   label: 'EXCEEDS_STANDARD_ODD_RADIUS' },
  confidence_threshold:  { warn: null, min: 0.70,   label: 'BELOW_MINIMUM_CONFIDENCE' },
  human_review_ratio:    { warn: null, min: 0.01,   label: 'BELOW_MINIMUM_OVERSIGHT_RATIO' },
};

function getWarning(name, value) {
  const t = ODD_THRESHOLDS[name.toLowerCase()];
  if (!t || value == null) return null;
  if (t.warn != null && value > t.warn) return t.label;
  if (t.min  != null && value < t.min)  return t.label;
  return null;
}

// ── YAML line renderer ──────────────────────────────────────────────────────────
function YLine({ indent = 0, k, v, comment, warn, isComment }) {
  const pad = '  '.repeat(indent);

  if (isComment) {
    return (
      <div style={{ lineHeight: 1.7 }}>
        <span style={{ color: '#4a5568' }}>{pad}{k}</span>
      </div>
    );
  }

  const keyColor   = '#e6a817';   // amber — YAML keys
  const valColor   = warn ? '#e6a817' : '#4ade80';   // amber if warning, green if clean
  const noteColor  = warn ? '#e6a817' : '#4a5568';

  return (
    <div style={{ lineHeight: 1.7, display: 'flex', alignItems: 'baseline', gap: 0, flexWrap: 'wrap' }}>
      <span style={{ color: keyColor, whiteSpace: 'pre' }}>{pad}{k}:</span>
      {v !== undefined && <span style={{ color: valColor, marginLeft: '6px', whiteSpace: 'pre' }}>{v}</span>}
      {(comment || warn) && (
        <span style={{ color: noteColor, marginLeft: '12px', fontSize: '9px', letterSpacing: '0.5px' }}>
          {warn ? `  # WARNING: ${warn}` : comment ? `  # ${comment}` : ''}
        </span>
      )}
    </div>
  );
}

// ── Build YAML lines from props ──────────────────────────────────────────────
function buildYaml({ systemName, certNumber, boundaries, geoType, violationAction, timestamp }) {
  const lines = [];
  const ts = timestamp || new Date().toISOString().substring(0, 16) + 'Z';

  lines.push({ isComment: true, k: '# Sentinel Authority | ODDC v1.0.4' });
  lines.push({ isComment: true, k: `# System: ${systemName || 'Unnamed System'}` });
  lines.push({ isComment: true, k: `# Generated: ${ts}` });
  lines.push({ isComment: true, k: '' });
  lines.push({ k: 'version',   v: '3.2.0' });
  lines.push({ k: 'interlock', v: 'ENVELO_v4.2.1' });
  if (certNumber) lines.push({ k: 'certificate', v: certNumber });
  lines.push({ isComment: true, k: '' });

  lines.push({ k: 'odd_boundaries' });
  if (boundaries && boundaries.length > 0) {
    for (const b of boundaries) {
      const val  = b.value != null ? b.value : b.max;
      const warn = getWarning(b.name, val);
      lines.push({
        indent: 1,
        k:      b.name,
        v:      val != null ? `${val}${b.unit ? ' ' + b.unit : ''}` : 'null',
        warn,
      });
    }
  } else {
    lines.push({ indent: 1, isComment: true, k: '# No boundaries configured' });
  }
  lines.push({ isComment: true, k: '' });

  lines.push({ k: 'geographic_enforcement' });
  lines.push({ indent: 1, k: 'type',    v: geoType || 'polygon' });
  lines.push({ indent: 1, k: 'strict',  v: 'true' });
  lines.push({ isComment: true, k: '' });

  lines.push({ k: 'enforcement_protocol' });
  const action = (violationAction || 'HALT').toUpperCase().replace(/\s+/g, '_');
  lines.push({ indent: 1, k: 'violation_action', v: action });
  lines.push({ indent: 1, k: 'fail_closed',       v: 'true' });
  lines.push({ indent: 1, k: 'audit_chain',        v: 'sha256_enabled' });
  lines.push({ indent: 1, k: 'tamper_evident',     v: 'true' });
  lines.push({ isComment: true, k: '' });

  lines.push({ k: 'registry' });
  lines.push({ indent: 1, k: 'endpoint', v: 'https://sentinel-authority-production.up.railway.app' });
  lines.push({ indent: 1, k: 'heartbeat_interval_s', v: '30' });
  lines.push({ indent: 1, k: 'telemetry_flush_s',    v: '10' });

  return lines;
}

// ── Download as .yaml file ─────────────────────────────────────────────────────
function yamlText(lines) {
  return lines.map(l => {
    if (l.isComment) return l.k;
    const pad = '  '.repeat(l.indent || 0);
    const val = l.v !== undefined ? ` ${l.v}` : '';
    const note = l.warn ? `  # WARNING: ${l.warn}` : '';
    return `${pad}${l.k}:${val}${note}`;
  }).join('\n');
}

// ── Commit animation states ──────────────────────────────────────────────────
const COMMIT_STATES = {
  idle:      { label: 'COMMIT TO ENVELO INTERLOCK', bg: '#1d1a3b', spinner: false },
  verifying: { label: 'VERIFYING AUDIT CHAIN…',     bg: '#1d1a3b', spinner: true  },
  success:   { label: 'COMMITTED — CHAIN SEALED',   bg: '#16873e', spinner: false },
};

// ── Main export ─────────────────────────────────────────────────────────────────
export default function ExecutionMirror({
  systemName,
  certNumber,
  boundaries     = [],
  geoType        = 'polygon',
  violationAction= 'HALT',
  onCommit,
  style: outerStyle = {},
}) {
  const [commitState, setCommitState] = useState('idle');
  const timestamp = useMemo(() => new Date().toISOString().substring(0, 16) + 'Z', []);

  const lines = useMemo(() =>
    buildYaml({ systemName, certNumber, boundaries, geoType, violationAction, timestamp }),
    [systemName, certNumber, boundaries, geoType, violationAction, timestamp]
  );

  const hasWarnings = lines.some(l => l.warn);

  const handleDownload = () => {
    const text = yamlText(lines);
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([text], { type: 'text/yaml' })),
      download: `envelo-spec-${certNumber || 'draft'}.yaml`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleCommit = async () => {
    if (commitState !== 'idle') return;
    setCommitState('verifying');
    try {
      if (onCommit) await onCommit({ boundaries, geoType, violationAction });
      await new Promise(r => setTimeout(r, 900));
      setCommitState('success');
      setTimeout(() => setCommitState('idle'), 3500);
    } catch {
      setCommitState('idle');
    }
  };

  const cs = COMMIT_STATES[commitState];

  return (
    <div style={{
      background:   '#0f121e',
      border:       '1px solid #1a1f2e',
      borderRadius: '6px',
      display:      'flex',
      flexDirection:'column',
      overflow:     'hidden',
      ...outerStyle,
    }}>
      {/* Header */}
      <div style={{
        padding:        '10px 16px',
        borderBottom:   '1px solid #1a1f2e',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        background:     'rgba(255,255,255,0.02)',
        flexShrink:     0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: styles.mono, fontSize: '10px', color: '#666', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            LIVE_SPEC_MIRROR.YAML
          </span>
          {hasWarnings && (
            <span style={{ fontFamily: styles.mono, fontSize: '9px', color: '#e6a817', background: 'rgba(230,168,23,0.12)', border: '1px solid rgba(230,168,23,0.25)', borderRadius: '3px', padding: '1px 6px', letterSpacing: '1px' }}>
              WARNINGS
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <button
            onClick={() => {}} // reset handled by parent re-render
            title="Refresh"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
          >
            <RefreshCcw size={13} color="#555" />
          </button>
          <button
            onClick={handleDownload}
            title="Download YAML"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
          >
            <Download size={13} color="#555" />
          </button>
        </div>
      </div>

      {/* YAML body */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        padding:    '16px 20px',
        fontFamily: styles.mono,
        fontSize:   '11px',
        background: '#0b0e17',
        minHeight:  '280px',
      }}>
        {lines.map((line, i) => (
          <YLine key={i} {...line} />
        ))}
      </div>

      {/* Warning summary */}
      {hasWarnings && (
        <div style={{
          padding:    '8px 16px',
          background: 'rgba(230,168,23,0.06)',
          borderTop:  '1px solid rgba(230,168,23,0.15)',
          fontFamily: styles.mono,
          fontSize:   '10px',
          color:      '#e6a817',
          letterSpacing: '0.5px',
        }}>
          ⚠ One or more boundaries exceed standard ODD thresholds. Review before committing.
        </div>
      )}

      {/* Commit button */}
      <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid #1a1f2e', flexShrink: 0 }}>
        <button
          onClick={handleCommit}
          disabled={commitState !== 'idle'}
          style={{
            width:         '100%',
            background:    cs.bg,
            color:         '#fff',
            border:        'none',
            padding:       '12px',
            borderRadius:  '4px',
            fontFamily:    styles.mono,
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '2px',
            cursor:        commitState === 'idle' ? 'pointer' : 'default',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            gap:           '8px',
            transition:    'background 0.3s ease',
          }}
        >
          {commitState === 'verifying' && <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          {commitState === 'success'   && <CheckCircle2 size={13} />}
          {cs.label}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
