import React from 'react';
import { styles } from '../config/styles';
import useIsMobile from '../hooks/useIsMobile';

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

// ── Mobile card view ─────────────────────────────────────────────────────────
// Each row becomes a stacked card. The first column is treated as the
// primary label; the rest render as label/value pairs.
function MobileCards({ columns, rows, onRowClick, loading, emptyMessage }) {
  if (loading) return (
    <div style={{ padding: '40px 16px', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim }}>
      LOADING...
    </div>
  );
  if (rows.length === 0) return (
    <div style={{ padding: '40px 16px', textAlign: 'center', color: styles.textDim, fontSize: '13px' }}>
      {emptyMessage}
    </div>
  );

  const [primary, ...rest] = columns;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
      {rows.map((row, i) => (
        <div
          key={row.id ?? i}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          style={{
            padding: '14px 16px',
            background: styles.cardSurface,
            border: `1px solid ${styles.borderGlass}`,
            cursor: onRowClick ? 'pointer' : 'default',
            borderRadius: 2,
          }}
        >
          {/* Primary field — prominent */}
          <div style={{ marginBottom: rest.length ? '10px' : 0 }}>
            {primary.render ? primary.render(row) : (
              <span style={{ fontSize: '14px', fontWeight: 500, color: styles.textPrimary }}>
                {row[primary.key] ?? '—'}
              </span>
            )}
          </div>

          {/* Secondary fields — compact label/value grid */}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {rest.filter(col => col.key !== 'actions' || col.label).map(col => (
                <div key={col.key}>
                  <div style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.8px', textTransform: 'uppercase', color: styles.textDim, marginBottom: '2px' }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize: '12px', color: styles.textSecondary, ...col.style }}>
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Desktop table ────────────────────────────────────────────────────────────
function DesktopTable({ columns, rows, onRowClick, onRowMouseEnter, loading, emptyMessage, rowStyle }) {
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
              onMouseOver={e => { if (onRowClick) e.currentTarget.style.background = 'rgba(29,26,59,0.025)'; }}
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
}

// ── Unified component — switches on viewport ─────────────────────────────────
const DataTable = React.memo(function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  onRowMouseEnter,
  loading = false,
  emptyMessage = 'No data',
  rowStyle,
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileCards
        columns={columns}
        rows={rows}
        onRowClick={onRowClick}
        loading={loading}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <DesktopTable
      columns={columns}
      rows={rows}
      onRowClick={onRowClick}
      onRowMouseEnter={onRowMouseEnter}
      loading={loading}
      emptyMessage={emptyMessage}
      rowStyle={rowStyle}
    />
  );
});

export default DataTable;
