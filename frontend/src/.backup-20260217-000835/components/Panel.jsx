import React from 'react';
import { styles } from '../config/styles';

export default function Panel({ children, className = '', style = {}, ...props }) {
  return (
    <div className={`hud-frame ${className}`} style={{
      padding: '20px 16px',
      position: 'relative',
      ...style
    }} {...props}>
      <i aria-hidden="true" />
      {children}
    </div>
  );
}
