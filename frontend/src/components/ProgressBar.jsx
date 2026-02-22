// components/ProgressBar.jsx — Sentinel Authority v4
// Upgraded to use spacing tokens and refined colors.
// NOTE: For CAT-72 certification tracking, prefer <CAT72Path /> instead.

import React from 'react';
import { styles } from '../config/styles';

export default function ProgressBar({
  value   = 0,
  max     = 100,
  color,
  height  = '4px',
  label,
  showPct = false,
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color || styles.purpleBright;

  return (
    <div>
      {(label || showPct) && (
        <div style={{
          display:       'flex',
          justifyContent:'space-between',
          alignItems:    'center',
          marginBottom:  styles.spacing.xxs,
        }}>
          {label && (
            <span style={{
              fontFamily:    styles.mono,
              fontSize:      '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color:         styles.textTertiary,
            }}>
              {label}
            </span>
          )}
          {showPct && (
            <span style={{
              fontFamily:    styles.mono,
              fontSize:      '10px',
              color:         styles.textDim,
            }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div style={{
        background:   'rgba(0,0,0,.06)',
        height,
        borderRadius: '2px',
        overflow:     'hidden',
        width:        '100%',
      }}>
        <div style={{
          width:      pct + '%',
          height:     '100%',
          background: barColor,
          borderRadius:'2px',
          transition: 'width .6s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  );
}
