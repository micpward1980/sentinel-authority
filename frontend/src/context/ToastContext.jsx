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
  
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast Container */}
      <div style={{position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '420px'}}>
        {toasts.map(t => {
          const colors = {
            success: { bg: 'rgba(92,214,133,0.12)', border: 'rgba(92,214,133,0.4)', text: '#5CD685', icon: '✓' },
            error: { bg: 'rgba(214,92,92,0.12)', border: 'rgba(214,92,92,0.4)', text: '#D65C5C', icon: '✗' },
            warning: { bg: 'rgba(214,160,92,0.12)', border: 'rgba(214,160,92,0.4)', text: '#D6A05C', icon: '⚠' },
            info: { bg: 'rgba(157,140,207,0.12)', border: 'rgba(157,140,207,0.4)', text: '#9D8CCF', icon: 'ℹ' },
          };
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background: c.bg, backdropFilter: 'blur(12px)',
              border: `1px solid ${c.border}`, borderRadius: '10px',
              padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px',
              animation: 'toastSlideIn 0.25s ease-out',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <span style={{fontSize: '14px', lineHeight: '1', marginTop: '1px'}}>{c.icon}</span>
              <span style={{flex: 1, color: c.text, fontSize: '13px', lineHeight: '1.4', fontFamily: "'IBM Plex Mono', monospace"}}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{background: 'none', border: 'none', color: c.text, cursor: 'pointer', fontSize: '14px', padding: '0', lineHeight: '1', opacity: 0.6}}>×</button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastSlideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}


export function useToast() {
  return React.useContext(ToastContext);
}

export { ToastProvider };
export default ToastContext;

