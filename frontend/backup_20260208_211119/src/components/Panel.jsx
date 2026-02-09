import React from 'react';

function Panel({ children, className = '' }) {
  return (
    <div className={'hud-frame ' + className} style={{marginBottom: '16px'}}>
      <div className="hud-corners" />
      {children}
    </div>
  );
}

export default Panel;
