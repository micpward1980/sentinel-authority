import React from 'react';

export default function BrandMark({ size = 32 }) {
  const inner = Math.round(size * 0.33);
  return (
    <div style={{
      width: size, height: size,
      background: '#7B6BAE',
      border: '2px solid #b8aad4',
      borderRadius: Math.round(size * 0.22),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{
        width: inner, height: inner,
        background: '#e0d8f0',
        borderRadius: '50%',
        animation: 'sa-eye-pulse 7s ease-in-out infinite',
      }} />
    </div>
  );
}
