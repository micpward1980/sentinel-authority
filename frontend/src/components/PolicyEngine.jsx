// components/PolicyEngine.jsx — Sentinel Authority v4
// Master-detail boundary configuration form.
// Left: domain selector + numeric boundary inputs + geo + violation protocol
// Right: ExecutionMirror live YAML preview
//
// Designed to be dropped into EnveloPage STATE 3 (approved/deploy) section.
//
// Usage:
//   <PolicyEngine
//     systemName={app.system_name}
//     certNumber={app.certificate_number || 'PENDING'}
//     systemType={app.system_type}           // key into SYSTEM_TYPES
//     onCommit={handleCommitBoundaries}      // async fn(config) → Promise
//   />

import React, { useState, useMemo } from 'react';
import { Sliders, Globe, ShieldCheck } from 'lucide-react';
import { styles } from '../config/styles';
import ExecutionMirror from './ExecutionMirror';

// ── Domain definitions ─────────────────────────────────────────────────────────
const DOMAINS = ['ground', 'aerial', 'marine', 'finance', 'industrial', 'medical', 'custom'];

const DOMAIN_DEFAULTS = {
  ground: [
    { name: 'velocity_max',       label: 'Max Velocity',       value: 35,    unit: 'mph',   min: 0,    max: 200  },
    { name: 'acceleration_limit', label: 'Accel Limit',         value: 0.5,   unit: 'g',     min: 0,    max: 5    },
    { name: 'confidence_threshold',label: 'Confidence Min',     value: 0.90,  unit: '',      min: 0,    max: 1    },
    { name: 'operating_radius',   label: 'Operating Radius',   value: 500,   unit: 'm',     min: 0,    max: 50000},
  ],
  aerial: [
    { name: 'altitude_max',       label: 'Max Altitude',        value: 400,   unit: 'ft',    min: 0,    max: 60000},
    { name: 'velocity_max',       label: 'Max Airspeed',        value: 50,    unit: 'kts',   min: 0,    max: 500  },
    { name: 'confidence_threshold',label: 'Confidence Min',     value: 0.92,  unit: '',      min: 0,    max: 1    },
    { name: 'geofence_radius',    label: 'Geofence Radius',     value: 300,   unit: 'm',     min: 0,    max: 50000},
  ],
  marine: [
    { name: 'velocity_max',       label: 'Max Speed',           value: 12,    unit: 'kts',   min: 0,    max: 100  },
    { name: 'depth_min',          label: 'Min Water Depth',     value: 3,     unit: 'm',     min: 0,    max: 1000 },
    { name: 'confidence_threshold',label: 'Confidence Min',     value: 0.88,  unit: '',      min: 0,    max: 1    },
  ],
  finance: [
    { name: 'max_trade_pct',      label: 'Max Trade %',         value: 5,     unit: '%',     min: 0,    max: 100  },
    { name: 'confidence_threshold',label: 'Confidence Min',     value: 0.85,  unit: '',      min: 0,    max: 1    },
    { name: 'human_review_ratio', label: 'Human Review Ratio',  value: 0.05,  unit: '',      min: 0,    max: 1    },
  ],
  industrial: [
    { name: 'velocity_max',       label: 'Max Speed',           value: 2,     unit: 'm/s',   min: 0,    max: 30   },
    { name: 'force_limit',        label: 'Max Force',           value: 150,   unit: 'N',     min: 0,    max: 10000},
    { name: 'workspace_radius',   label: 'Workspace Radius',    value: 1.5,   unit: 'm',     min: 0,    max: 50   },
  ],
  medical: [
    { name: 'confidence_threshold',label: 'Confidence Min',     value: 0.95,  unit: '',      min: 0,    max: 1    },
    { name: 'human_review_ratio', label: 'Human Review Ratio',  value: 0.20,  unit: '',      min: 0,    max: 1    },
    { name: 'decision_rate',      label: 'Max Decisions/hr',    value: 100,   unit: '/hr',   min: 0,    max: 10000},
  ],
  custom: [
    { name: 'parameter_1',        label: 'Parameter 1',         value: 0,     unit: '',      min: 0,    max: 9999 },
    { name: 'parameter_2',        label: 'Parameter 2',         value: 0,     unit: '',      min: 0,    max: 9999 },
  ],
};

const GEO_OPTIONS = [
  { value: 'polygon',   label: 'Polygon (geographic boundary)' },
  { value: 'radius',    label: 'Radius (from origin point)' },
  { value: 'logical',   label: 'Logical (system-defined)' },
  { value: 'corridor',  label: 'Corridor (path-based)' },
  { value: 'custom',    label: 'Custom (GeoJSON)' },
];

const VIOLATION_OPTIONS = [
  { value: 'HALT',                   label: 'ENFORCE_HALT — immediate stop (strict)' },
  { value: 'MINIMUM_RISK_CONDITION', label: 'MINIMUM_RISK_CONDITION — safe state transition' },
  { value: 'SELF_CORRECT_AND_REPORT',label: 'SELF_CORRECT_AND_REPORT — attempt correction' },
  { value: 'ALERT_ONLY',             label: 'ALERT_ONLY — log and notify (permissive)' },
];

