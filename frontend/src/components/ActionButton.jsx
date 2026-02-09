import React from 'react';

export default function ActionButton({ children, primary = false, onClick, href, disabled = false, className = '', style = {}, ...props }) {
  const cls = `btn ${primary ? 'primary' : ''} ${className}`.trim();
  const s = { ...(disabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}), ...style };
  if (href) return <a href={href} className={cls} style={s} {...props}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={s} {...props}>{children}</button>;
}
