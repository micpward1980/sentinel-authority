import React from 'react';

export default function EmptyState({ icon: Icon, title, message, description, action }) {
  const text = message || description;
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: 'var(--mono)' }}>
      {Icon && (
        <div style={{ marginBottom: '16px', opacity: 0.4, display: 'flex', justifyContent: 'center' }}>
          {React.isValidElement(Icon) ? Icon : <Icon size={28} strokeWidth={1.5} />}
        </div>
      )}
      {title && <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 'normal', color: 'var(--text-secondary)', marginBottom: '8px' }}>{title}</div>}
      {text && <div style={{ fontSize: '12px', letterSpacing: '0.5px', color: 'var(--text-tertiary)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.7 }}>{text}</div>}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}
