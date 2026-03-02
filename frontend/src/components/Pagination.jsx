import React from 'react';
import { styles } from '../config/styles';

export default function Pagination({ total, limit, offset, onChange }) {
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit) + 1;
  if (pages <= 1) return null;

  const getPageNumbers = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', pages];
    if (current >= pages - 3) return [1, '...', pages-4, pages-3, pages-2, pages-1, pages];
    return [1, '...', current-1, current, current+1, '...', pages];
  };

  const btn = (active, disabled) => ({
    padding: '6px 12px', fontSize: '11px', cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid ' + styles.borderGlass, fontFamily: styles.mono,
    letterSpacing: '0.5px', transition: 'all 0.15s',
    background: active ? styles.purplePrimary : disabled ? 'transparent' : styles.cardSurface,
    color: active ? '#fff' : disabled ? styles.textDim : styles.textPrimary,
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', flexWrap: 'wrap', gap: 16 }}>
      <span style={{ fontSize: '12px', color: styles.textTertiary, fontFamily: styles.mono }}>
        {Math.min(offset+1, total)}–{Math.min(offset+limit, total)} of {total.toLocaleString()}
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => onChange(Math.max(0, offset-limit))} disabled={offset===0} style={btn(false, offset===0)}>← Prev</button>
        {getPageNumbers().map((p, i) => p === '...'
          ? <span key={`e${i}`} style={{ padding: '6px 8px', color: styles.textTertiary }}>…</span>
          : <button key={p} onClick={() => onChange((p-1)*limit)} style={btn(p===current, false)}>{p}</button>
        )}
        <button onClick={() => onChange(offset+limit)} disabled={offset+limit>=total} style={btn(false, offset+limit>=total)}>Next →</button>
      </div>
    </div>
  );
}
