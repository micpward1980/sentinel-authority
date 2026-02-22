import React from 'react';
import { styles } from '../config/styles';

const Panel = React.memo(function Panel({ children, className = '', style = {}, ...props }) {
  return (
    <div className={`hud-frame ${className}`} style={{ padding: '24px 20px', position: 'relative', borderRadius: 4, background: 'rgba(15,18,30,0.02)', border: '1px solid rgba(15,18,30,0.10)', ...style }} {...props}>
      <i aria-hidden="true" />
      {children}
    </div>
  );
});

export default Panel;
