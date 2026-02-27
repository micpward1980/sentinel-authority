import { styles } from '../config/styles';
import SectionHeader from '../components/SectionHeader';
import { useState } from 'react';
import { API_URL } from '../config/api';

const DOCS_PASSWORD = import.meta.env.VITE_DOCS_PASSWORD || 'goldenticket';

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
        <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '2rem', maxWidth: 'min(400px, 90vw)', width: '100%', borderRadius: 8 }}>
          <h2 style={{ fontFamily: styles.serif, color: styles.textPrimary, marginBottom: '0.5rem', fontWeight: 200 }}>API Documentation</h2>
          <p style={{ color: styles.purpleBright, marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the docs password to view the API reference.</p>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e)}
              placeholder="Docs password"
              style={{ width: '100%', padding: '0.75rem', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: 6 }}
            />
            {error && <p style={{ color: styles.accentRed, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
            <button
              onClick={handleUnlock}
              style={{ width: '100%', padding: '0.75rem 0', background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontSize: '1rem', fontFamily: styles.mono, cursor: 'pointer' }}
            >
              Unlock Docs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Open in new tab since backend blocks iframes
  window.open(`${API_URL}/internal-docs`, '_blank', 'noreferrer');
  setUnlocked(false);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '2rem', maxWidth: 'min(400px, 90vw)', width: '100%', borderRadius: 8, textAlign: 'center' }}>
        <p style={{ color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>✓ Docs opened in new tab</p>
        <button onClick={() => window.open(`${API_URL}/internal-docs`, '_blank', 'noreferrer')} style={{ marginTop: '1rem', padding: '0.5rem 0', background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          Open Again
        </button>
      </div>
    </div>
  );
}
