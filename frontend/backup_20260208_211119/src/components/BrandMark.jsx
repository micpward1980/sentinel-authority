import React from 'react';

function BrandMark({ size = 24 }) {
  const dotSize = Math.round(size * 0.33);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#5B4B8A" stroke="#a896d6" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="#c4b8e8">
        <animate attributeName="opacity" values="0.75;1;0.75" dur="7s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

export default BrandMark;
