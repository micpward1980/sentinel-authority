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

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', maxWidth: 'min(400px, 90vw)', width: '100%' }}>
          <h2 style={{ color: 'rgba(255,255,255,.94)', marginBottom: '0.5rem' }}>API Documentation</h2>
          <p style={{ color: '#a896d6', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the docs password to view the API reference.</p>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e)}
              placeholder="Docs password"
              style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,.94)', fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
            <button
              onClick={handleUnlock}
              style={{ width: '100%', padding: '0.75rem', background: '#5B4B8A', border: 'none', color: 'rgba(255,255,255,.94)', fontSize: '1rem', cursor: 'pointer' }}
            >
              Unlock Docs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)' }}>
      <iframe
        src={`${API_URL}/internal-docs`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="API Documentation"
      />
    </div>
  );
}
