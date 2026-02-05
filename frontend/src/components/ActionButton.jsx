import React from 'react';
import { styles } from '../config/styles';

function ActionButton({ children, variant = 'primary', size = 'md', icon, onClick, disabled, href }) {
  const variants = {
    primary: { bg: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)', border: 'rgba(157,140,207,0.5)', color: '#fff', shadow: '0 4px 20px rgba(91,75,138,0.3)' },
    secondary: { bg: 'transparent', border: 'rgba(255,255,255,0.15)', color: styles.textPrimary, shadow: 'none' },
    success: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.4)', color: styles.accentGreen, shadow: 'none' },
    danger: { bg: 'rgba(214,92,92,0.1)', border: 'rgba(214,92,92,0.3)', color: styles.accentRed, shadow: 'none' },
  };
  const sizes = { sm: '10px 16px', md: '12px 20px', lg: '14px 28px' };
  const v = variants[variant];
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: sizes[size], borderRadius: '12px',
    background: v.bg, border: `1px solid ${v.border}`, color: v.color,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: size === 'sm' ? '10px' : '11px',
    letterSpacing: '1px', textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, boxShadow: v.shadow,
    textDecoration: 'none', transition: 'all 0.2s ease',
  };
  const Component = href ? 'a' : 'button';
  return <Component href={href} onClick={onClick} disabled={disabled} style={style}>{icon}{children}</Component>;
}

export default ActionButton;

