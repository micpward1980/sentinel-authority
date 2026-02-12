import React from 'react';
import { styles } from '../config/styles';

export default function SectionHeader({ label, title, description, action }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          {label && (
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '24px', height: '1px', background: styles.purpleBright }} />
              {label}
            </p>
          )}
          <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 'normal', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          {description && <p style={{ color: styles.textSecondary, marginTop: '8px', fontSize: '14px', lineHeight: 1.6 }}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
