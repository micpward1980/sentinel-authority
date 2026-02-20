import { styles } from "../config/styles";
import React from 'react';

export default function ActionButton({ children, primary = false, onClick, href, disabled = false, className = '', style = {}, ...props }) {
  const s = {
    appearance: 'none', border: '1px solid rgba(0,0,0,0.15)', background: 'transparent', backgroundImage: 'none',
    color: styles.textPrimary, padding: '12px 20px', fontFamily: styles.mono,
    fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
    position: 'relative', overflow: 'visible', borderRadius: 0,
    ...(primary ? { borderColor: 'rgba(74,61,117,0.60)', background: 'transparent', color: 'rgba(74,61,117,1.00)' } : {}),
    ...style,
  };
  if (href) return <a href={href} className={`btn ${primary?'primary':''} ${className}`} style={s} {...props}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} className={`btn ${primary?'primary':''} ${className}`} style={s} {...props}>{children}</button>;
}
