import React from 'react';
import { styles } from '../config/styles';

function ProgressBar({ value, max = 100, color = styles.purpleBright, showLabel = true, size = 'md' }) {
  const pct = Math.min(100, (value / max) * 100);
  const height = size === 'sm' ? '4px' : '8px';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
      <div style={{flex: 1, height, borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden'}}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 12px ${color}50`,
          transition: 'width 0.5s ease',
        }}/>
      </div>
      {showLabel && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, minWidth: '40px'}}>{Math.round(pct)}%</span>}
    </div>
  );
}

export default ProgressBar;

