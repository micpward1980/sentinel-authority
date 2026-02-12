import React from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function PendingPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2f3d' || '#0d0f14', padding: '20px' }}>
      <div style={{ maxWidth: 'min(500px, 90vw)', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Clock fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} style={{ width: '36px', height: '36px', color: '#f59e0b' }} />
        </div>
        <p style={{ fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#f59e0b', marginBottom: '12px' }}>APPLICATION UNDER REVIEW</p>
        <h1 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, color: 'rgba(255,255,255,.94)' || '#e8e6f0', margin: '0 0 16px' }}>Welcome to Sentinel Authority</h1>
        <p style={{ color: 'rgba(255,255,255,.50)' || '#596270', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
          Your account is being reviewed by our team. You will receive full portal access once approved. This typically takes 1-2 business days.
        </p>
        <div style={{ padding: '20px', border: '1px solid ' + ('rgba(255,255,255,.07)' || 'rgba(255,255,255,0.06)'), background: 'rgba(255,255,255,0.02)', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ color: 'rgba(255,255,255,.50)' || '#596270', fontSize: '13px', marginBottom: '8px' }}>Registered as:</p>
          <p style={{ color: 'rgba(255,255,255,.94)' || '#e8e6f0', fontWeight: 500 }}>{user?.full_name}</p>
          <p style={{ color: 'rgba(255,255,255,.50)' || '#596270', fontSize: '13px' }}>{user?.email}</p>
        </div>
        <p style={{ color: 'rgba(255,255,255,.50)' || '#596270', fontSize: '13px', marginBottom: '24px' }}>
          Questions? Contact <a href="mailto:info@sentinelauthority.org" style={{ color: '#a896d6' || '#a896d6' }}>info@sentinelauthority.org</a>
        </p>
        <button onClick={logout} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid ' + ('rgba(255,255,255,.07)' || 'rgba(255,255,255,0.06)'), color: 'rgba(255,255,255,.50)' || '#596270', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );
}


export default PendingPage;

