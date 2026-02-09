import React from 'react';

export default function StatCard({ label, value, sublabel, subtitle, color, icon, onClick, className = '' }) {
  const sub = sublabel || subtitle;
  return (
    <div
      className={`panel ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.2s ease' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = ''; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: '8px' }}>{label}</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: '28px', fontWeight: 200, color: color || 'rgba(255,255,255,.94)', letterSpacing: '-0.02em' }}>{value}</div>
          {sub && <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,.42)', marginTop: '6px' }}>{sub}</div>}
        </div>
        {icon && <div style={{ opacity: 0.6, color: color || 'rgba(255,255,255,.50)' }}>{icon}</div>}
      </div>
    </div>
  );
}
