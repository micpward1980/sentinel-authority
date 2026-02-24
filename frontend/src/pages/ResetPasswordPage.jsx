import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';
import { api } from '../config/api';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    api.get(`/api/auth/verify-reset-token/${token}`)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-page="login">
      <div id="sa-login">
        <div className="sa-wrap">
          <div className="sa-card">

            <div className="sa-brand">
              <Logo height={48} />
            </div>

            <h1 className="sa-title">
              {success ? <>Password <em>Reset</em></> : <>New <em>Password</em></>}
            </h1>

            {tokenValid === null ? (
              <p className="sa-lead">Verifying reset link…</p>
            ) : tokenValid === false ? (
              <div>
                <p className="sa-lead">This reset link is invalid or has expired.</p>
                <button className="sa-ghost" onClick={() => navigate('/login')}>
                  {'\u2190'} Back to sign in
                </button>
              </div>
            ) : success ? (
              <div>
                <p className="sa-lead">Your password has been reset successfully.</p>
                <button className="sa-submit" onClick={() => navigate('/login')}>
                  Sign In {'\u2192'}
                </button>
              </div>
            ) : (
              <div>
                {error && <p className="sa-error">{error}</p>}
                <form onSubmit={handleSubmit}>
                  <div className="sa-field">
                    <label className="sa-field-label">New Password</label>
                    <div className="sa-pw-wrap">
                      <input className="sa-input" type={showPassword ? 'text' : 'password'}
                        placeholder={'\u2022'.repeat(12)}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required autoFocus />
                      <button className="sa-pw-toggle" type="button"
                        onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="sa-field">
                    <label className="sa-field-label">Confirm Password</label>
                    <input className="sa-input" type={showPassword ? 'text' : 'password'}
                      placeholder={'\u2022'.repeat(12)}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required />
                  </div>
                  <button className="sa-submit" type="submit" disabled={submitting}>
                    {submitting ? 'Resetting\u2026' : 'Reset Password \u2192'}
                  </button>
                </form>
                <button className="sa-ghost" onClick={() => navigate('/login')}>
                  {'\u2190'} Back to sign in
                </button>
              </div>
            )}

          </div>

          <hr className="sa-sep" />
          <div className="sa-footer">
            <a href="https://sentinelauthority.org" target="_blank" rel="noreferrer noopener" className="sa-footer-text" style={{textDecoration:"none"}}>{'\u2190'} Public Site</a>
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

export default ResetPasswordPage;
