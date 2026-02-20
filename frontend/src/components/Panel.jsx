import React from 'react';
import { styles } from '../config/styles';

const Panel = React.memo(function Panel({ children, className = '', style = {}, ...props }) {
  return (
    <div className={`hud-frame ${className}`} style={{ padding: '20px 16px', position: 'relative', borderRadius: 8, background: styles.cardSurface, ...style }} {...props}>
      <i aria-hidden="true" />
      {children}
    </div>
  );
});

export default Panel;
