import React from 'react';

export default function BrandMark({ size = 24, color = '#1d1a3b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" stroke={color} strokeWidth="3.4"/>
      <circle cx="60" cy="60" r="43" stroke={color} strokeWidth="1.1" strokeOpacity="0.20"/>
      <text x="60" y="74" textAnchor="middle" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="42" letterSpacing="-1.1" fill={color}>SA</text>
    </svg>
  );
}
