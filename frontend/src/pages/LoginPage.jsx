import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { api } from '../config/api';

function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '', password: '', full_name: '', organization: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [forgotStep, setForgotStep] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotSending(true);
    setError('');
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setForgotSent(true); // Always show success to prevent email enumeration
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div data-page="login">

      <div id="sa-login">
        <div className="sa-wrap">

          <div className={`sa-card${isRegister ? " register" : ""}`}>

          <div className="sa-brand">
            <Logo height={48} />
          </div>

          <h1 className="sa-title">
            {forgotStep ? <>Reset <em>Password</em></> : twoFAStep ? <>Two-Factor <em>Auth</em></> : isRegister ? <>Create <em>Account</em></> : <>Sign <em>In</em></>}
          </h1>

          <p className="sa-lead">
            {forgotStep
              ? "Enter your email address and we\u2019ll send you a link to reset your password."
              : twoFAStep
              ? 'Enter the 6-digit code from your authenticator app to complete sign-in.'
              : 'Access the ODDC certification portal. Manage applications, certificates, and ENVELO Interlock.'}
          </p>

          {forgotStep ? (
            <div>
              {forgotSent ? (
                <>
                  <p style={{fontSize: '14px', lineHeight: 1.6, color: 'var(--sa-text-2)', marginBottom: '24px'}}>
                    If an account exists for <strong>{forgotEmail}</strong>, a password reset link has been sent. Check your inbox and spam folder.
                  </p>
                  <button className="sa-ghost" onClick={() => {
                    setForgotStep(false); setForgotSent(false); setForgotEmail(''); setError('');
                  }}>{'\u2190'} Back to sign in</button>
                </>
              ) : (
                <>
                  {error && <p className="sa-error">{error}</p>}
                  <form onSubmit={handleForgotPassword}>
                    <div className="sa-field">
                      <label className="sa-field-label">Email Address</label>
                      <input className="sa-input" type="email" placeholder="you@company.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required autoFocus />
                    </div>
                    <button className="sa-submit" type="submit" disabled={forgotSending}>
                      {forgotSending ? 'Sending\u2026' : 'Send Reset Link \u2192'}
                    </button>
                  </form>
                  <button className="sa-ghost" onClick={() => {
                    setForgotStep(false); setForgotEmail(''); setError('');
                  }}>{'\u2190'} Back to sign in</button>
                </>
              )}
            </div>
          ) : twoFAStep ? (
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
            <div>
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
                        value={formData.organization}
                        onChange={e => setFormData({...formData, organization: e.target.value})}
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
                <button className="sa-ghost" onClick={() => {
                  setForgotStep(true); setForgotEmail(formData.email); setError('');
                }}>
                  Forgot password?
                </button>
              )}
            </div>
          )}

          </div>

          <hr className="sa-sep" />
          <div className="sa-footer">
            <a href="https://sentinelauthority.org" target="_blank" rel="noreferrer noopener" className="sa-footer-text" style={{textDecoration:"none"}}>← Public Site</a>
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
