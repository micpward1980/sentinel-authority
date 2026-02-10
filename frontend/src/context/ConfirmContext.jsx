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
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)' }}>
      <div style={{ background: '#120c1e', border: '1px solid rgba(157,140,207,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,.5)', maxWidth: '400px', width: '90%' }}>
        <div style={{ padding: '20px 20px 14px', background: '#120c1e' }}>
          <h3 style={{ margin: '0 0 8px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: state.danger ? '#D65C5C' : '#a896d6' }}>{state.title}</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.78)', fontSize: '13px', lineHeight: 1.5 }}>{state.message}</p>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,.06)', background: '#120c1e' }}>
          <button onClick={state.onCancel} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.78)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button onClick={state.onConfirm} style={{ padding: '8px 18px', background: state.danger ? 'rgba(214,92,92,0.2)' : '#5B4B8A', border: '1px solid ' + (state.danger ? 'rgba(214,92,92,.4)' : '#a896d6'), color: state.danger ? '#D65C5C' : '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>{state.confirmLabel}</button>
        </div>
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
