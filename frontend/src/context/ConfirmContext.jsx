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
        <div style={{position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'}}>
          <div style={{background: styles.bgCard, border: `1px solid ${styles.borderGlass}`, borderRadius: '16px', maxWidth: '420px', width: '90%', overflow: 'hidden'}}>
            <div style={{padding: '24px 24px 16px'}}>
              <h3 style={{margin: '0 0 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: state.danger ? '#D65C5C' : styles.purpleBright}}>{state.title}</h3>
              <p style={{margin: 0, color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5'}}>{state.message}</p>
            </div>
            <div style={{padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: `1px solid ${styles.borderGlass}`}}>
              <button onClick={state.onCancel} style={{padding: '8px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Cancel</button>
              <button onClick={state.onConfirm} style={{padding: '8px 20px', borderRadius: '8px', background: state.danger ? 'rgba(214,92,92,0.2)' : styles.purplePrimary, border: `1px solid ${state.danger ? 'rgba(214,92,92,0.4)' : styles.purpleBright}`, color: state.danger ? '#D65C5C' : '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>{state.confirmLabel}</button>
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

