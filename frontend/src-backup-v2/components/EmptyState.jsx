import React from 'react';

export default function EmptyState({ icon: Icon, title, message, description, action }) {
  const text = message || description;
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
      {Icon && <div style={{ marginBottom: '16px', opacity: 0.5, display: 'flex', justifyContent: 'center' }}>{typeof Icon === 'function' ? <Icon size={32} strokeWidth={1.5} /> : Icon}</div>}
      {title && <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 200, color: 'var(--text-secondary)', marginBottom: '8px' }}>{title}</div>}
      {text && <div style={{ fontSize: '12px', letterSpacing: '1px', color: 'var(--text-dim)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>{text}</div>}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}
