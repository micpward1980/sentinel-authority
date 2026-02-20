import React from 'react';
import { styles } from '../config/styles';

const VARIANTS = {
  green:  { background: 'rgba(22,135,62,0.08)',  color: styles.accentGreen  },
  amber:  { background: 'rgba(158,110,18,0.08)', color: styles.accentAmber  },
  red:    { background: 'rgba(180,52,52,0.08)',   color: styles.accentRed    },
  purple: { background: 'rgba(74,61,117,0.08)',   color: styles.purpleBright },
  dim:    { background: 'rgba(15,18,30,0.05)',    color: styles.textTertiary },
};

export function stateVariant(state) {
  if (state === 'conformant')                    return 'green';
  if (state === 'revoked' || state === 'suspended') return 'red';
  if (state === 'testing'  || state === 'approved') return 'purple';
  if (state === 'pending'  || state === 'under_review') return 'amber';
  return 'dim';
}

const Badge = React.memo(function Badge({ children, variant = 'dim', style = {} }) {
  const v = VARIANTS[variant] || VARIANTS.dim;
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: styles.mono,
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      lineHeight: 1.6,
      ...v,
      ...style,
    }}>
      {children}
    </span>
  );
});

export default Badge;
