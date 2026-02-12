import { useState } from 'react';
import { API_URL } from '../config/api';

const DOCS_PASSWORD = 'goldenticket';

export default function ApiDocsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (password === DOCS_PASSWORD) {
      setUnlocked(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  const mono = "Consolas, 'IBM Plex Mono', monospace";
  const serif = "Georgia, 'Source Serif 4', serif";
  const tp = 'rgba(255,255,255,.94)';
  const tt = 'rgba(255,255,255,.50)';
  const purple = '#a896d6';

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ maxWidth: 'min(420px, 90vw)', width: '100%' }}>
          <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '16px' }}>Documentation</div>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.1, color: tp, margin: '0 0 12px' }}>
            API <span style={{ color: purple, fontStyle: 'italic' }}>Reference</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,.78)', fontWeight: 200, lineHeight: 1.75, fontSize: '15px', margin: '0 0 40px' }}>Enter the documentation password to access the full API reference.</p>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '28px' }}>
            <label style={{ display: 'block', fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e)} placeholder="Enter password"
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '14px', padding: '10px 0', outline: 'none', marginBottom: '28px' }} />
            {error && <p style={{ color: 'rgba(214,92,92,.95)', fontFamily: mono, fontSize: '11px', letterSpacing: '1px', marginBottom: '16px' }}>{error}</p>}
            <button onClick={handleUnlock} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Unlock Docs &rarr;</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)' }}>
      <iframe src={`${API_URL}/internal-docs`} style={{ width: '100%', height: '100%', border: 'none' }} title="API Documentation" />
    </div>
  );
}
