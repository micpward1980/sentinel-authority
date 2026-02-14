import { styles } from '../config/styles';
import React from 'react';

export default function EmptyState({ icon: Icon, title, message, description, action }) {
  const msg = message || description;
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: styles.textTertiary, fontFamily: "var(--mono)" }}>
      {Icon && <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.5 }}>
        {typeof Icon === 'function' ? <Icon size={32} strokeWidth={1.5} /> : Icon}
      </div>}
      {title && <div style={{ fontFamily: "var(--serif)", fontSize: '22px', fontWeight: 200, color: styles.textSecondary, marginBottom: '8px' }}>{title}</div>}
      {msg && <div style={{ fontSize: '12px', letterSpacing: '1px', color: styles.textTertiary, maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>{msg}</div>}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}
