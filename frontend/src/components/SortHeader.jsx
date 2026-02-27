import React from 'react';
import { styles } from '../config/styles';

export default function SortHeader({ label, field, currentSort, currentOrder, onChange }) {
  const active = currentSort === field;
  return (
    <th onClick={() => onChange(field, active && currentOrder === 'asc' ? 'desc' : 'asc')}
      style={{
        cursor: 'pointer', userSelect: 'none', padding: '10px 12px', textAlign: 'left',
        fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: active ? (styles.accentBlue || '#3b82f6') : styles.textTertiary,
        borderBottom: `1px solid ${styles.borderGlass}`, whiteSpace: 'nowrap',
      }}>
      {label}{active && <span style={{ marginLeft: 4, fontSize: '10px' }}>{currentOrder === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}
