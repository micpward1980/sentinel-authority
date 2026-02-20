import React from 'react';
import { styles } from '../config/styles';

function SectionHeader({ label, title, description, action }) {
  return (
    <div style={{marginBottom: '24px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          {label && <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{width: '24px', height: '1px', background: 'rgba(74,61,117,.40)'}} />
            {label}
          </p>}
          <h1 style={{fontFamily: styles.serif, fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 300, margin: 0, letterSpacing: '-0.03em', color: styles.purpleAccent}}>{title}</h1>
          {description && <p style={{color: 'rgba(15,18,30,.64)', marginTop: '8px', fontSize: '16px', lineHeight: 1.85, fontWeight: 300}}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export default SectionHeader;
