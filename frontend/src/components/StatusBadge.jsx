// components/StatusBadge.jsx — Sentinel Authority v4
// Salesforce "Lightning" pill style with Sentinel-specific status labels
// 4px radius, colored dot, high-contrast status intensity

import React from 'react';
import { styles } from '../config/styles';

// ── Sentinel status map ────────────────────────────────────────────────────────
// Each entry: color (solid), bg (tinted), label (institutional copy)
const STATUS_MAP = {
  // ── Conformant / Active ────────────────────────────────────────────────────
  conformant: {
    color:  styles.accentGreen,
    bg:     'rgba(22,135,62,0.08)',
    border: 'rgba(22,135,62,0.20)',
    label:  'CONFORMANT',
  },
  active: {
    color:  styles.accentGreen,
    bg:     'rgba(22,135,62,0.08)',
    border: 'rgba(22,135,62,0.20)',
    label:  'CONFORMANT',
  },
  approved: {
    color:  styles.accentGreen,
    bg:     'rgba(22,135,62,0.08)',
    border: 'rgba(22,135,62,0.20)',
    label:  'APPROVED',
  },
  issued: {
    color:  styles.accentGreen,
    bg:     'rgba(22,135,62,0.08)',
    border: 'rgba(22,135,62,0.20)',
    label:  'ISSUED',
  },
  passed: {
    color:  styles.accentGreen,
    bg:     'rgba(22,135,62,0.08)',
    border: 'rgba(22,135,62,0.20)',
    label:  'PASSED',
  },

  // ── In Progress / Bounded ─────────────────────────────────────────────────
  testing: {
    color:  styles.purpleBright,
    bg:     'rgba(107,90,158,0.08)',
    border: 'rgba(107,90,158,0.20)',
    label:  'CAT-72 IN PROGRESS',
  },
  pending: {
    color:  styles.accentAmber,
    bg:     'rgba(158,110,18,0.08)',
    border: 'rgba(158,110,18,0.20)',
    label:  'PENDING REVIEW',
  },
  bounded: {
    color:  styles.accentAmber,
    bg:     'rgba(158,110,18,0.08)',
    border: 'rgba(158,110,18,0.20)',
    label:  'BOUNDED',
  },
  review: {
    color:  styles.accentAmber,
    bg:     'rgba(158,110,18,0.08)',
    border: 'rgba(158,110,18,0.20)',
    label:  'UNDER REVIEW',
  },
  warning: {
    color:  styles.accentAmber,
    bg:     'rgba(158,110,18,0.08)',
    border: 'rgba(158,110,18,0.20)',
    label:  'WARNING',
  },
  submitted: {
    color:  styles.accentBlue,
    bg:     'rgba(26,111,168,0.08)',
    border: 'rgba(26,111,168,0.20)',
    label:  'SUBMITTED',
  },
  odd_review: {
    color:  styles.accentBlue,
    bg:     'rgba(26,111,168,0.08)',
    border: 'rgba(26,111,168,0.20)',
    label:  'ODD REVIEW',
  },

  // ── Revoked / Failed ──────────────────────────────────────────────────────
  revoked: {
    color:  styles.accentRed,
    bg:     'rgba(180,52,52,0.08)',
    border: 'rgba(180,52,52,0.20)',
    label:  'REVOKED',
  },
  suspended: {
    color:  styles.accentRed,
    bg:     'rgba(180,52,52,0.08)',
    border: 'rgba(180,52,52,0.20)',
    label:  'SUSPENDED',
  },
  failed: {
    color:  styles.accentRed,
    bg:     'rgba(180,52,52,0.08)',
    border: 'rgba(180,52,52,0.20)',
    label:  'FAILED',
  },
  error: {
    color:  styles.accentRed,
    bg:     'rgba(180,52,52,0.08)',
    border: 'rgba(180,52,52,0.20)',
    label:  'ERROR',
  },
};

const DEFAULT_CFG = {
  color:  styles.textTertiary,
  bg:     'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.10)',
};

export default function StatusBadge({ status = '', label, children, showDot = true }) {
  const key = (status || '').toLowerCase().replace(/[\s-]/g, '_');
  const cfg = STATUS_MAP[key] || DEFAULT_CFG;
  const displayLabel = label || children || cfg.label || status;

  return (
    <span
      data-badge="true"
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            styles.spacing.xs,
        padding:        '4px 10px',
        borderRadius:   '4px',           // Salesforce standard pill (not 999px)
        background:     cfg.bg,
        color:          cfg.color,
        fontFamily:     styles.mono,
        fontSize:       '10px',
        fontWeight:     600,
        letterSpacing:  '1px',
        border:         `1px solid ${cfg.border}`,
        textTransform:  'uppercase',
        whiteSpace:     'nowrap',
        lineHeight:     1,
      }}
    >
      {showDot && (
        <span
          data-dot="true"
          style={{
            width:        '6px',
            height:       '6px',
            borderRadius: '50%',
            background:   cfg.color,
            flexShrink:   0,
          }}
        />
      )}
      {displayLabel}
    </span>
  );
}
