import React from 'react';

export default function Logo({ height = 48, color = '#1d1a3b' }) {
  const scale = height / 120;
  const w = Math.round(460 * scale);
  return (
    <svg width={w} height={height} viewBox="0 0 460 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Sentinel Authority">
      <circle cx="62" cy="60" r="50" stroke={color} strokeWidth="3.4"/>
      <circle cx="62" cy="60" r="43" stroke={color} strokeWidth="1.1" strokeOpacity="0.20"/>
      <text x="62" y="74" textAnchor="middle" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="40" fill={color} letterSpacing="-1.1">SA</text>
      <text x="132" y="54" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="34" fill={color} letterSpacing="-0.15">SENTINEL</text>
      <text x="132" y="84" fontFamily="'League Spartan', Arial, sans-serif" fontWeight="900" fontSize="34" fill={color} letterSpacing="-0.25">AUTHORITY</text>
    </svg>
  );
}
