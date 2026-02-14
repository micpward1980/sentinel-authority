import React from 'react';

export default function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#6b5a9e" stroke="#b8aad4" strokeWidth="2"/>
      <circle cx="12" cy="12" r="3.5" fill="#e0d8f0"><animate attributeName="opacity" values="0.75;1;0.75" dur="7s" repeatCount="indefinite"/></circle>
    </svg>
  );
}
