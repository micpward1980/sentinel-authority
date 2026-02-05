import React, { useState } from 'react';
import { styles } from '../config/styles';

function StatCard({ label, value, trend, color = styles.purpleBright, icon, subtitle, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '16px',
        padding: '1px',
        background: hovered
          ? `linear-gradient(135deg, ${color}60, transparent 60%, ${color}30)`
          : `linear-gradient(135deg, ${color}25, transparent 50%, rgba(255,255,255,0.05))`,
        transition: 'all 0.3s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{
        borderRadius: '15px',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(30,33,43,0.95) 0%, rgba(42,47,61,0.9) 100%)',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100px',
      }}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:`linear-gradient(90deg,transparent,${color}40,transparent)`}}/>
        <div style={{position:'absolute',top:'12px',right:'12px',width:'80px',height:'80px',borderRadius:'50%',background:`radial-gradient(circle,${color}08 0%,transparent 70%)`,pointerEvents:'none'}}/>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative'}}>
          <div>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px', margin: '0 0 12px 0'}}>{label}</p>
            <p style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, color: color, margin: 0, lineHeight: 1}}>{value}</p>
            {trend != null && <p style={{fontSize: '11px', color: trend > 0 ? styles.accentGreen : trend < 0 ? styles.accentRed : styles.textTertiary, marginTop: '8px', fontFamily: "'IBM Plex Mono', monospace"}}>{trend > 0 ? '▲' : trend < 0 ? '▼' : '●'} {Math.abs(trend)}%</p>}
            {subtitle && <p style={{fontSize: '11px', color: styles.textTertiary, marginTop: '6px', fontFamily: "'IBM Plex Mono', monospace"}}>{subtitle}</p>}
          </div>
          {icon && <div style={{width: '48px', height: '48px', borderRadius: '12px', background: `${color}12`, border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: hovered ? `0 0 20px ${color}20` : 'none', transition: 'box-shadow 0.3s'}}>{icon}</div>}
        </div>
      </div>
    </div>
  );
}

export default StatCard;

