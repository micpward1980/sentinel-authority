import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function SettingsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
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
  const toast = useToast();

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await api.put('/api/auth/profile', profileForm);
      toast.show('Profile updated', 'success');
      // Update local user context
      if (res.data.user) {
        window.location.reload();
      }
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
    { key: 'agent_alerts', label: 'ENVELO Agent Alerts', desc: 'Agent offline warnings, high violation rate, suspension alerts' },
    { key: 'marketing', label: 'Product Updates', desc: 'New features, platform updates, and industry news from Sentinel Authority' },
  ];

  if (!prefs) return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}>Loading preferences...</div>;

  return (
    <div className="space-y-6" style={{maxWidth: '700px', margin: '0 auto'}}>
      <SectionHeader label="Account" title="Settings" />

      <Panel>
        <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Account Information</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px'}}>
          <div>
            <label style={{fontSize: '11px', color: styles.textTertiary, display: 'block', marginBottom: '4px'}}>Full Name</label>
            <input type="text" value={profileForm.full_name} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none sexy-input" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px'}} />
          </div>
          <div>
            <label style={{fontSize: '11px', color: styles.textTertiary, display: 'block', marginBottom: '4px'}}>Organization</label>
            <input type="text" value={profileForm.organization} onChange={e => setProfileForm({...profileForm, organization: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none sexy-input" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px'}} />
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div><span style={{fontSize: '11px', color: styles.textTertiary}}>Email</span><div style={{color: styles.textPrimary, marginTop: '4px', fontSize: '13px'}}>{user?.email || '-'}</div></div>
            <div><span style={{fontSize: '11px', color: styles.textTertiary}}>Role</span><div style={{color: styles.purpleBright, marginTop: '4px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>{user?.role || '-'}</div></div>
          </div>
          <button onClick={handleSaveProfile} disabled={profileSaving} className="sexy-btn" style={{padding: '10px 24px', borderRadius: '10px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: profileSaving ? 'wait' : 'pointer', opacity: profileSaving ? 0.7 : 1, alignSelf: 'flex-start'}}>
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Change Password</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px'}}>
          <div>
            <label style={{fontSize: '11px', color: styles.textTertiary, display: 'block', marginBottom: '4px'}}>Current Password</label>
            <input type="password" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none sexy-input" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px'}} />
          </div>
          <div>
            <label style={{fontSize: '11px', color: styles.textTertiary, display: 'block', marginBottom: '4px'}}>New Password</label>
            <input type="password" value={pwForm.new_pw} onChange={e => setPwForm({...pwForm, new_pw: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none sexy-input" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px'}} />
          </div>
          <div>
            <label style={{fontSize: '11px', color: styles.textTertiary, display: 'block', marginBottom: '4px'}}>Confirm New Password</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none sexy-input" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px'}} />
          </div>
          {pwError && <div style={{color: '#D65C5C', fontSize: '12px'}}>{pwError}</div>}
          <div style={{fontSize: '11px', color: styles.textTertiary}}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</div>
          <button onClick={handleChangePassword} disabled={pwSaving} className="sexy-btn" style={{padding: '10px 24px', borderRadius: '10px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: pwSaving ? 'wait' : 'pointer', opacity: pwSaving ? 0.7 : 1, alignSelf: 'flex-start'}}>
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Two-Factor Authentication</h2>
        {twoFA.loading ? (
          <div style={{color: styles.textTertiary, fontSize: '13px'}}>Loading...</div>
        ) : twoFA.enabled ? (
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
              <div style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen}} />
              <span style={{color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px'}}>ENABLED</span>
            </div>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '12px'}}>Your account is protected with TOTP two-factor authentication.</p>
            {twoFA.backupCodes && twoFA.backupCodes.length > 0 && (
              <div style={{marginBottom: '16px', padding: '16px', background: 'rgba(214,160,92,0.1)', border: '1px solid rgba(214,160,92,0.3)', borderRadius: '8px'}}>
                <p style={{color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', marginBottom: '8px', fontWeight: 600}}>SAVE YOUR BACKUP CODES</p>
                <p style={{color: styles.textSecondary, fontSize: '12px', marginBottom: '12px'}}>Use these if you lose your authenticator. Each code works once.</p>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px'}}>
                  {twoFA.backupCodes.map((code, i) => (
                    <span key={i} style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', textAlign: 'center'}}>{code}</span>
                  ))}
                </div>
                <button onClick={() => {navigator.clipboard.writeText(twoFA.backupCodes.join(String.fromCharCode(10))); toast.show('Backup codes copied');}} style={{marginTop: '12px', padding: '6px 16px', background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', borderRadius: '6px', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase'}}>Copy All</button>
              </div>
            )}
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '400px'}}>
              <input type="password" value={twoFA.disablePw} onChange={e => setTwoFA(prev => ({...prev, disablePw: e.target.value}))} placeholder="Enter password to disable" className="sexy-input" style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '8px 12px', color: styles.textPrimary, fontSize: '13px'}} />
              <button onClick={disable2FA} disabled={twoFA.disabling} style={{padding: '8px 16px', borderRadius: '8px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: twoFA.disabling ? 'wait' : 'pointer', whiteSpace: 'nowrap'}}>
                {twoFA.disabling ? '...' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        ) : twoFA.setup ? (
          <div style={{maxWidth: '400px'}}>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '16px'}}>Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password):</p>
            {twoFA.setup.qr_base64 && <div style={{textAlign: 'center', marginBottom: '16px'}}><img src={'data:image/png;base64,' + twoFA.setup.qr_base64} alt="QR Code" style={{width: '200px', height: '200px', borderRadius: '8px'}} /></div>}
            <div style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '12px', marginBottom: '16px'}}>
              <div style={{fontSize: '10px', color: styles.textTertiary, marginBottom: '4px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Manual Entry Key</div>
              <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '14px', color: styles.purpleBright, letterSpacing: '2px', wordBreak: 'break-all'}}>{twoFA.setup.secret}</div>
            </div>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <input type="text" value={twoFA.code} onChange={e => setTwoFA(prev => ({...prev, code: e.target.value.replace(/\D/g, '').slice(0, 6)}))} placeholder="6-digit code" maxLength={6} className="sexy-input" style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '10px 12px', color: styles.textPrimary, fontSize: '18px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", letterSpacing: '6px', textAlign: 'center'}} />
              <button onClick={enable2FA} disabled={twoFA.verifying || twoFA.code.length !== 6} className="sexy-btn" style={{padding: '10px 20px', borderRadius: '8px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: twoFA.verifying ? 'wait' : 'pointer', opacity: twoFA.code.length !== 6 ? 0.5 : 1}}>
                {twoFA.verifying ? '...' : 'Verify'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '16px'}}>Add an extra layer of security by requiring a code from your authenticator app when signing in.</p>
            <button onClick={setup2FA} className="sexy-btn" style={{padding: '10px 24px', borderRadius: '10px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Enable 2FA
            </button>
          </div>
        )}
      </Panel>

      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Email Notifications</h2>
          <span style={{fontSize: '11px', color: styles.textTertiary}}>from notifications@sentinelauthority.org</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
          {cats.map(cat => (
            <div key={cat.key} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '10px', background: prefs[cat.key] ? 'rgba(92,214,133,0.03)' : 'rgba(255,255,255,0.01)', border: `1px solid ${prefs[cat.key] ? 'rgba(92,214,133,0.1)' : styles.borderGlass}`, transition: 'all 0.2s'}}>
              <div style={{flex: 1}}>
                <div style={{color: styles.textPrimary, fontWeight: 500, fontSize: '14px', marginBottom: '4px'}}>{cat.label}</div>
                <div style={{color: styles.textTertiary, fontSize: '12px', lineHeight: '1.5'}}>{cat.desc}</div>
              </div>
              <button onClick={() => togglePref(cat.key)} style={{width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', background: prefs[cat.key] ? styles.accentGreen : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '16px'}}>
                <div style={{width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: prefs[cat.key] ? '25px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'}} />
              </button>
            </div>
          ))}
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}`}}>
          <span style={{fontSize: '11px', color: styles.textTertiary}}>Admin and security emails are always sent.</span>
          <button onClick={savePrefs} disabled={saving} className="sexy-btn" style={{padding: '10px 24px', borderRadius: '10px', background: saved ? 'rgba(92,214,133,0.15)' : styles.purplePrimary, border: `1px solid ${saved ? 'rgba(92,214,133,0.4)' : styles.purpleBright}`, color: saved ? styles.accentGreen : '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1}}>
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </Panel>
    </div>
  );
}


export default SettingsPage;

