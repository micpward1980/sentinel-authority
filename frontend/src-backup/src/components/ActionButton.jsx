import React from 'react';

export default function ActionButton({ children, primary = false, onClick, href, disabled = false, className = '', style = {}, ...props }) {
  const s = {
    appearance: 'none', border: '1px solid rgba(255,255,255,.18)', background: 'transparent', backgroundImage: 'none',
    color: 'rgba(255,255,255,.94)', padding: '14px 18px', borderRadius: '14px', fontFamily: "var(--mono)",
    fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
    ...(primary ? { borderColor: 'rgba(157,140,207,.55)', background: 'rgba(91,75,138,.18)' } : {}),
    ...style,
  };
  if (href) return <a href={href} className={`btn ${primary?'primary':''} ${className}`} style={s} {...props}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} className={`btn ${primary?'primary':''} ${className}`} style={s} {...props}>{children}</button>;
}
