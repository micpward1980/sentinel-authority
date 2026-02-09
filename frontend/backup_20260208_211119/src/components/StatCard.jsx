import React from 'react';
import { styles } from '../config/styles';

function StatCard({ label, value, trend, color = styles.purpleBright, icon, subtitle, onClick }) {
  const M = styles.mono;
  return (
    <div onClick={onClick} className="hud-frame"
      style={{cursor: onClick ? 'pointer' : 'default', padding: '20px 16px', transition: 'background 0.15s'}}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      <div className="hud-corners" />
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <p style={{fontFamily: M, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px 0'}}>{label}</p>
          <p style={{fontFamily: M, fontSize: '32px', fontWeight: 400, color: color, margin: 0, lineHeight: 1, letterSpacing: '-1px'}}>{value}</p>
          {trend != null && <p style={{fontSize: '11px', color: trend > 0 ? styles.accentGreen : trend < 0 ? styles.accentRed : 'rgba(255,255,255,0.35)', marginTop: '8px', fontFamily: M}}>{trend > 0 ? '▲' : trend < 0 ? '▼' : '●'} {Math.abs(trend)}%</p>}
          {subtitle && <p style={{fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '6px', fontFamily: M}}>{subtitle}</p>}
        </div>
        {icon && <div style={{opacity: 0.35}}>{icon}</div>}
      </div>
    </div>
  );
}

export default StatCard;
