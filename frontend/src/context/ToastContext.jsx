import React, { useState } from 'react';
import { styles } from '../config/styles';

const ToastContext = React.createContext();

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = React.useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismiss = React.useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const palette = {
    success: { bg: 'rgba(22,135,62,.08)', border: 'rgba(22,135,62,.25)', text: styles.accentGreen, icon: '✓' },
    error:   { bg: 'rgba(180,52,52,.08)',  border: 'rgba(180,52,52,.25)',  text: styles.accentRed, icon: '✗' },
    warning: { bg: 'rgba(158,110,18,.08)', border: 'rgba(158,110,18,.25)', text: styles.accentAmber, icon: '⚠' },
    info:    { bg: 'rgba(29,26,59,.08)', border: 'rgba(29,26,59,.25)', text: styles.purpleBright, icon: 'ℹ' },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '380px' }}>
        {toasts.map(t => {
          const c = palette[t.type] || palette.info;
          return (
            <div key={t.id} style={{
              background: c.bg, backdropFilter: styles.frostToast,
              border: `1px solid ${c.border}`, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              animation: 'slideIn .25s ease-out',
            }}>
              <span style={{ fontSize: '13px', lineHeight: 1, marginTop: '1px' }}>{c.icon}</span>
              <span style={{ flex: 1, color: c.text, fontSize: '12px', lineHeight: 1.4, fontFamily: styles.mono }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', color: c.text, cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1, opacity: .6 }}>×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return React.useContext(ToastContext); }
export { ToastProvider };
export default ToastContext;
