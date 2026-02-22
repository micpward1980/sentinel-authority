// components/BoundaryVisualizer.jsx — Sentinel Authority v4
// Stepped "brutalist" gauge showing proximity to an ODD boundary limit.
// Segments turn amber at 75%, red at 90%.

import React from 'react';
import { styles } from '../config/styles';
import { ShieldAlert } from 'lucide-react';

const STEPS = 20;

export default function BoundaryVisualizer({ label, value, limit, unit, size = 'normal' }) {
  const pct      = Math.min(100, limit > 0 ? (value / limit) * 100 : 0);
  const isAmber  = pct >= 75 && pct < 90;
  const isRed    = pct >= 90;
  const barColor = isRed ? styles.accentRed : isAmber ? styles.accentAmber : styles.accentGreen;
  const compact  = size === 'compact';

  return (
    <div style={{ width: '100%', padding: compact ? '12px' : '20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{
          fontFamily:    styles.mono,
          fontSize:      '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color:         styles.textDim,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: styles.mono,
          fontSize:   compact ? '12px' : '14px',
          fontWeight: 600,
          color:      barColor,
        }}>
          {value}{unit} <span style={{ color: styles.textDim, fontWeight: 400 }}>/ {limit}{unit}</span>
        </span>
      </div>

      {/* Stepped progress bar */}
      <div style={{ display: 'flex', gap: '3px', height: compact ? '8px' : '12px' }}>
        {Array.from({ length: STEPS }).map((_, i) => {
          const stepPct   = ((i + 1) / STEPS) * 100;
          const filled    = stepPct <= pct;
          const stepAmber = stepPct >= 75 && stepPct < 90;
          const stepRed   = stepPct >= 90;
          const stepColor = filled
            ? (stepRed ? styles.accentRed : stepAmber ? styles.accentAmber : styles.accentGreen)
            : 'rgba(0,0,0,0.07)';
          return (
            <div
              key={i}
              style={{
                flex:         1,
                background:   stepColor,
                borderRadius: '1px',
                transition:   'background 0.3s ease',
              }}
            />
          );
        })}
      </div>

      {/* Percentage label */}
      <div style={{
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'center',
        marginTop:     '6px',
      }}>
        <span style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.textDim }}>
          0{unit}
        </span>
        {(isAmber || isRed) && (
          <span style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '4px',
            fontFamily: styles.mono,
            fontSize:   '9px',
            fontWeight: 700,
            letterSpacing: '1px',
            color:      barColor,
            textTransform: 'uppercase',
          }}>
            <ShieldAlert size={10} />
            {isRed ? 'APPROACHING ODD LIMIT' : 'BOUNDARY WARNING'}
          </span>
        )}
        <span style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.textDim }}>
          {limit}{unit}
        </span>
      </div>
    </div>
  );
}
