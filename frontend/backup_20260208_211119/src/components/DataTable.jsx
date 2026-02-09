import React from 'react';
import { styles } from '../config/styles';
import { Search } from 'lucide-react';

function DataTable({ columns, data, onRowClick, emptyMessage = 'No data found' }) {
  return (
    <div style={{overflowX: 'auto'}}>
      <table style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: '14px 16px', textAlign: col.align || 'left',
                fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px',
                letterSpacing: '1.5px', textTransform: 'uppercase',
                color: styles.textTertiary, fontWeight: 400
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{padding: '48px 24px', textAlign: 'center'}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '40px', height: '40px', background: 'rgba(91,75,138,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Search size={18} style={{color: styles.textTertiary, opacity: 0.5}} /></div>
                <span style={{color: styles.textTertiary, fontSize: '13px'}}>{emptyMessage}</span>
              </div>
            </td></tr>
          ) : data.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)} style={{
              borderBottom: `1px solid ${styles.borderGlass}`,
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              {columns.map((col, j) => (
                <td key={j} style={{padding: '16px', textAlign: col.align || 'left', color: styles.textSecondary, fontSize: '14px'}}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

