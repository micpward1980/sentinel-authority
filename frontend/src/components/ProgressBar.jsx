import React from 'react';
import { styles } from '../config/styles';

export default function ProgressBar({ value = 0, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: 'rgba(0,0,0,.05)', height: '4px', overflow: 'hidden', width: '100%' }}>
      <div style={{ width: pct+'%', height: '100%', background: color || styles.purpleBright, transition: 'width .6s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  );
}
