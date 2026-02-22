import { styles } from "../config/styles";
import React, { useState, useCallback } from 'react';

export default function ActionButton({
  children, primary = false, solid = false,
  onClick, href, disabled = false, loading: loadingProp = false,
  className = '', style = {}, ...props
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = loadingProp || internalLoading;

  const handleClick = useCallback(async (e) => {
    if (disabled || loading) return;
    if (!onClick) return;
    setInternalLoading(true);
    try {
      await onClick(e);
    } finally {
      setInternalLoading(false);
    }
  }, [disabled, loading, onClick]);

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
    cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
    opacity: (disabled || loading) ? 0.5 : 1,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    position: 'relative',
    overflow: 'visible',
    borderRadius: 0,
    transition: 'all 0.2s ease',
    minWidth: loading ? '80px' : undefined,
  };

  const variants = {
    ...(primary && !solid ? {
      borderColor: 'rgba(29,26,59,0.60)',
      background: 'transparent',
      color: 'rgba(29,26,59,1.00)',
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
    if (disabled || loading) return;
    if (solid) {
      e.currentTarget.style.color = styles.purplePrimary;
      e.currentTarget.style.borderBottomColor = styles.purplePrimary;
    } else if (primary) {
      e.currentTarget.style.borderColor = 'rgba(29,26,59,0.90)';
      e.currentTarget.style.background = 'rgba(29,26,59,0.04)';
    } else {
      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.30)';
    }
  };

  const unhover = (e) => {
    if (disabled || loading) return;
    if (solid) {
      e.currentTarget.style.color = styles.purpleBright;
      e.currentTarget.style.borderBottomColor = styles.purpleBright;
    } else if (primary) {
      e.currentTarget.style.borderColor = 'rgba(29,26,59,0.60)';
      e.currentTarget.style.background = 'transparent';
    } else {
      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)';
    }
  };

  const cls = `btn ${primary ? 'primary' : ''} ${solid ? 'solid' : ''} ${className}`.trim();

  const inner = loading ? (
    <>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>{children}</span>
    </>
  ) : children;

  if (href) return (
    <a href={href} className={cls} style={s}
      onMouseEnter={hover} onMouseLeave={unhover} {...props}>
      {inner}
    </a>
  );

  return (
    <button onClick={handleClick} disabled={disabled || loading}
      className={cls} style={s}
      onMouseEnter={hover} onMouseLeave={unhover} {...props}>
      {inner}
    </button>
  );
}
