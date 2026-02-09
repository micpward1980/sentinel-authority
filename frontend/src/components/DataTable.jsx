import React from 'react';

export default function DataTable({ columns = [], data = [], onRowClick, emptyMessage = 'No data' }) {
  if (data.length === 0) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'var(--mono)' }}>{emptyMessage}</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col.header || col.label || col.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={row.id || ri}
              onClick={() => onRowClick && onRowClick(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col, ci) => (
                <td key={ci}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
