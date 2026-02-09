import React from 'react';

export default function ProgressBar({ value = 0, max = 100, color = 'var(--purple-bright)', height = 4 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ width: '100%', height: `${height}px`, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .4s ease' }} />
    </div>
  );
}
