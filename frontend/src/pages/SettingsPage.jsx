import React, { useState, useEffect } from 'react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import SectionHeader from '../components/SectionHeader';

function SettingsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '', organization: user?.organization || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new_pw: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [twoFA, setTwoFA] = useState({ enabled: false, loading: true, setup: null, code: '', verifying: false, disablePw: '', disabling: false });

  useEffect(() => {
    api.get('/api/auth/me').then(res => {
      setTwoFA(prev => ({...prev, enabled: res.data.totp_enabled || false, loading: false}));
    }).catch(() => setTwoFA(prev => ({...prev, loading: false})));
  }, []);

  const setup2FA = async () => {
    try {
      const res = await api.post('/api/auth/2fa/setup');
      setTwoFA(prev => ({...prev, setup: res.data}));
    } catch (err) { toast.show('Setup failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const enable2FA = async () => {
    setTwoFA(prev => ({...prev, verifying: true}));
    try {
      const res = await api.post('/api/auth/2fa/enable', { code: twoFA.code });
      toast.show('Two-factor authentication enabled', 'success');
      setTwoFA(prev => ({...prev, enabled: true, setup: null, code: '', verifying: false, backupCodes: res.data.backup_codes || []}));
    } catch (err) {
      toast.show(err.response?.data?.detail || 'Invalid code', 'error');
      setTwoFA(prev => ({...prev, verifying: false}));
    }
  };

  const disable2FA = async () => {
    setTwoFA(prev => ({...prev, disabling: true}));
    try {
      await api.post('/api/auth/2fa/disable', { current_password: twoFA.disablePw });
      toast.show('Two-factor authentication disabled', 'success');
      setTwoFA(prev => ({...prev, enabled: false, disablePw: '', disabling: false}));
    } catch (err) {
      toast.show(err.response?.data?.detail || 'Failed', 'error');
      setTwoFA(prev => ({...prev, disabling: false}));
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await api.put('/api/auth/profile', profileForm);
      toast.show('Profile updated', 'success');
      if (res.data.user) window.location.reload();
    } catch (err) {
      toast.show('Failed to update profile: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (pwForm.current === '' || pwForm.new_pw === '' || pwForm.confirm === '') { setPwError('All fields required'); return; }
    if (pwForm.new_pw !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    if (pwForm.new_pw.length < 8) { setPwError('Min 8 characters'); return; }
    setPwSaving(true);
    try {
      await api.post('/api/auth/change-password', { current_password: pwForm.current, new_password: pwForm.new_pw });
      toast.show('Password changed successfully', 'success');
      setPwForm({ current: '', new_pw: '', confirm: '' });
    } catch (err) { setPwError(err.response?.data?.detail || 'Failed to change password'); }
    setPwSaving(false);
  };

  useEffect(() => {
    api.get('/api/users/email-preferences').then(res => setPrefs(res.data.preferences || {})).catch(() => {
      setPrefs({ application_updates: true, test_notifications: true, certificate_alerts: true, agent_alerts: true, marketing: false });
    });
  }, []);

  const togglePref = (key) => { setPrefs(prev => ({ ...prev, [key]: !prev[key] })); setSaved(false); };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await api.put('/api/users/email-preferences', prefs);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { toast.show('Failed to save: ' + (err.response?.data?.detail || err.message), 'error'); }
    setSaving(false);
  };

  const cats = [
    { key: 'application_updates', label: 'Application Updates', desc: 'Submission confirmations, review status changes, approval notifications' },
    { key: 'test_notifications', label: 'CAT-72 Test Notifications', desc: 'Test scheduled, started, passed, and failed alerts' },
    { key: 'certificate_alerts', label: 'Certificate Alerts', desc: 'Certificate issued, expiry warnings (30-day / 7-day), expiration notices' },
    { key: 'agent_alerts', label: 'ENVELO Interlock Alerts', desc: 'Agent offline warnings, high violation rate, suspension alerts' },
    { key: 'marketing', label: 'Product Updates', desc: 'New features, platform updates, and industry news from Sentinel Authority' },
  ];

  if (!prefs) return <div style={{color: styles.textTertiary, padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center'}}>Loading preferences...</div>;

  const fieldLabel = (text) => (
    <label className="hud-label" style={{display: 'block', marginBottom: '6px'}}>{text}</label>
  );

  return (
    <div style={{maxWidth: 'min(700px, 95vw)', margin: '0 auto'}}>
      <SectionHeader label="Account" title="Settings" />

      {/* ── Account Information ── */}
      <div style={{paddingTop: '32px'}}>
        <div className="hud-label" style={{marginBottom: '20px'}}>Account Information</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: 'min(400px, 90vw)'}}>
          <div>
            {fieldLabel('Full Name')}
            <input type="text" value={profileForm.full_name} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} />
          </div>
          <div>
            {fieldLabel('Organization')}
            <input type="text" value={profileForm.organization} onChange={e => setProfileForm({...profileForm, organization: e.target.value})} />
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px'}}>
            <div>
              <span className="hud-label">Email</span>
              <div style={{color: styles.textPrimary, marginTop: '6px', fontSize: '13px'}}>{user?.email || '-'}</div>
            </div>
            <div>
              <span className="hud-label">Role</span>
              <div style={{color: styles.purpleBright, marginTop: '6px', fontFamily: 'var(--mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>{user?.role || '-'}</div>
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={profileSaving} className="btn" style={{alignSelf: 'flex-start'}}>
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="hud-scanline" style={{margin: '32px 0'}} />

      {/* ── Change Password ── */}
      <div>
        <div className="hud-label" style={{marginBottom: '20px'}}>Change Password</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: 'min(400px, 90vw)'}}>
          <div>
            {fieldLabel('Current Password')}
            <input type="password" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} />
          </div>
          <div>
            {fieldLabel('New Password')}
            <input type="password" value={pwForm.new_pw} onChange={e => setPwForm({...pwForm, new_pw: e.target.value})} />
          </div>
          <div>
            {fieldLabel('Confirm New Password')}
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} />
          </div>
          {pwError && <div style={{color: 'var(--accent-red)', fontSize: '12px'}}>{pwError}</div>}
          <div style={{fontSize: '11px', color: styles.textTertiary}}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</div>
          <button onClick={handleChangePassword} disabled={pwSaving} className="btn" style={{alignSelf: 'flex-start'}}>
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      <div className="hud-scanline" style={{margin: '32px 0'}} />

      {/* ── Two-Factor Authentication ── */}
      <div>
        <div className="hud-label" style={{marginBottom: '20px'}}>Two-Factor Authentication</div>
        {twoFA.loading ? (
          <div style={{color: styles.textTertiary, fontSize: '13px'}}>Loading...</div>
        ) : twoFA.enabled ? (
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
              <span className="hud-dot hud-dot-green" />
              <span style={{color: 'var(--accent-green)', fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '2px'}}>ENABLED</span>
            </div>
            <p className="hud-desc" style={{marginBottom: '12px'}}>Your account is protected with TOTP two-factor authentication.</p>
            {twoFA.backupCodes && twoFA.backupCodes.length > 0 && (
              <div className="hud-frame hud-frame-amber" style={{marginBottom: '16px'}}>
                <i></i>
                <div className="hud-label" style={{color: 'var(--accent-amber)', marginBottom: '8px'}}>Save Your Backup Codes</div>
                <p className="hud-desc" style={{marginBottom: '12px'}}>Use these if you lose your authenticator. Each code works once.</p>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px'}}>
                  {twoFA.backupCodes.map((code, i) => (
                    <span key={i} style={{fontFamily: 'var(--mono)', fontSize: '13px', color: styles.textPrimary, padding: '4px 8px', textAlign: 'center'}}>{code}</span>
                  ))}
                </div>
                <button onClick={() => {navigator.clipboard.writeText(twoFA.backupCodes.join(String.fromCharCode(10))); toast.show('Backup codes copied');}} className="btn" style={{marginTop: '12px'}}>
                  Copy All
                </button>
              </div>
            )}
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', maxWidth: 'min(400px, 90vw)'}}>
              <input type="password" value={twoFA.disablePw} onChange={e => setTwoFA(prev => ({...prev, disablePw: e.target.value}))} placeholder="Enter password to disable" style={{flex: 1}} />
              <button onClick={disable2FA} disabled={twoFA.disabling} className="btn" style={{color: 'var(--accent-red)', whiteSpace: 'nowrap'}}>
                {twoFA.disabling ? '...' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        ) : twoFA.setup ? (
          <div style={{maxWidth: 'min(400px, 90vw)'}}>
            <p className="hud-desc" style={{marginBottom: '16px'}}>Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password):</p>
            {twoFA.setup.qr_base64 && <div style={{textAlign: 'center', marginBottom: '16px'}}><img src={'data:image/png;base64,' + twoFA.setup.qr_base64} alt="QR Code" style={{width: '200px', height: '200px'}} /></div>}
            <div style={{marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
              <div className="hud-label" style={{marginBottom: '6px'}}>Manual Entry Key</div>
              <div style={{fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--purple-bright)', letterSpacing: '2px', wordBreak: 'break-all'}}>{twoFA.setup.secret}</div>
            </div>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" value={twoFA.code} onChange={e => setTwoFA(prev => ({...prev, code: e.target.value.replace(/\D/g, '').slice(0, 6)}))} placeholder="6-digit code" maxLength={6} style={{flex: 1, fontSize: '18px', letterSpacing: '6px', textAlign: 'center'}} />
              <button onClick={enable2FA} disabled={twoFA.verifying || twoFA.code.length !== 6} className="btn primary">
                {twoFA.verifying ? '...' : 'Verify'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="hud-desc" style={{marginBottom: '16px'}}>Add an extra layer of security by requiring a code from your authenticator app when signing in.</p>
            <button onClick={setup2FA} className="btn primary">Enable 2FA</button>
          </div>
        )}
      </div>

      <div className="hud-scanline" style={{margin: '32px 0'}} />

      {/* ── Email Notifications ── */}
      <div style={{paddingBottom: '40px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px'}}>
          <div className="hud-label">Email Notifications</div>
          <span style={{fontSize: '11px', color: styles.textTertiary}}>from notifications@sentinelauthority.org</span>
        </div>
        <div>
          {cats.map(cat => (
            <div key={cat.key} className="hud-row" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 0'}}>
              <div style={{flex: 1}}>
                <div style={{color: styles.textPrimary, fontSize: '14px', marginBottom: '4px'}}>{cat.label}</div>
                <div style={{color: styles.textTertiary, fontSize: '12px', lineHeight: '1.5'}}>{cat.desc}</div>
              </div>
              <button
                onClick={() => togglePref(cat.key)}
                className="btn"
                style={{
                  padding: '6px 16px',
                  color: prefs[cat.key] ? 'var(--accent-green)' : 'var(--text-tertiary)',
                  borderColor: prefs[cat.key] ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.06)',
                  minWidth: '56px',
                  justifyContent: 'center',
                }}
              >
                {prefs[cat.key] ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)'}}>
          <span style={{fontSize: '11px', color: styles.textTertiary}}>Admin and security emails are always sent.</span>
          <button onClick={savePrefs} disabled={saving} className="btn primary" style={{color: saved ? 'var(--accent-green)' : undefined}}>
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
