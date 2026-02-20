import { styles } from '../config/styles';
import React from 'react';

export default function DataTable({ columns = [], data = [], onRowClick, emptyMessage = 'No data' }) {
  if (!data.length) return <div style={{ textAlign: 'center', padding: '40px 20px', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px' }}>{emptyMessage}</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {columns.map((col, i) => <th key={i} style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid ' + styles.borderGlass, background: 'transparent', fontWeight: 500 }}>{col.header || col.label || col}</th>)}
        </tr></thead>
        <tbody>
          {data.map((row, ri) => <tr key={ri} onClick={() => onRowClick?.(row, ri)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
            {columns.map((col, ci) => <td key={ci} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,.05)', color: styles.textSecondary, fontSize: '14px' }}>{col.render ? col.render(row, ri) : row[col.key || col.accessor || col]}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}
