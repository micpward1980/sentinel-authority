import React from 'react';
import { styles } from '../config/styles';

const TH_STYLE = {
  fontFamily: styles.mono,
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: styles.textTertiary,
  padding: '10px 16px',
  textAlign: 'left',
  borderBottom: `1px solid ${styles.borderGlass}`,
  whiteSpace: 'nowrap',
  background: 'transparent',
};

const TD_STYLE = {
  padding: '11px 16px',
  color: styles.textPrimary,
  borderBottom: `1px solid ${styles.borderSubtle}`,
  fontSize: '13px',
  verticalAlign: 'middle',
};

/**
 * DataTable
 *
 * Props:
 *   columns: [{ key, label, style?, render? }]
 *   rows: array of data objects
 *   onRowClick?: (row) => void
 *   loading?: boolean
 *   emptyMessage?: string
 *   rowStyle?: (row) => object
 */
const DataTable = React.memo(function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  onRowMouseEnter,
  loading = false,
  emptyMessage = 'No data',
  rowStyle,
}) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ ...TH_STYLE, ...col.headerStyle }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ ...TD_STYLE, textAlign: 'center', color: styles.textDim, fontFamily: styles.mono, fontSize: '11px', padding: '40px' }}>
                LOADING...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ ...TD_STYLE, textAlign: 'center', color: styles.textDim, fontSize: '13px', padding: '40px' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(row) : undefined}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
                ...(rowStyle ? rowStyle(row) : {}),
              }}
              onMouseOver={e => { if (onRowClick) e.currentTarget.style.background = 'rgba(74,61,117,0.025)'; }}
              onMouseOut={e => { e.currentTarget.style.background = rowStyle ? (rowStyle(row)?.background || 'transparent') : 'transparent'; }}
            >
              {columns.map(col => (
                <td key={col.key} style={{ ...TD_STYLE, ...col.style }}>
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default DataTable;
