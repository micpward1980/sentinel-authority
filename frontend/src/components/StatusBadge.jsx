import React from 'react';
import { styles } from '../config/styles';

function StatusBadge({ status, size = 'md' }) {
  const statusConfig = {
    pending: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Pending' },
    under_review: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Under Review' },
    approved: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Approved' },
    testing: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Testing' },
    conformant: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Conformant' },
    certified: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Certified' },
    active: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Active' },
    issued: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Issued' },
    revoked: { bg: 'rgba(214,92,92,0.15)', border: 'rgba(214,92,92,0.3)', color: styles.accentRed, label: 'Revoked' },
    suspended: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Suspended' },
    running: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Running' },
    scheduled: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Scheduled' },
    completed: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Completed' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  const padding = size === 'sm' ? '4px 10px' : '6px 14px';
  const fontSize = size === 'sm' ? '9px' : '10px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding, borderRadius: '20px', fontSize, fontFamily: "Consolas, 'IBM Plex Mono', monospace",
      letterSpacing: '1px', textTransform: 'uppercase',
      background: config.bg, border: `1px solid ${config.border}`, color: config.color,
    }}>
      <span style={{width: '6px', height: '6px', borderRadius: '50%', background: config.color, boxShadow: `0 0 8px ${config.color}`}}></span>
      {config.label}
    </span>
  );
}

export default StatusBadge;

