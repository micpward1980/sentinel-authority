import React from 'react';

export default function EmptyState({ icon, title, message, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,.50)', fontFamily: "var(--mono)" }}>
      {icon && <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.5 }}>{icon}</div>}
      {title && <div style={{ fontFamily: "var(--serif)", fontSize: '22px', fontWeight: 200, color: 'rgba(255,255,255,.75)', marginBottom: '8px' }}>{title}</div>}
      {message && <div style={{ fontSize: '12px', letterSpacing: '1px', color: 'rgba(255,255,255,.42)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>{message}</div>}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}