// ── Config section wrapper ─────────────────────────────────────────────────────
function ConfigSection({ icon, title, children }) {
  return (
    <div style={{
      background:   styles.cardSurface,
      border:       `1px solid ${styles.borderSubtle}`,
      borderRadius: '4px',
      padding:      `${styles.spacing.medium} ${styles.spacing.medium}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: styles.spacing.medium }}>
        <span style={{ color: styles.purplePrimary, lineHeight: 0 }}>{icon}</span>
        <h3 style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: styles.textTertiary, margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Numeric boundary row ────────────────────────────────────────────────────────
function BoundaryRow({ boundary, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 64px', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
      <label style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textSecondary, letterSpacing: '0.5px' }}>
        {boundary.label}
      </label>
      <input
        type="number"
        value={boundary.value}
        min={boundary.min}
        max={boundary.max}
        step={boundary.value < 1 ? 0.01 : boundary.value < 10 ? 0.1 : 1}
        onChange={e => onChange(boundary.name, parseFloat(e.target.value) || 0)}
        style={{
          padding:     '7px 10px',
          border:      `1px solid ${styles.borderGlass}`,
          borderRadius:'3px',
          fontFamily:  styles.mono,
          fontSize:    '12px',
          color:       styles.textPrimary,
          background:  'rgba(255,255,255,0.8)',
          outline:     'none',
          width:       '100%',
        }}
      />
      <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textDim }}>
        {boundary.unit}
      </span>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────────
export default function PolicyEngine({
  systemName    = '',
  certNumber    = '',
  systemType    = '',
  onCommit,
  style: outerStyle = {},
}) {
  // Derive initial domain from system type key
  const initDomain = useMemo(() => {
    const t = (systemType || '').toLowerCase();
    if (t.includes('aerial') || t.includes('drone') || t.includes('uav')) return 'aerial';
    if (t.includes('marine') || t.includes('vessel') || t.includes('ship')) return 'marine';
    if (t.includes('financ') || t.includes('trading') || t.includes('robo')) return 'finance';
    if (t.includes('medic') || t.includes('surgical') || t.includes('diag')) return 'medical';
    if (t.includes('industr') || t.includes('robot') || t.includes('arm')) return 'industrial';
    return 'ground';
  }, [systemType]);

  const [domain, setDomain]               = useState(initDomain);
  const [boundaries, setBoundaries]       = useState(() => (DOMAIN_DEFAULTS[initDomain] || DOMAIN_DEFAULTS.ground).map(b => ({ ...b })));
  const [geoType, setGeoType]             = useState('polygon');
  const [violationAction, setViolation]   = useState('HALT');

  // Sync boundaries when domain changes
  const handleDomainChange = (d) => {
    setDomain(d);
    setBoundaries((DOMAIN_DEFAULTS[d] || DOMAIN_DEFAULTS.ground).map(b => ({ ...b })));
  };

  const handleBoundaryChange = (name, value) => {
    setBoundaries(prev => prev.map(b => b.name === name ? { ...b, value } : b));
  };

  const handleCommit = async () => {
    if (onCommit) {
      await onCommit({ domain, boundaries, geoType, violationAction });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: styles.spacing.large, alignItems: 'start', ...outerStyle }}>

      {/* ── LEFT: Configuration Controls ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: styles.spacing.medium }}>

        {/* Domain selector chips */}
        <div>
          <div style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: styles.textDim, marginBottom: styles.spacing.xs }}>
            Operational Domain
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DOMAINS.map(d => (
              <button
                key={d}
                onClick={() => handleDomainChange(d)}
                style={{
                  padding:       '5px 14px',
                  borderRadius:  '3px',
                  border:        `1px solid ${domain === d ? styles.purplePrimary : styles.borderGlass}`,
                  background:    domain === d ? styles.purplePrimary : 'transparent',
                  color:         domain === d ? '#fff' : styles.textTertiary,
                  fontFamily:    styles.mono,
                  fontSize:      '10px',
                  fontWeight:    600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor:        'pointer',
                  transition:    'all 0.15s',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Numeric boundaries */}
        <ConfigSection icon={<Sliders size={15} />} title="Numeric Boundary Parameters">
          {boundaries.map(b => (
            <BoundaryRow key={b.name} boundary={b} onChange={handleBoundaryChange} />
          ))}
        </ConfigSection>

        {/* Geographic enforcement */}
        <ConfigSection icon={<Globe size={15} />} title="Geographic Enforcement">
          <div style={{ display: 'flex', flexDirection: 'column', gap: styles.spacing.xs }}>
            <label style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, letterSpacing: '0.5px' }}>
              Boundary Type
            </label>
            <select
              value={geoType}
              onChange={e => setGeoType(e.target.value)}
              style={{ padding: '8px 10px', border: `1px solid ${styles.borderGlass}`, borderRadius: '3px', fontFamily: styles.mono, fontSize: '11px', color: styles.textPrimary, background: 'rgba(255,255,255,0.8)', outline: 'none' }}
            >
              {GEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </ConfigSection>

        {/* Violation response */}
        <ConfigSection icon={<ShieldCheck size={15} />} title="Violation Response Protocol">
          <div style={{ display: 'flex', flexDirection: 'column', gap: styles.spacing.xs }}>
            <label style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, letterSpacing: '0.5px' }}>
              Action on Boundary Exceedance
            </label>
            <select
              value={violationAction}
              onChange={e => setViolation(e.target.value)}
              style={{ padding: '8px 10px', border: `1px solid ${styles.borderGlass}`, borderRadius: '3px', fontFamily: styles.mono, fontSize: '11px', color: styles.textPrimary, background: 'rgba(255,255,255,0.8)', outline: 'none' }}
            >
              {VIOLATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </ConfigSection>
      </div>

      {/* ── RIGHT: Live Spec Mirror ── */}
      <ExecutionMirror
        systemName={systemName}
        certNumber={certNumber}
        boundaries={boundaries}
        geoType={geoType}
        violationAction={violationAction}
        onCommit={handleCommit}
        style={{ minHeight: '520px', position: 'sticky', top: '88px' }}
      />
    </div>
  );
}
