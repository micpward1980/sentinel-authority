import React from 'react';

export default function SectionHeader({ label, title, description, action }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          {label && (
            <p className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '24px', height: '1px', background: 'var(--purple-bright)' }} />
              {label}
            </p>
          )}
          <h1 className="page-title">{title}</h1>
          {description && <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px', fontWeight: 200 }}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
