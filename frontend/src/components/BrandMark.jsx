import React from 'react';

export default function BrandMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="46" stroke="#1d1a3b" strokeWidth="5" fill="white"/>
      <circle cx="50" cy="50" r="39" stroke="#1d1a3b" strokeWidth="1.5" strokeOpacity="0.20" fill="none"/>
      <text x="50" y="64" textAnchor="middle" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="38" fill="#1d1a3b" letterSpacing="-1">SA</text>
    </svg>
  );
}
