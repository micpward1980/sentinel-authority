import React from 'react';

export default function StatCard({ label, value, sublabel, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: '28px', fontWeight: 200, color: 'rgba(255,255,255,.94)', letterSpacing: '-0.02em' }}>{value}</div>
      {sublabel && <div style={{ fontFamily: "var(--mono)", fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,.42)', marginTop: '6px' }}>{sublabel}</div>}
    </div>
  );
}
