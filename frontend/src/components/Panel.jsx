import React from 'react';
import { styles } from '../config/styles';

function Panel({ children, className = '', glow = false, accent = null }) {
  const accentColors = {
    purple: 'rgba(157,140,207,0.15)',
    green: 'rgba(92,214,133,0.1)',
    amber: 'rgba(214,160,92,0.1)',
    red: 'rgba(214,92,92,0.1)',
  };
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{
      background: accent ? `linear-gradient(135deg, ${accentColors[accent] || accentColors.purple} 0%, rgba(255,255,255,0.02) 100%)` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${styles.borderGlass}`,
      backdropFilter: 'blur(16px)',
      boxShadow: glow ? '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {glow && <><div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(157,140,207,0.3),transparent)'}}/><div style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(157,140,207,0.1),transparent)'}}/></>}
      {children}
    </div>
  );
}

export default Panel;

