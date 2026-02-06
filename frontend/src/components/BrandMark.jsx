import React from 'react';

function BrandMark({ size = 24 }) {
  return (
    <div 
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: '#5B4B8A',
        border: '2px solid #a896d6',
        borderRadius: 6,
      }}
    >
      <div 
        className="rounded-full"
        style={{
          width: size * 0.33,
          height: size * 0.33,
          background: '#c4b8e8',
          animation: 'eyePulse 7s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes eyePulse {
          0%, 100% { opacity: 0.75; transform: scale(0.98); box-shadow: 0 0 0 rgba(196,184,232,0); }
          50% { opacity: 1; transform: scale(1.02); box-shadow: 0 0 10px rgba(157,140,207,0.22); }
        }
      `}</style>
    </div>
  );
}

export default BrandMark;

