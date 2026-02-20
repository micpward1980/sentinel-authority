import React from 'react';
import { styles } from '../config/styles';

const COLORS = {
  green:  styles.accentGreen,
  amber:  styles.accentAmber,
  red:    styles.accentRed,
  purple: styles.purpleBright,
  dim:    styles.textTertiary,
};

const StatusPill = React.memo(function StatusPill({ label, value, color = 'dim', title }) {
  const c = COLORS[color] || COLORS.dim;
  return (
    <div title={title} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        display: 'inline-block', width: '5px', height: '5px',
        borderRadius: '50%', background: c, flexShrink: 0,
        boxShadow: `0 0 4px ${c}`,
      }} />
      <div>
        {label && (
          <div style={{ fontFamily: styles.mono, fontSize: '8px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: styles.textDim, lineHeight: 1, marginBottom: '2px' }}>
            {label}
          </div>
        )}
        <div style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, color: c, lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
});

export default StatusPill;
