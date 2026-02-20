import { styles } from "../config/styles";
import React from 'react';

export default function ActionButton({ children, primary = false, solid = false, onClick, href, disabled = false, className = '', style = {}, ...props }) {
  const base = {
    appearance: 'none',
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'transparent',
    backgroundImage: 'none',
    color: styles.textPrimary,
    padding: '12px 20px',
    fontFamily: styles.mono,
    fontSize: '10px',
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
    overflow: 'visible',
    borderRadius: 0,
    transition: 'all 0.2s ease',
  };

  const variants = {
    ...(primary && !solid ? {
      borderColor: 'rgba(74,61,117,0.60)',
      background: 'transparent',
      color: 'rgba(74,61,117,1.00)',
    } : {}),
    ...(solid ? {
      border: 'none',
      borderBottom: `1px solid ${styles.purpleBright}`,
      background: 'transparent',
      color: styles.purpleBright,
    } : {}),
  };

  const s = { ...base, ...variants, ...style };

  const hover = (e) => {
    if (disabled) return;
    if (solid) {
      e.currentTarget.style.color = styles.purplePrimary;
      e.currentTarget.style.borderBottomColor = styles.purplePrimary;
    } else if (primary) {
      e.currentTarget.style.borderColor = 'rgba(74,61,117,0.90)';
      e.currentTarget.style.background = 'rgba(74,61,117,0.04)';
    } else {
      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.30)';
    }
  };

  const unhover = (e) => {
    if (disabled) return;
    if (solid) {
      e.currentTarget.style.color = styles.purpleBright;
      e.currentTarget.style.borderBottomColor = styles.purpleBright;
    } else if (primary) {
      e.currentTarget.style.borderColor = 'rgba(74,61,117,0.60)';
      e.currentTarget.style.background = 'transparent';
    } else {
      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)';
    }
  };

  const cls = `btn ${primary ? 'primary' : ''} ${solid ? 'solid' : ''} ${className}`.trim();

  if (href) return <a href={href} className={cls} style={s} onMouseEnter={hover} onMouseLeave={unhover} {...props}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={s} onMouseEnter={hover} onMouseLeave={unhover} {...props}>{children}</button>;
}
