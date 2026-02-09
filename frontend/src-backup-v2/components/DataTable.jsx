import React from 'react';

export default function DataTable({ columns = [], data = [], onRowClick, emptyMessage = 'No data' }) {
  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '1px' }}>
      {emptyMessage}
    </div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col.header || col.label || col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(row, ri)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {columns.map((col, ci) => (
                <td key={ci}>{col.render ? col.render(row, ri) : row[col.key || col.accessor || col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
