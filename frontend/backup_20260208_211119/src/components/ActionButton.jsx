import React from 'react';
import { styles } from '../config/styles';

function ActionButton({ children, onClick, variant = 'default', disabled, className = '', ...props }) {
  const cls = variant === 'primary' ? 'sa-primary' : '';
  return (
    <button onClick={onClick} disabled={disabled} className={cls + ' ' + className} {...props}>
      {children}
    </button>
  );
}

export default ActionButton;
