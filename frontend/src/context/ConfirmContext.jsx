import React, { useState } from 'react';
import ReactDOM from 'react-dom';

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
    <div onClick={state.onCancel} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#2a2f3d', border: '1px solid rgba(255,255,255,.06)', maxWidth: '420px', width: '90%', padding: '32px', position: 'relative' }}>
        <button onClick={state.onCancel} style={{ position: 'absolute', top: 14, right: 14, appearance: 'none', border: 'none', background: 'none', color: 'rgba(255,255,255,.38)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        <h3 style={{ fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: '2.5px', textTransform: 'uppercase', color: state.danger ? 'rgba(214,92,92,0.78)' : 'rgba(157,140,207,0.78)', margin: '0 0 4px' }}>{state.title}</h3>
        <p style={{ color: 'rgba(255,255,255,.38)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', lineHeight: 1.6, margin: '0 0 24px' }}>{state.message}</p>
        <button onClick={state.onConfirm} style={{ appearance: 'none', width: '100%', border: '1px solid ' + (state.danger ? 'rgba(214,92,92,.3)' : 'rgba(157,140,207,.3)'), background: 'transparent', color: state.danger ? 'rgba(214,92,92,0.9)' : 'rgba(157,140,207,0.9)', padding: '12px 24px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer' }}>{state.confirmLabel} →</button>
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
