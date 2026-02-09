import React from 'react';
import { styles } from '../config/styles';

function ProgressBar({ value = 0, color = styles.purpleBright, height = 3 }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{width: '100%', height: height + 'px', background: 'rgba(255,255,255,0.04)'}}>
      <div style={{width: pct + '%', height: '100%', background: pct >= 100 ? styles.accentGreen : color, transition: 'width 0.3s'}} />
    </div>
  );
}

export default ProgressBar;
