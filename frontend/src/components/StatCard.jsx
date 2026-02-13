import React from 'react';

export default function StatCard({ label, value, sublabel, subtitle, color, icon, onClick, className = '' }) {
  const sub = sublabel || subtitle;
  return (
    <div
      className={`stat-card ${className}`}
      data-clickable={onClick ? 'true' : undefined}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px' }}>{label}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', className: 'sa-stat-value', fontWeight: 'normal', color: color || 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,.55)', marginTop: '8px' }}>{sub}</div>}
        </div>
        {icon && <div style={{ opacity: 0.5, color: color || 'var(--text-tertiary)' }}>{icon}</div>}
      </div>
    </div>
  );
}
