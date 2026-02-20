import React from 'react';

export default function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="32" height="32" rx="8" fill="#7B6BAE" stroke="#b8aad4" strokeWidth="2"/>
      <circle cx="18" cy="18" r="6" fill="#e0d8f0">
        <animate attributeName="opacity" values="0.75;1;0.75" dur="7s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}
