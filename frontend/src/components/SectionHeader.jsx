import React from 'react';
import { styles } from '../config/styles';

function SectionHeader({ label, title, description, action }) {
  return (
    <div style={{marginBottom: '24px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          {label && (
            <p style={{fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0'}}>
              {label}
            </p>
          )}
          <h1 style={{fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary}}>
            {title}
          </h1>
          {description && (
            <p style={{color: styles.textSecondary, marginTop: '8px', fontSize: '14px', lineHeight: 1.6, fontWeight: 300, maxWidth: '580px'}}>
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export default SectionHeader;
