import React from 'react';
import { styles } from '../config/styles';

const STATUS_MAP = {
  conformant: { color: styles.accentGreen, label: 'CONFORMANT' },
  active: { color: styles.accentGreen, label: 'ACTIVE' },
  issued: { color: styles.accentGreen, label: 'ISSUED' },
  passed: { color: styles.accentGreen, label: 'PASSED' },
  approved: { color: styles.purpleBright, label: 'APPROVED' },
  testing: { color: styles.purpleBright, label: 'TESTING' },
  running: { color: styles.purpleBright, label: 'RUNNING' },
  observe: { color: styles.purpleBright, label: 'OBSERVE' },
  pending: { color: styles.accentAmber, label: 'PENDING' },
  under_review: { color: styles.accentAmber, label: 'UNDER REVIEW' },
  in_review: { color: styles.accentAmber, label: 'IN REVIEW' },
  submitted: { color: styles.accentAmber, label: 'SUBMITTED' },
  warning: { color: styles.accentAmber, label: 'WARNING' },
  revoked: { color: styles.accentRed, label: 'REVOKED' },
  suspended: { color: styles.accentRed, label: 'SUSPENDED' },
  failed: { color: styles.accentRed, label: 'FAILED' },
  rejected: { color: styles.accentRed, label: 'REJECTED' },
  expired: { color: styles.accentRed, label: 'EXPIRED' },
  cancelled: { color: styles.textTertiary, label: 'CANCELLED' },
  draft: { color: styles.textTertiary, label: 'DRAFT' },
  inactive: { color: styles.textTertiary, label: 'INACTIVE' }
};

function StatusBadge({ status, label }) {
  const cfg = STATUS_MAP[status] || { color: styles.textTertiary, label: (status || '').toUpperCase() };
  const displayLabel = label || cfg.label;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '3px 10px',
      border: '1px solid ' + cfg.color + '18',
      fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px',
      textTransform: 'uppercase', color: cfg.color
    }}>
      <span data-dot="true" style={{width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, flexShrink: 0}} />
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
