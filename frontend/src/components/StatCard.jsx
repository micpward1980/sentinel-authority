import { styles } from '../config/styles';
import React from 'react';

export default function StatCard({ label, value, sublabel, subtitle, color, icon, onClick, className = '' }) {
  const sub = sublabel || subtitle;
  return (
    <div className={`panel ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px' }}>{label}</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: '28px', fontWeight: 200, color: color || styles.textPrimary, letterSpacing: '-0.02em' }}>{value}</div>
          {sub && <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '1px', color: styles.textTertiary, marginTop: '6px' }}>{sub}</div>}
        </div>
        {icon && <div style={{ opacity: 0.6 }}>{icon}</div>}
      </div>
    </div>
  );
}
