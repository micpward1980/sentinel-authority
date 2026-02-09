import React, { useState } from 'react';
import { styles } from '../config/styles';

const ConfirmContext = React.createContext();

function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, title: '', message: '', onConfirm: null, confirmLabel: 'Confirm', danger: false });
  
  const confirm = (opts) => new Promise((resolve) => {
    setState({ open: true, title: opts.title || 'Confirm', message: opts.message || 'Are you sure?', confirmLabel: opts.confirmLabel || 'Confirm', danger: opts.danger || false, onConfirm: () => { setState(s => ({...s, open: false})); resolve(true); }, onCancel: () => { setState(s => ({...s, open: false})); resolve(false); } });
  });

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div style={{position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)'}}>
          <div style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '18px', maxWidth: '420px', width: '90%', overflow: 'hidden'}}>
            <div style={{padding: '24px 24px 16px'}}>
              <h3 style={{margin: '0 0 8px', fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: state.danger ? '#D65C5C' : styles.purpleBright}}>{state.title}</h3>
              <p style={{margin: 0, color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5'}}>{state.message}</p>
            </div>
            <div style={{padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: `1px solid ${styles.borderGlass}`}}>
              <button className="btn" style={{padding: '8px 20px'}} onClick={state.onCancel}>Cancel</button>
              <button className="btn primary" style={{padding: '8px 20px', ...(state.danger ? {borderColor: 'rgba(214,92,92,0.4)', background: 'rgba(214,92,92,0.2)', color: '#D65C5C'} : {})}} onClick={state.onConfirm}>{state.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => React.useContext(ConfirmContext);

export { ConfirmProvider };
export default ConfirmContext;
