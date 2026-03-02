import React from 'react';
import { styles } from '../config/styles';

export default function SortHeader({ label, field, currentSort, currentOrder, onChange }) {
  const active = currentSort === field;
  return (
    <th onClick={() => onChange(field, active && currentOrder === 'asc' ? 'desc' : 'asc')}
      style={{
        cursor: 'pointer', userSelect: 'none', padding: '10px 12px', textAlign: 'left',
        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px',
        fontFamily: styles.mono,
        color: active ? styles.purpleBright : styles.textTertiary,
        borderBottom: '1px solid ' + styles.borderGlass, whiteSpace: 'nowrap',
        transition: 'color 0.2s',
      }}>
      {label}{active && <span style={{ marginLeft: 4, fontSize: '9px' }}>{currentOrder === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}
