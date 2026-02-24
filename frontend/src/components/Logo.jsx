import React from 'react';

export default function Logo({ height = 48 }) {
  const scale = height / 68;
  return (
    <svg width={320 * scale} height={height} viewBox="0 0 460 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Sentinel Authority">
      <circle cx="62" cy="60" r="50" stroke="#1d1a3b" strokeWidth="3.4"/>
      <circle cx="62" cy="60" r="43" stroke="#1d1a3b" strokeWidth="1.1" strokeOpacity="0.20"/>
      <text x="62" y="74" textAnchor="middle" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="40" fill="#1d1a3b" letterSpacing="-1.1">SA</text>
      <text x="132" y="54" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="34" fill="#1d1a3b" letterSpacing="-0.15">SENTINEL</text>
      <text x="132" y="84" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="34" fill="#1d1a3b" letterSpacing="-0.25">AUTHORITY</text>
    </svg>
  );
}
