import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { styles } from '../config/styles';

const ConfirmContext = React.createContext();

function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, title: '', message: '', onConfirm: null, onCancel: null, confirmLabel: 'Confirm', danger: false });

  const confirm = (opts) => new Promise((resolve) => {
    setState({
      open: true,
      title: opts.title || 'Confirm',
      message: opts.message || 'Are you sure?',
      confirmLabel: opts.confirmLabel || 'Confirm',
      danger: opts.danger || false,
      onConfirm: () => { setState(s => ({ ...s, open: false })); resolve(true); },
      onCancel: () => { setState(s => ({ ...s, open: false })); resolve(false); },
    });
  });

  const modal = state.open ? ReactDOM.createPortal(
    <div onClick={state.onCancel} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.25)', backdropFilter: styles.frostOverlay, WebkitBackdropFilter: styles.frostOverlay }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: styles.frostModal, WebkitBackdropFilter: styles.frostModal, border: '1px solid ' + styles.borderGlass, maxWidth: '420px', width: '90%', padding: '32px', position: 'relative' }}>
        <button onClick={state.onCancel} style={{ position: 'absolute', top: 14, right: 14, appearance: 'none', border: 'none', background: 'none', color: styles.textDim, fontFamily: styles.mono, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        <h3 style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 400, letterSpacing: '2.5px', textTransform: 'uppercase', color: state.danger ? styles.accentRed : styles.purpleBright, margin: '0 0 4px' }}>{state.title}</h3>
        <p style={{ color: styles.textTertiary, fontFamily: styles.mono, fontSize: '13px', lineHeight: 1.6, margin: '0 0 24px' }}>{state.message}</p>
        <button onClick={state.onConfirm} style={{ appearance: 'none', width: '100%', border: '1px solid ' + (state.danger ? 'rgba(180,52,52,.25)' : 'rgba(29,26,59,.25)'), background: 'transparent', color: state.danger ? styles.accentRed : styles.purpleBright, padding: '12px 24px', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer' }}>{state.confirmLabel} →</button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modal}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => React.useContext(ConfirmContext);
export { ConfirmProvider };
export default ConfirmContext;
