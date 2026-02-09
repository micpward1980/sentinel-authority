import React from 'react';

export default function Panel({ children, className = '', style = {}, ...props }) {
  return (
    <div className={`panel ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}
