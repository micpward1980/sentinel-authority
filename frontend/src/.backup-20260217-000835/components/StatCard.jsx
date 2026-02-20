import { styles } from '../config/styles';
import React from 'react';

export default function StatCard({ label, value, sublabel, subtitle, color, icon, onClick, className = '' }) {
  const sub = sublabel || subtitle;
  return (
    <div className={`hud-frame ${className}`} onClick={onClick} style={{
      cursor: onClick ? 'pointer' : 'default',
      padding: '20px 16px',
      position: 'relative',
      transition: 'border-color 0.3s ease',
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(74,61,117,.35)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = ''; }}
    >
      <i aria-hidden="true" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px' }}>{label}</div>
          <div style={{ fontFamily: styles.serif, fontSize: '28px', fontWeight: 200, color: color || styles.textPrimary, letterSpacing: '-0.02em' }}>{value}</div>
          {sub && <div style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', color: styles.textTertiary, marginTop: '6px' }}>{sub}</div>}
        </div>
        {icon && <div style={{ opacity: 0.5 }}>{icon}</div>}
      </div>
    </div>
  );
}
