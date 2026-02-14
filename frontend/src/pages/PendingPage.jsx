import React from 'react';
import { Clock } from 'lucide-react';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';

function PendingPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', padding: '20px' }}>
      <div style={{ maxWidth: 'min(500px, 90vw)', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(158,110,18,0.08)', border: '2px solid rgba(158,110,18,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Clock fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} style={{ width: '36px', height: '36px', color: styles.accentAmber }} />
        </div>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '12px' }}>APPLICATION UNDER REVIEW</p>
        <h1 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, color: styles.textPrimary || '#e8e6f0', margin: '0 0 16px' }}>Welcome to Sentinel Authority</h1>
        <p style={{ color: styles.textTertiary || styles.textTertiary, fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
          Your account is being reviewed by our team. You will receive full portal access once approved. This typically takes 1-2 business days.
        </p>
        <div style={{ padding: '20px', border: '1px solid ' + (styles.borderGlass || 'rgba(0,0,0,0.03)'), background: 'transparent', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ color: styles.textTertiary || styles.textTertiary, fontSize: '13px', marginBottom: '8px' }}>Registered as:</p>
          <p style={{ color: styles.textPrimary || '#e8e6f0', fontWeight: 500 }}>{user?.full_name}</p>
          <p style={{ color: styles.textTertiary || styles.textTertiary, fontSize: '13px' }}>{user?.email}</p>
        </div>
        <p style={{ color: styles.textTertiary || styles.textTertiary, fontSize: '13px', marginBottom: '24px' }}>
          Questions? Contact <a href="mailto:info@sentinelauthority.org" style={{ color: styles.purpleBright || '#a896d6' }}>info@sentinelauthority.org</a>
        </p>
        <button onClick={logout} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid ' + (styles.borderGlass || 'rgba(0,0,0,0.03)'), color: styles.textTertiary || styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );
}


export default PendingPage;

