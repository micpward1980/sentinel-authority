import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '', password: '', full_name: '', organization_name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(formData);
      } else {
        await login(formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.detail === '2FA_REQUIRED') {
        setTwoFAStep(true);
      } else {
        setError(err.response?.data?.detail || 'Authentication failed');
      }
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setVerifying2FA(true);
    setError('');
    try {
      await login(formData.email, formData.password, totpCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code');
    } finally {
      setVerifying2FA(false);
    }
  };

  const mono = "Consolas, 'IBM Plex Mono', monospace";
  const serif = "Georgia, 'Source Serif 4', serif";
  const tp = 'rgba(255,255,255,.94)';
  const ts = 'rgba(255,255,255,.78)';
  const tt = 'rgba(255,255,255,.50)';
  const purple = '#a896d6';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "Calibri, 'Inter', system-ui, sans-serif", color: tp,
      background: 'radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,.10), transparent 55%), radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,.04), transparent 55%), #2a2f3d',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)',
        backgroundSize: '120px 120px', opacity: .25,
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.2) 85%, rgba(0,0,0,.4) 100%)',
      }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '16px' }}>Sentinel Authority</div>
        <h1 style={{ fontFamily: serif, fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 12px', color: tp }}>
          {twoFAStep ? <>Two-Factor <span style={{ color: purple, fontStyle: 'italic' }}>Auth</span></> : <>Sign <span style={{ color: purple, fontStyle: 'italic' }}>In</span></>}
        </h1>
        <p style={{ color: ts, fontWeight: 200, lineHeight: 1.75, fontSize: '15px', margin: '0 0 48px', maxWidth: '50ch' }}>
          {twoFAStep ? 'Enter the 6-digit code from your authenticator app.' : 'Access the ODDC certification platform. Manage applications, certificates, and ENVELO Interlock.'}
        </p>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginBottom: '40px' }} />

        {twoFAStep ? (
          <div>
            {error && <p style={{ color: 'rgba(214,92,92,.95)', fontFamily: mono, fontSize: '11px', letterSpacing: '1px', marginBottom: '24px' }}>{error}</p>}
            <form onSubmit={handle2FASubmit}>
              <div style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Verification Code</div>
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '28px', letterSpacing: '10px', textAlign: 'center', padding: '16px 0', outline: 'none', marginBottom: '32px' }} />
              <button type="submit" className="btn primary" disabled={verifying2FA || totpCode.length !== 6} style={{ width: '100%', justifyContent: 'center' }}>
                {verifying2FA ? 'Verifying\u2026' : 'Verify \u2192'}
              </button>
            </form>
            <button onClick={() => { setTwoFAStep(false); setTotpCode(''); setError(''); }}
              style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: purple, background: 'none', border: 'none', cursor: 'pointer', marginTop: '20px', padding: 0 }}>
              {'\u2190'} Back to sign in
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.04)', marginBottom: '36px' }}>
              <button onClick={() => { setIsRegister(false); setError(''); }} type="button"
                style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: !isRegister ? tp : tt, background: 'none', border: 'none', borderBottom: !isRegister ? '1px solid ' + purple : '1px solid transparent', padding: '10px 20px 10px 0', cursor: 'pointer' }}>Sign In</button>
              <button onClick={() => { setIsRegister(true); setError(''); }} type="button"
                style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: isRegister ? tp : tt, background: 'none', border: 'none', borderBottom: isRegister ? '1px solid ' + purple : '1px solid transparent', padding: '10px 20px', cursor: 'pointer' }}>Register</button>
            </div>
            {error && <p style={{ color: 'rgba(214,92,92,.95)', fontFamily: mono, fontSize: '11px', letterSpacing: '1px', marginBottom: '24px' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
              {isRegister && (<>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Full Name</label>
                  <input type="text" placeholder="Jane Smith" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required
                    style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '14px', padding: '10px 0', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Organization</label>
                  <input type="text" placeholder="Acme Robotics Inc." value={formData.organization_name} onChange={e => setFormData({...formData, organization_name: e.target.value})} required
                    style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '14px', padding: '10px 0', outline: 'none' }} />
                </div>
              </>)}
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Email Address</label>
                <input type="email" placeholder="you@company.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '14px', padding: '10px 0', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '36px' }}>
                <label style={{ display: 'block', fontFamily: mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tt, marginBottom: '12px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} placeholder={'\u2022'.repeat(12)} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required
                    style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: tp, fontFamily: mono, fontSize: '14px', padding: '10px 0', paddingRight: '40px', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tt, padding: '4px' }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
                {isRegister ? 'Create Account \u2192' : 'Sign In \u2192'}
              </button>
            </form>
            {!isRegister && (
              <button onClick={() => {}} style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: purple, background: 'none', border: 'none', cursor: 'pointer', marginTop: '20px', padding: 0 }}>Forgot password?</button>
            )}
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '48px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', color: tt, textTransform: 'uppercase' }}>Powered by ENVELO Interlock</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://sentinelauthority.org" style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "1.5px", color: purple }}>Main Site</a>
            <a href="https://sentinelauthority.org/privacy.html" style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', color: purple }}>Privacy</a>
            <a href="https://sentinelauthority.org/terms.html" style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1.5px', color: purple }}>Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
