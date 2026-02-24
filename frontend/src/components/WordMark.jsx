import React from 'react';

export default function WordMark() {
  return (
    <svg width="260" height="56" viewBox="0 0 460 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <style>{`
          .wm  { font-family: "League Spartan", Arial, sans-serif; font-weight: 900; fill: #0f1021; }
          .mono { font-family: "League Spartan", Arial, sans-serif; font-weight: 900; fill: #0f1021; }
        `}</style>
      </defs>
      <circle cx="62" cy="60" r="50" stroke="#0f1021" strokeWidth="3.4"/>
      <circle cx="62" cy="60" r="43" stroke="#0f1021" strokeWidth="1.1" strokeOpacity="0.20"/>
      <text x="62" y="74" textAnchor="middle" className="mono" fontSize="40" letterSpacing="-1.1">SA</text>
      <text x="132" y="54" className="wm" fontSize="34" letterSpacing="-0.15">SENTINEL</text>
      <text x="132" y="84" className="wm" fontSize="34" letterSpacing="-0.25">AUTHORITY</text>
    </svg>
  );
}
