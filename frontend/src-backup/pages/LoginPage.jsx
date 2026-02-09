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

  return (
    <div data-page="login">
      {/* 
        Embedded stylesheet — scoped via #sa-login ID.
        This uses the EXACT same CSS values as sentinelauthority.org
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,200;0,300;0,400;1,200;1,300&family=Inter:wght@200;400;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        #sa-login {
          all: initial;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px 20px;
          margin: 0;
          font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          color: rgba(255,255,255,.94);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background:
            radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,.15), transparent 55%),
            radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,.06), transparent 55%),
            #2a2f3d;
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow-y: auto;
          box-sizing: border-box;
        }

        #sa-login *, #sa-login *::before, #sa-login *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        #sa-login .sa-wrap {
          width: 100%;
          max-width: 600px;
          text-align: center;
        }

        /* ── Typography matching sentinelauthority.org ── */
        #sa-login .sa-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: rgba(255,255,255,.50);
          margin-bottom: 16px;
          display: block;
        }

        #sa-login .sa-title {
          font-family: 'Source Serif 4', Georgia, serif;
          font-size: 52px;
          font-weight: 200;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 16px;
          color: rgba(255,255,255,.94);
        }
        #sa-login .sa-title em {
          color: #9d8ccf;
          font-style: italic;
          font-weight: 200;
        }

        #sa-login .sa-lead {
          font-size: 18px;
          line-height: 1.7;
          color: rgba(255,255,255,.55);
          max-width: 480px;
          margin: 0 auto 48px;
        }

        /* ── Tabs matching website section-toggle style ── */
        #sa-login .sa-tabs {
          display: flex;
          justify-content: center;
          gap: 0;
          border-bottom: 1px solid rgba(255,255,255,.08);
          margin-bottom: 40px;
        }
        #sa-login .sa-tab {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(255,255,255,.35);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 12px 24px;
          cursor: pointer;
          transition: color 0.2s ease, border-color 0.2s ease;
          outline: none;
        }
        #sa-login .sa-tab:hover {
          color: rgba(255,255,255,.60);
        }
        #sa-login .sa-tab.active {
          color: rgba(255,255,255,.94);
          border-bottom-color: #9d8ccf;
        }

        /* ── Form fields matching verify.html input style ── */
        #sa-login .sa-field {
          margin-bottom: 28px;
          text-align: left;
        }
        #sa-login .sa-field-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,.35);
          margin-bottom: 10px;
        }
        #sa-login .sa-input {
          width: 100%;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 16px;
          color: rgba(255,255,255,.94);
          background: rgba(0,0,0,.20);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 16px 20px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }
        #sa-login .sa-input::placeholder {
          color: rgba(255,255,255,.25);
        }
        #sa-login .sa-input:focus {
          border-color: rgba(157,140,207,.50);
          box-shadow: 0 0 20px rgba(157,140,207,.10);
        }

        /* ── Password field wrapper ── */
        #sa-login .sa-pw-wrap {
          position: relative;
        }
        #sa-login .sa-pw-wrap .sa-input {
          padding-right: 48px;
        }
        #sa-login .sa-pw-toggle {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,.35);
          padding: 4px;
          display: flex;
          align-items: center;
          outline: none;
        }
        #sa-login .sa-pw-toggle:hover {
          color: rgba(255,255,255,.55);
        }

        /* ── Primary button matching verify.html green gradient ── */
        #sa-login .sa-submit {
          display: inline-block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #000;
          background: linear-gradient(135deg, rgba(92,214,133,0.9) 0%, rgba(92,214,133,0.6) 100%);
          border: none;
          border-radius: 10px;
          padding: 18px 36px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          margin-top: 8px;
          outline: none;
        }
        #sa-login .sa-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(92,214,133,.30);
        }
        #sa-login .sa-submit:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* ── Ghost link ── */
        #sa-login .sa-ghost {
          display: inline-block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: rgba(255,255,255,.35);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-top: 20px;
          text-decoration: none;
          outline: none;
          transition: color 0.2s ease;
        }
        #sa-login .sa-ghost:hover {
          color: rgba(255,255,255,.60);
        }

        /* ── Separator ── */
        #sa-login .sa-sep {
          border: none;
          border-top: 1px solid rgba(255,255,255,.06);
          margin: 48px 0 20px;
        }

        /* ── Footer ── */
        #sa-login .sa-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        #sa-login .sa-footer-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          color: rgba(255,255,255,.25);
          text-transform: uppercase;
        }
        #sa-login .sa-footer a {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          color: #9d8ccf;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        #sa-login .sa-footer a:hover {
          color: #b8a9e0;
        }

        /* ── Error ── */
        #sa-login .sa-error {
          color: rgba(214,92,92,.95);
          font-size: 13px;
          margin-bottom: 20px;
          text-align: center;
        }

        /* ── 2FA code input ── */
        #sa-login .sa-2fa-input {
          width: 100%;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 28px;
          letter-spacing: 10px;
          text-align: center;
          color: rgba(255,255,255,.94);
          background: rgba(0,0,0,.20);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 20px;
          outline: none;
          transition: border-color 0.2s ease;
          box-sizing: border-box;
          margin-bottom: 28px;
        }
        #sa-login .sa-2fa-input:focus {
          border-color: rgba(157,140,207,.50);
          box-shadow: 0 0 20px rgba(157,140,207,.10);
        }
      `}} />

      <div id="sa-login">
        <div className="sa-wrap">

          {/* Kicker label */}
          <span className="sa-label">Sentinel Authority</span>

          {/* Title — matches verify page section-title */}
          <h1 className="sa-title">
            {twoFAStep ? <>Two-Factor <em>Auth</em></> : <>Sign <em>In</em></>}
          </h1>

          {/* Lead text — matches verify page section-lead */}
          <p className="sa-lead">
            {twoFAStep
              ? 'Enter the 6-digit code from your authenticator app to complete sign-in.'
              : 'Access the ODDC certification portal. Manage applications, certificates, and ENVELO Interlock.'}
          </p>

          {twoFAStep ? (
            /* ── 2FA FORM ── */
            <div>
              {error && <p className="sa-error">{error}</p>}
              <form onSubmit={handle2FASubmit}>
                <input
                  className="sa-2fa-input"
                  type="text"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
                <button className="sa-submit" type="submit"
                  disabled={verifying2FA || totpCode.length !== 6}>
                  {verifying2FA ? 'Verifying\u2026' : 'Verify \u2192'}
                </button>
              </form>
              <button className="sa-ghost" onClick={() => {
                setTwoFAStep(false); setTotpCode(''); setError('');
              }}>{'\u2190'} Back to sign in</button>
            </div>
          ) : (
            /* ── MAIN LOGIN/REGISTER ── */
            <div>
              {/* Tabs */}
              <div className="sa-tabs">
                <button className={`sa-tab ${!isRegister ? 'active' : ''}`}
                  onClick={() => { setIsRegister(false); setError(''); }} type="button">
                  Sign In
                </button>
                <button className={`sa-tab ${isRegister ? 'active' : ''}`}
                  onClick={() => { setIsRegister(true); setError(''); }} type="button">
                  Register
                </button>
              </div>

              {error && <p className="sa-error">{error}</p>}

              <form onSubmit={handleSubmit}>
                {isRegister && (
                  <>
                    <div className="sa-field">
                      <label className="sa-field-label">Full Name</label>
                      <input className="sa-input" type="text" placeholder="Jane Smith"
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        required />
                    </div>
                    <div className="sa-field">
                      <label className="sa-field-label">Organization</label>
                      <input className="sa-input" type="text" placeholder="Acme Robotics Inc."
                        value={formData.organization_name}
                        onChange={e => setFormData({...formData, organization_name: e.target.value})}
                        required />
                    </div>
                  </>
                )}

                <div className="sa-field">
                  <label className="sa-field-label">Email Address</label>
                  <input className="sa-input" type="email" placeholder="you@company.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required />
                </div>

                <div className="sa-field">
                  <label className="sa-field-label">Password</label>
                  <div className="sa-pw-wrap">
                    <input className="sa-input" type={showPassword ? 'text' : 'password'}
                      placeholder={'\u2022'.repeat(12)}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required />
                    <button className="sa-pw-toggle" type="button"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button className="sa-submit" type="submit">
                  {isRegister ? 'Create Account \u2192' : 'Sign In \u2192'}
                </button>
              </form>

              {!isRegister && (
                <button className="sa-ghost" onClick={() => {}}>
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {/* Separator + footer */}
          <hr className="sa-sep" />
          <div className="sa-footer">
            <span className="sa-footer-text">Protected by ENVELO</span>
            <div style={{ display: 'flex', gap: '16px' }}>
              <a href="https://sentinelauthority.org/privacy.html">Privacy</a>
              <a href="https://sentinelauthority.org/terms.html">Terms</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;
