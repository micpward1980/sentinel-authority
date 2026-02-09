import React, { useState } from 'react';

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
    success: { bg: 'rgba(92,214,133,.10)', border: 'rgba(92,214,133,.35)', text: '#5CD685', icon: '✓' },
    error:   { bg: 'rgba(214,92,92,.10)',  border: 'rgba(214,92,92,.35)',  text: '#D65C5C', icon: '✗' },
    warning: { bg: 'rgba(214,160,92,.10)', border: 'rgba(214,160,92,.35)', text: '#D6A05C', icon: '⚠' },
    info:    { bg: 'rgba(157,140,207,.10)', border: 'rgba(157,140,207,.35)', text: '#a896d6', icon: 'ℹ' },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '380px' }}>
        {toasts.map(t => {
          const c = palette[t.type] || palette.info;
          return (
            <div key={t.id} style={{
              background: c.bg, backdropFilter: 'blur(12px)',
              border: `1px solid ${c.border}`, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              animation: 'slideIn .25s ease-out',
            }}>
              <span style={{ fontSize: '13px', lineHeight: 1, marginTop: '1px' }}>{c.icon}</span>
              <span style={{ flex: 1, color: c.text, fontSize: '12px', lineHeight: 1.4, fontFamily: "var(--mono)" }}>{t.message}</span>
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
