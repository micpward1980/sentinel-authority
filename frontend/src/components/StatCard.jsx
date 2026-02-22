// components/StatCard.jsx — Sentinel Authority v4
// Salesforce "Lightning Tile" — current state vs. target, trend delta
// Information density: label → value → trend / sublabel

import React from 'react';
import { styles } from '../config/styles';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Trend sub-component ────────────────────────────────────────────────────────
function TrendIndicator({ trend }) {
  if (!trend) return null;

  // Accept: "+12% from last audit period", "▲ 3", "-5%", or a raw string
  const raw = String(trend);
  const isPositive = raw.startsWith('+') || raw.startsWith('▲') || raw.startsWith('↑');
  const isNegative = raw.startsWith('-') || raw.startsWith('▼') || raw.startsWith('↓');
  const color = isPositive ? styles.accentGreen : isNegative ? styles.accentRed : styles.textDim;
  const Icon  = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         '4px',
      marginTop:   styles.spacing.xxs,
      fontSize:    '11px',
      fontFamily:  styles.mono,
      fontWeight:  500,
      color,
      letterSpacing: '0.04em',
    }}>
      <Icon size={11} />
      {raw.replace(/^[+\-▲▼↑↓]\s?/, '')} from last audit period
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = React.memo(function StatCard({
  label,
  value,
  sublabel,
  subtitle,
  trend,
  color,
  icon,
  onClick,
  className = '',
  style: overrideStyle = {},
}) {
  const sub = sublabel || subtitle;
  const isClickable = Boolean(onClick);

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        padding:         `${styles.spacing.medium} ${styles.spacing.medium}`,
        minHeight:       '120px',
        display:         'flex',
        flexDirection:   'column',
        justifyContent:  'space-between',
        cursor:          isClickable ? 'pointer' : 'default',
        background:      'rgba(15,18,30,0.02)',
        border:          '1px solid rgba(15,18,30,0.10)',
        borderRadius:    4,
        transition:      'opacity 0.15s ease',
        position:        'relative',
        ...overrideStyle,
      }}
      onMouseEnter={isClickable ? (e) => {
        e.currentTarget.style.opacity = '0.85';
      } : undefined}
      onMouseLeave={isClickable ? (e) => {
        e.currentTarget.style.opacity = '1';
      } : undefined}
    >
      {/* ── Header row: label + icon ── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   styles.spacing.small,
      }}>
        <span style={{
          fontFamily:    styles.mono,
          fontSize:      '10px',
          fontWeight:    600,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color:         styles.textTertiary,
          lineHeight:    1.4,
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: color || styles.textDim, opacity: 0.7, flexShrink: 0 }}>
            {icon}
          </span>
        )}
      </div>

      {/* ── Value block ── */}
      <div>
        <div style={{
          fontSize:     '32px',
          fontWeight:   300,
          fontFamily:   styles.sans,
          color:        color || styles.textPrimary,
          letterSpacing:'-0.01em',
          lineHeight:   1,
        }}>
          {value}
        </div>

        {/* Trend indicator (positive/negative/neutral) */}
        {trend && <TrendIndicator trend={trend} />}

        {/* Sublabel — audit period, secondary context */}
        {sub && !trend && (
          <div style={{
            fontFamily:    styles.mono,
            fontSize:      '11px',
            fontWeight:    500,
            letterSpacing: '0.06em',
            color:         styles.textDim,
            marginTop:     styles.spacing.xxs,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
});

export default StatCard;
