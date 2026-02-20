import React from 'react';
import { styles } from '../config/styles';

const StatCard = React.memo(function StatCard({ label, value, sublabel, subtitle, color, icon, onClick, className = '' }) {
  const sub = sublabel || subtitle;
  return (
    <div
      className={`glass-panel ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: '20px 16px', position: 'relative' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px' }}>
            {label}
          </div>
          <div style={{ fontFamily: styles.serif, fontSize: '28px', fontWeight: 200, color: color || styles.textPrimary, letterSpacing: '-0.02em' }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: styles.textTertiary, marginTop: '6px' }}>
              {sub}
            </div>
          )}
        </div>
        {icon && <div style={{ opacity: 0.6 }}>{icon}</div>}
      </div>
    </div>
  );
});

export default StatCard;
