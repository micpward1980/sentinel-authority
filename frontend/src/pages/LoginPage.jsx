import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', organization_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [totpCode, setTotpCode] = useState("");
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
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: styles.bgDeep}}>
      <Link to="/dashboard" style={{
        position: 'fixed', top: '24px', right: '32px', zIndex: 20,
        color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
        transition: 'color 0.2s',
      }}>← Dashboard</Link>
      {/* Animated background gradients */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(91,75,138,0.18) 0%, transparent 65%)',
        animation: 'float1 25s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-15%', width: '800px', height: '800px',
        background: 'radial-gradient(circle, rgba(92,214,133,0.06) 0%, transparent 65%)',
        animation: 'float2 30s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '10%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(157,140,207,0.10) 0%, transparent 65%)',
        animation: 'float3 15s ease-in-out infinite', pointerEvents: 'none',
      }} />
      
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '120px 120px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)',
      }} />

      {/* Decorative lines */}
      <div style={{ position: 'absolute', top: '20%', left: '5%', width: '1px', height: '200px',
        background: 'linear-gradient(to bottom, transparent, rgba(157,140,207,0.3), transparent)',
      }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '8%', width: '150px', height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(92,214,133,0.3), transparent)',
      }} />

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -30px) scale(1.05); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, -40px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 30px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0; } 100% { transform: scale(0.8); opacity: 0.5; } }
        .login-input { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .login-input:focus { border-color: rgba(157,140,207,0.6) !important; box-shadow: 0 0 0 3px rgba(157,140,207,0.1), 0 4px 20px rgba(0,0,0,0.2); transform: translateY(-1px); }
        .login-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(91,75,138,0.5); }
      `}</style>

      <div className="w-full max-w-md relative z-10">
        {/* Brand section */}
        <div className="text-center mb-10">
          {/* Animated brand mark with rings */}
          <div className="relative flex justify-center mb-6" style={{height: '100px', alignItems: 'center'}}>
            <div style={{
              position: 'absolute', width: '80px', height: '80px',
              border: '1px solid rgba(157,140,207,0.2)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', width: '100px', height: '100px',
              border: '1px solid rgba(157,140,207,0.1)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite 0.5s',
            }} />
            <div style={{
              width: '56px', height: '56px',
              background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
              border: '2px solid #9d8ccf', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(91,75,138,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              <div style={{
                width: '18px', height: '18px',
                background: 'radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%)',
                borderRadius: '50%', boxShadow: '0 0 20px rgba(196,184,232,0.5)',
                animation: 'eyePulse 3s ease-in-out infinite',
              }} />
            </div>
          </div>
          
          <h1 style={{
            fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200,
            color: styles.textPrimary, margin: '0 0 8px 0', letterSpacing: '-0.02em',
          }}>
            ODDC <span style={{color: styles.purpleBright, fontStyle: 'italic'}}>Portal</span>
          </h1>
          
          <p style={{
            color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '12px',
          }}>Sentinel Authority</p>

          <a href="https://sentinelauthority.org" style={{
            color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', letterSpacing: '1px', textDecoration: 'none',
            padding: '8px 16px', border: '1px solid rgba(157,140,207,0.2)',
            borderRadius: '20px', marginTop: '16px', display: 'inline-block',
          }}>← VISIT MAIN SITE</a>
        </div>
        
        {/* Login card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset', transition: 'all 0.3s ease', minHeight: '280px',
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px', padding: '4px', marginBottom: '32px',
          }}>
            <button onClick={() => setIsRegister(false)} type="button" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: !isRegister ? styles.purplePrimary : 'transparent',
              color: !isRegister ? '#fff' : styles.textTertiary,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>Sign In</button>
            <button onClick={() => setIsRegister(true)} type="button" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: isRegister ? styles.purplePrimary : 'transparent',
              color: isRegister ? '#fff' : styles.textTertiary,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>Register</button>
          </div>

                  {twoFAStep ? (
          <div style={{textAlign: 'center'}}>
            <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(157,140,207,0.15)', border: '1px solid rgba(157,140,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
              <Shield className="w-6 h-6" style={{color: styles.purpleBright}} />
            </div>
            <h3 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Two-Factor Authentication</h3>
            <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '24px'}}>Enter the 6-digit code from your authenticator app, or a backup code</p>
            {error && <div style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#D65C5C', fontSize: '13px'}}>{error}</div>}
            <form onSubmit={handle2FASubmit}>
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus style={{width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, borderRadius: '10px', padding: '14px', color: styles.textPrimary, fontSize: '24px', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '8px', textAlign: 'center', outline: 'none', marginBottom: '16px', boxSizing: 'border-box'}} />
              <button type="submit" disabled={verifying2FA || totpCode.length !== 6} className="login-btn" style={{width: '100%', padding: '14px', borderRadius: '10px', background: totpCode.length === 6 ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: '1px solid ' + (totpCode.length === 6 ? styles.purpleBright : styles.borderGlass), color: totpCode.length === 6 ? '#fff' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: verifying2FA ? 'wait' : 'pointer'}}>
                {verifying2FA ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
            <button onClick={() => { setTwoFAStep(false); setTotpCode(''); setError(''); }} style={{background: 'none', border: 'none', color: styles.textTertiary, fontSize: '12px', cursor: 'pointer', marginTop: '16px', fontFamily: "'IBM Plex Mono', monospace"}}>Back to login</button>
          </div>
        ) : (<>
{error && (
            <div style={{
              marginBottom: '24px', padding: '14px 16px', borderRadius: '12px',
              background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)',
              color: styles.accentRed, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px',
            }}><span style={{fontSize: '16px'}}>⚠</span>{error}</div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <>
                <div>
                  <label style={{
                    display: 'block', marginBottom: '8px', color: styles.textTertiary,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>Full Name</label>
                  <input type="text" placeholder="Jane Smith" value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="login-input w-full px-4 py-4 rounded-xl outline-none"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                      color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                    }} required />
                </div>
                <div>
                  <label style={{
                    display: 'block', marginBottom: '8px', color: styles.textTertiary,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>Organization</label>
                  <input type="text" placeholder="Acme Robotics Inc." value={formData.organization_name}
                    onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                    className="login-input w-full px-4 py-4 rounded-xl outline-none"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                      color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                    }} required />
                </div>
              </>
            )}
            <div>
              <label style={{
                display: 'block', marginBottom: '8px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>Email Address</label>
              <input type="email" placeholder="you@company.com" value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="login-input w-full px-4 py-4 rounded-xl outline-none"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                }} required />
            </div>
            <div>
              <label style={{
                display: 'block', marginBottom: '8px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>Password</label>
              <div style={{position: "relative"}}><input type={showPassword ? "text" : "password"} placeholder="••••••••••••" value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="login-input w-full px-4 py-4 rounded-xl outline-none"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px'}}>{showPassword ? <EyeOff className="w-5 h-5" style={{color: styles.textTertiary}} /> : <Eye className="w-5 h-5" style={{color: styles.textTertiary}} />}</button>
              </div>
            </div>
            
            <button type="submit" className="login-btn w-full py-4 rounded-xl font-medium"
              style={{
                background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
                border: '1px solid rgba(157,140,207,0.5)', color: '#fff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                marginTop: '8px', boxShadow: '0 4px 20px rgba(91,75,138,0.4)',
              }}>{isRegister ? 'Create Account' : 'Sign In'}</button>
          </form>
        </>)}

          
          {!isRegister && (
            <div className="mt-6 text-center">
              <a href="#" style={{ color: styles.textTertiary, fontSize: '13px', textDecoration: 'none' }}>Forgot password?</a>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <p style={{
            color: styles.textTertiary, fontSize: '11px',
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px',
          }}>
            Protected by ENVELO • <a href="https://sentinelauthority.org/privacy.html" style={{color: styles.purpleBright, textDecoration: 'none'}}>Privacy</a> • <a href="https://sentinelauthority.org/terms.html" style={{color: styles.purpleBright, textDecoration: 'none'}}>Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}



// Dashboard

// Customer Dashboard - simplified view for customers

export default LoginPage;

