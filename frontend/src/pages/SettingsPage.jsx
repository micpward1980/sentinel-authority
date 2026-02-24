// pages/SettingsPage.jsx — Sentinel Authority v4
// Salesforce Setup pattern: persistent sidebar + scrollable workspace.
// ALL existing functionality preserved: profile, password, 2FA, email prefs.
// New: API Key management panel with click-to-reveal + 30s timer, audit log, RBAC role display.

import React, { useState, useEffect, useRef } from 'react';
import { Settings, User, Key, Shield, Bell, History, ChevronRight,
         Copy, Plus, Trash2, Eye, EyeOff, Info, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

// ── Design tokens ──────────────────────────────────────────────────────────────
const SB_BG     = '#f5f5f7';
const SB_BORDER = '#e2e5ea';
const WS_BG     = '#ffffff';

// ── Role display map ─────────────────────────────────────────────────────────
const ROLE_MAP = {
  admin:    { label: 'System Admin',          color: styles.purplePrimary },
  auditor:  { label: 'Independent Auditor',   color: styles.accentBlue    },
  operator: { label: 'System Operator',       color: styles.accentGreen   },
  user:     { label: 'Certified Operator',    color: styles.accentGreen   },
  customer: { label: 'Certified Operator',    color: styles.accentGreen   },
  viewer:   { label: 'Read-Only Viewer',      color: styles.textTertiary  },
};

function RoleBadge({ role }) {
  const cfg = ROLE_MAP[(role||'').toLowerCase()] || { label: role || 'User', color: styles.textTertiary };
  return (
    <span style={{
      fontFamily: styles.mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
      padding: '3px 10px', borderRadius: '3px',
      border: `1px solid ${cfg.color}`, color: cfg.color,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  );
}

// ── SLDS-style input ──────────────────────────────────────────────────────────
function SLDSInput({ label, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary }}>
          {label}
        </label>
      )}
      <input
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        style={{
          padding: '9px 12px',
          border: `1px solid ${focused ? styles.purpleBright : styles.borderGlass}`,
          borderRadius: '3px',
          background: 'rgba(255,255,255,0.9)',
          color: styles.textPrimary,
          fontFamily: props.type === 'text' && props.readOnly ? styles.mono : styles.sans,
          fontSize: '13px',
          outline: 'none',
          boxShadow: focused ? `0 0 0 3px rgba(107,90,158,0.12)` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          width: '100%',
          boxSizing: 'border-box',
          ...props.style,
        }}
      />
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
function WsTitle({ title, description }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: styles.serif, fontSize: 22, fontWeight: 300, margin: '0 0 6px', color: styles.purpleAccent }}>{title}</h2>
      {description && <p style={{ color: styles.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{description}</p>}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function WsCard({ children, style: s = {} }) {
  return (
    <div style={{
      background: styles.cardSurface,
      border: `1px solid ${styles.borderSubtle}`,
      borderRadius: 4,
      padding: '20px 20px',
      marginBottom: 16,
      ...s,
    }}>
      {children}
    </div>
  );
}

function CardHeading({ children }) {
  return (
    <div style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, saving, saved, label = 'Save Changes' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: '9px 22px', background: 'transparent', border: 'none',
        borderBottom: `1px solid ${saved ? styles.accentGreen : styles.purpleBright}`,
        color: saved ? styles.accentGreen : styles.purpleBright,
        fontFamily: styles.mono, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase',
        cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
      }}
    >
      {saved ? '✓ Saved' : saving ? 'Saving…' : label}
    </button>
  );
}

// ── PANEL: Profile ─────────────────────────────────────────────────────────────
function ProfilePanel({ user, toast }) {
  const [form, setForm]     = useState({ full_name: user?.full_name || '', organization: user?.organization || '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/auth/profile', form);
      toast.show('Profile updated', 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
    setSaving(false);
  };

  return (
    <>
      <WsTitle title="My Profile" description="Update your display name and organization affiliation." />
      <WsCard>
        <CardHeading>Account Information</CardHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 520 }}>
          <SLDSInput label="Full Name"    value={form.full_name}    onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <SLDSInput label="Organization" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} />
          <div>
            <div style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: 5 }}>Email</div>
            <div style={{ fontSize: 13, color: styles.textPrimary }}>{user?.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: 5 }}>Role</div>
            <RoleBadge role={user?.role} />
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <SaveBtn onClick={save} saving={saving} label="Save Profile" />
        </div>
      </WsCard>

      <PasswordCard toast={toast} />
      <TwoFACard toast={toast} user={user} />
    </>
  );
}

// ── PANEL: Password ────────────────────────────────────────────────────────────
function PasswordCard({ toast }) {
  const [form, setForm]   = useState({ current: '', new_pw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  const save = async () => {
    setError('');
    if (!form.current || !form.new_pw || !form.confirm) { setError('All fields required'); return; }
    if (form.new_pw !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.new_pw.length < 8)       { setError('Minimum 8 characters'); return; }
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', { current_password: form.current, new_password: form.new_pw });
      toast.show('Password changed', 'success');
      setForm({ current: '', new_pw: '', confirm: '' });
    } catch (e) { setError(e.response?.data?.detail || 'Failed to change password'); }
    setSaving(false);
  };

  return (
    <WsCard>
      <CardHeading>Change Password</CardHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
        <SLDSInput label="Current Password" type="password" value={form.current}  onChange={e => setForm({ ...form, current: e.target.value })} />
        <SLDSInput label="New Password"     type="password" value={form.new_pw}   onChange={e => setForm({ ...form, new_pw: e.target.value })} />
        <SLDSInput label="Confirm New"      type="password" value={form.confirm}  onChange={e => setForm({ ...form, confirm: e.target.value })} />
        {error && <div style={{ color: styles.accentRed, fontSize: 12 }}>{error}</div>}
        <div style={{ fontSize: 11, color: styles.textTertiary }}>Min 8 chars · 1 uppercase · 1 lowercase · 1 number</div>
        <div><SaveBtn onClick={save} saving={saving} label="Change Password" /></div>
      </div>
    </WsCard>
  );
}

// ── PANEL: 2FA ─────────────────────────────────────────────────────────────────
function TwoFACard({ toast, user }) {
  const [twoFA, setTwoFA] = useState({ enabled: false, loading: true, setup: null, code: '', verifying: false, disablePw: '', disabling: false, backupCodes: [] });

  useEffect(() => {
    api.get('/api/auth/me')
      .then(r => setTwoFA(p => ({ ...p, enabled: r.data.totp_enabled || false, loading: false })))
      .catch(() => setTwoFA(p => ({ ...p, loading: false })));
  }, []);

  const setup2FA   = async () => {
    try { const r = await api.post('/api/auth/2fa/setup'); setTwoFA(p => ({ ...p, setup: r.data })); }
    catch (e) { toast.show('Setup failed: ' + (e.response?.data?.detail || e.message), 'error'); }
  };
  const enable2FA  = async () => {
    setTwoFA(p => ({ ...p, verifying: true }));
    try {
      const r = await api.post('/api/auth/2fa/enable', { code: twoFA.code });
      toast.show('Two-factor authentication enabled', 'success');
      setTwoFA(p => ({ ...p, enabled: true, setup: null, code: '', verifying: false, backupCodes: r.data.backup_codes || [] }));
    } catch (e) { toast.show(e.response?.data?.detail || 'Invalid code', 'error'); setTwoFA(p => ({ ...p, verifying: false })); }
  };
  const disable2FA = async () => {
    setTwoFA(p => ({ ...p, disabling: true }));
    try {
      await api.post('/api/auth/2fa/disable', { current_password: twoFA.disablePw });
      toast.show('Two-factor authentication disabled', 'success');
      setTwoFA(p => ({ ...p, enabled: false, disablePw: '', disabling: false }));
    } catch (e) { toast.show(e.response?.data?.detail || 'Failed', 'error'); setTwoFA(p => ({ ...p, disabling: false })); }
  };

  return (
    <WsCard>
      <CardHeading>Two-Factor Authentication</CardHeading>
      {twoFA.loading ? (
        <div style={{ color: styles.textTertiary, fontSize: 13 }}>Loading…</div>
      ) : twoFA.enabled ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: styles.accentGreen }} />
            <span style={{ color: styles.accentGreen, fontFamily: styles.mono, fontSize: 12, letterSpacing: '1px' }}>ENABLED</span>
          </div>
          <p style={{ color: styles.textSecondary, fontSize: 13, marginBottom: 14 }}>Your account is protected with TOTP authentication.</p>
          {twoFA.backupCodes?.length > 0 && (
            <div style={{ marginBottom: 16, padding: 16, background: 'rgba(158,110,18,0.04)', border: `1px solid rgba(158,110,18,0.18)`, borderRadius: 4 }}>
              <p style={{ color: styles.accentAmber, fontFamily: styles.mono, fontSize: 10, letterSpacing: '1.5px', marginBottom: 8, textTransform: 'uppercase' }}>Save Your Backup Codes</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, marginBottom: 10 }}>
                {twoFA.backupCodes.map((c, i) => <span key={i} style={{ fontFamily: styles.mono, fontSize: 13, color: styles.textPrimary, textAlign: 'center', padding: '2px 0' }}>{c}</span>)}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(twoFA.backupCodes.join('\n')); toast.show('Backup codes copied'); }}
                style={{ padding: '5px 14px', background: 'transparent', border: `1px solid rgba(158,110,18,0.3)`, color: styles.accentAmber, fontFamily: styles.mono, fontSize: 10, cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase', borderRadius: 3 }}>
                Copy All
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 380 }}>
            <SLDSInput type="password" value={twoFA.disablePw} onChange={e => setTwoFA(p => ({ ...p, disablePw: e.target.value }))} placeholder="Enter password to disable" style={{ flex: 1 }} />
            <button onClick={disable2FA} disabled={twoFA.disabling}
              style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${styles.accentRed}`, color: styles.accentRed, fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3, flexShrink: 0 }}>
              {twoFA.disabling ? '…' : 'Disable'}
            </button>
          </div>
        </div>
      ) : twoFA.setup ? (
        <div style={{ maxWidth: 380 }}>
          <p style={{ color: styles.textSecondary, fontSize: 13, marginBottom: 14 }}>Scan this QR code with your authenticator app:</p>
          {twoFA.setup.qr_base64 && <div style={{ textAlign: 'center', marginBottom: 14 }}><img src={'data:image/png;base64,' + twoFA.setup.qr_base64} alt="2FA QR" style={{ width: 180, height: 180 }} /></div>}
          <div style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: 12, marginBottom: 14, borderRadius: 3 }}>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>Manual Entry Key</div>
            <div style={{ fontFamily: styles.mono, fontSize: 13, color: styles.purpleBright, letterSpacing: '2px', wordBreak: 'break-all' }}>{twoFA.setup.secret}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" value={twoFA.code} onChange={e => setTwoFA(p => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              placeholder="6-digit code" maxLength={6}
              style={{ flex: 1, background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '10px 12px', color: styles.textPrimary, fontSize: 20, fontFamily: styles.mono, letterSpacing: '8px', textAlign: 'center', borderRadius: 3, outline: 'none' }} />
            <button onClick={enable2FA} disabled={twoFA.verifying || twoFA.code.length !== 6}
              style={{ padding: '10px 18px', background: twoFA.code.length === 6 ? styles.purplePrimary : 'transparent', border: `1px solid ${styles.purpleBright}`, color: twoFA.code.length === 6 ? '#fff' : styles.purpleBright, fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3, opacity: twoFA.code.length !== 6 ? 0.5 : 1 }}>
              {twoFA.verifying ? '…' : 'Verify'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ color: styles.textSecondary, fontSize: 13, marginBottom: 14 }}>Require a TOTP code from your authenticator app on every sign-in.</p>
          <button onClick={setup2FA} style={{ padding: '9px 20px', background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
            Enable 2FA
          </button>
        </div>
      )}
    </WsCard>
  );
}

// ── PANEL: API Keys ─────────────────────────────────────────────────────────────
const REVEAL_SECS = 30;

function ApiKeyRow({ k, onDelete, toast }) {
  const [revealed, setRevealed] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0);
  const timerRef = useRef(null);

  const reveal = () => {
    setRevealed(true);
    setSecsLeft(REVEAL_SECS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); setRevealed(false); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const copy = () => {
    navigator.clipboard.writeText(k.key_prefix + '…(hidden)');
    toast.show('Key prefix copied', 'success');
  };

  return (
    <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
      <td style={{ padding: '13px 14px', fontSize: 13, color: styles.textPrimary, fontWeight: 500 }}>
        {k.name || 'API Key'}
      </td>
      <td style={{ padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: styles.mono, fontSize: 12, color: styles.textPrimary }}>
            {revealed ? (k.key_full || k.key_prefix + '••••••••••••') : (k.key_prefix + '••••••••••••')}
          </span>
          <button onClick={reveal} title={revealed ? `Auto-hides in ${secsLeft}s` : 'Reveal for 30s'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: styles.textDim, lineHeight: 0, padding: 0 }}>
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {revealed && <span style={{ fontFamily: styles.mono, fontSize: 9, color: styles.accentAmber }}>{secsLeft}s</span>}
        </div>
      </td>
      <td style={{ padding: '13px 14px' }}>
        <span style={{ fontFamily: styles.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1px', padding: '3px 8px', borderRadius: 3, background: 'rgba(22,135,62,0.08)', color: styles.accentGreen, border: `1px solid rgba(22,135,62,0.20)` }}>
          ACTIVE
        </span>
      </td>
      <td style={{ padding: '13px 14px', color: styles.textTertiary, fontSize: 12, fontFamily: styles.mono }}>
        {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '—'}
      </td>
      <td style={{ padding: '13px 14px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={copy} title="Copy prefix" style={{ background: 'none', border: `1px solid ${styles.borderGlass}`, borderRadius: 3, cursor: 'pointer', padding: '4px 8px', color: styles.textTertiary }}>
            <Copy size={12} />
          </button>
          <button onClick={() => onDelete(k)} title="Revoke key" style={{ background: 'none', border: `1px solid rgba(180,52,52,0.25)`, borderRadius: 3, cursor: 'pointer', padding: '4px 8px', color: styles.accentRed }}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function APIKeysPanel({ toast }) {
  const confirm = useConfirm();
  const [keys, setKeys]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/api/apikeys/').then(r => setKeys(r.data || [])).catch(() => setKeys([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/apikeys/', { name: newName.trim() });
      toast.show('API key created', 'success');
      setNewName(''); setShowForm(false); load();
    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
    setCreating(false);
  };

  const deleteKey = async (k) => {
    if (!await confirm({ title: 'Revoke API Key', message: `Permanently revoke "${k.name || 'this key'}"? Any systems using it will lose access immediately.`, danger: true, confirmLabel: 'Revoke' })) return;
    try {
      await api.delete('/api/apikeys/' + k.id);
      toast.show('Key revoked', 'success'); load();
    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
  };

  return (
    <>
      <WsTitle title="API Access Keys" description="Programmatic access to the Sentinel Conformance Registry. Keys authenticate the ENVELO Interlock and automated regulatory integrations." />

      {/* Security advisory */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'rgba(29,26,59,0.04)', border: `1px solid rgba(29,26,59,0.18)`, borderRadius: 4, marginBottom: 20 }}>
        <Info size={18} color={styles.purplePrimary} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: styles.purpleAccent, lineHeight: 1.6 }}>
          <strong>Security Advisory:</strong> API keys grant full access to the Conformance Registry on behalf of your account. Never embed keys in client-side code or public repositories. Tokens are shown once — store them immediately.
        </div>
      </div>

      <WsCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <CardHeading>Active Keys</CardHeading>
          <button onClick={() => setShowForm(f => !f)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: styles.purplePrimary, border: 'none', color: '#fff', fontFamily: styles.mono, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3 }}>
            <Plus size={12} /> Generate Key
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 440 }}>
            <SLDSInput placeholder="Key label (e.g. prod_auditor)" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()} style={{ flex: 1 }} />
            <button onClick={create} disabled={creating || !newName.trim()}
              style={{ padding: '9px 16px', background: styles.purplePrimary, border: 'none', color: '#fff', fontFamily: styles.mono, fontSize: 10, cursor: 'pointer', borderRadius: 3, flexShrink: 0, letterSpacing: '1px', textTransform: 'uppercase', opacity: !newName.trim() ? 0.5 : 1 }}>
              {creating ? '…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 12px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.textTertiary, cursor: 'pointer', borderRadius: 3, fontFamily: styles.mono, fontSize: 11 }}>
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: styles.textTertiary, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
          </div>
        ) : keys.length === 0 ? (
          <div style={{ color: styles.textTertiary, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
            No API keys. Generate one to begin programmatic access.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
                  {['Key Label', 'Token', 'Status', 'Last Used', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === '' ? 'right' : 'left', fontFamily: styles.mono, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(k => <ApiKeyRow key={k.id} k={k} onDelete={deleteKey} toast={toast} />)}
              </tbody>
            </table>
          </div>
        )}
      </WsCard>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── PANEL: Notifications ───────────────────────────────────────────────────────
function NotificationsPanel({ toast }) {
  const [prefs, setPrefs]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const cats = [
    { key: 'application_updates',  label: 'Application Updates',      desc: 'Submission confirmations, review status changes, approval notifications' },
    { key: 'test_notifications',   label: 'CAT-72 Test Notifications', desc: 'Test scheduled, started, passed, and failed alerts' },
    { key: 'certificate_alerts',   label: 'Certificate Alerts',        desc: 'Certificate issued, expiry warnings (30-day / 7-day), expiration notices' },
    { key: 'agent_alerts',         label: 'ENVELO Interlock Alerts',   desc: 'Agent offline warnings, high violation rate, suspension alerts' },
    { key: 'marketing',            label: 'Product Updates',           desc: 'New features, platform updates, and industry news from Sentinel Authority' },
  ];

  useEffect(() => {
    api.get('/api/users/email-preferences')
      .then(r => setPrefs(r.data.preferences || {}))
      .catch(() => setPrefs({ application_updates: true, test_notifications: true, certificate_alerts: true, agent_alerts: true, marketing: false }));
  }, []);

  const toggle = (k) => { setPrefs(p => ({ ...p, [k]: !p[k] })); setSaved(false); };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/users/email-preferences', prefs);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
    setSaving(false);
  };

  if (!prefs) return <div style={{ color: styles.textTertiary, padding: 40, textAlign: 'center' }}>Loading preferences…</div>;

  return (
    <>
      <WsTitle title="Email Notifications" description="Control which system events generate email alerts from notifications@sentinelauthority.org." />
      <WsCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cats.map(cat => (
            <div key={cat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 12px', background: prefs[cat.key] ? 'rgba(22,135,62,0.03)' : 'transparent', border: `1px solid ${prefs[cat.key] ? 'rgba(22,135,62,0.10)' : styles.borderGlass}`, borderRadius: 3, marginBottom: 4, transition: 'all 0.2s' }}>
              <div>
                <div style={{ color: styles.textPrimary, fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{cat.label}</div>
                <div style={{ color: styles.textTertiary, fontSize: 12, lineHeight: 1.5 }}>{cat.desc}</div>
              </div>
              <button onClick={() => toggle(cat.key)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: prefs[cat.key] ? styles.accentGreen : 'rgba(0,0,0,0.07)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: prefs[cat.key] ? 23 : 3, transition: 'left 0.2s' }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${styles.borderGlass}`, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 11, color: styles.textTertiary }}>Admin and security emails are always sent regardless of these settings.</span>
          <SaveBtn onClick={save} saving={saving} saved={saved} />
        </div>
      </WsCard>
    </>
  );
}

// ── PANEL: Security Audit Log ─────────────────────────────────────────────────
function AuditLogPanel({ toast }) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/audit-log').then(r => setEvents(r.data.events || r.data || [])).catch(() => setEvents([])).finally(() => setLoading(false));
  }, []);

  const EVENT_COLOR = { login: styles.accentGreen, logout: styles.textTertiary, password_change: styles.accentAmber, key_created: styles.purpleBright, key_revoked: styles.accentRed, '2fa_enabled': styles.accentGreen, '2fa_disabled': styles.accentRed };

  return (
    <>
      <WsTitle title="Security Audit Log" description="Immutable record of security-relevant account events. All entries are hash-chained and tamper-evident." />
      <WsCard>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: styles.textTertiary }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: styles.textTertiary, fontSize: 13 }}>
            No security events recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
                  {['Timestamp', 'Event', 'IP Address', 'Details'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontFamily: styles.mono, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
                    <td style={{ padding: '11px 14px', fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary }}>
                      {ev.created_at ? new Date(ev.created_at).toISOString().replace('T', ' ').substring(0, 16) + 'Z' : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontFamily: styles.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: EVENT_COLOR[ev.event_type] || styles.textSecondary }}>
                        {(ev.event_type || 'EVENT').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary }}>{ev.ip_address || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: styles.textSecondary }}>{ev.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WsCard>
    </>
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ id, label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', border: 'none', cursor: 'pointer', textAlign: 'left',
        background:  active ? WS_BG : 'transparent',
        color:       active ? styles.purplePrimary : styles.textSecondary,
        borderLeft:  `3px solid ${active ? styles.purplePrimary : 'transparent'}`,
        fontWeight:  active ? 600 : 400,
        fontSize:    13,
        fontFamily:  styles.sans,
        transition:  'background 0.12s, color 0.12s',
        boxSizing:   'border-box',
      }}
    >
      <span style={{ flexShrink: 0, lineHeight: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{ fontFamily: styles.mono, fontSize: 9, background: styles.purpleBright, color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{badge}</span>
      )}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
function SettingsPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const [active, setActive] = useState('profile');
  const [winW, setWinW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  React.useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = winW < 768;

  const NAV = [
    { group: 'Personal',     items: [
      { id: 'profile',       label: 'My Profile',         icon: <User size={15} />    },
      { id: 'notifications', label: 'Notifications',      icon: <Bell size={15} />    },
    ]},
    { group: 'Security',     items: [
      { id: 'apikeys',       label: 'API Access Keys',    icon: <Key size={15} />     },
      { id: 'audit',         label: 'Security Audit Log', icon: <History size={15} /> },
    ]},
  ];

  const allNavItems = NAV.flatMap(g => g.items);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>Account</p>
        <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>Settings</h1>
        <p style={{ color: styles.textSecondary, marginTop: 4, fontSize: 14, margin: '4px 0 0' }}>Account, security, and notification preferences</p>
      </div>

      {isMobile ? (
        /* ── Mobile: horizontal tab strip + full-width workspace ── */
        <>
          <div style={{
            display: 'flex', gap: '2px', overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            marginBottom: 16, paddingBottom: 2,
            borderBottom: `1px solid ${SB_BORDER}`,
          }}>
            {allNavItems.map(item => (
              <button key={item.id} onClick={() => setActive(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', border: 'none', cursor: 'pointer',
                background: active === item.id ? WS_BG : 'transparent',
                borderBottom: `2px solid ${active === item.id ? styles.purplePrimary : 'transparent'}`,
                color: active === item.id ? styles.purplePrimary : styles.textTertiary,
                fontFamily: styles.mono, fontSize: 10, fontWeight: active === item.id ? 700 : 400,
                letterSpacing: '1px', textTransform: 'uppercase',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {item.icon}
                {item.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div style={{
            background: WS_BG, border: `1px solid ${SB_BORDER}`, borderRadius: 4,
            padding: 'clamp(14px, 3vw, 28px)', minHeight: 300,
          }}>
            {active === 'profile'       && <ProfilePanel      user={user} toast={toast} />}
            {active === 'notifications' && <NotificationsPanel toast={toast} />}
            {active === 'apikeys'       && <APIKeysPanel       toast={toast} />}
            {active === 'audit'         && <AuditLogPanel      toast={toast} />}
          </div>
        </>
      ) : (
        /* ── Desktop: Salesforce Setup layout ── */
        <div style={{
          display:      'flex',
          background:   WS_BG,
          border:       `1px solid ${SB_BORDER}`,
          borderRadius: 4,
          minHeight:    'calc(100vh - 180px)',
          overflow:     'hidden',
        }}>
          {/* Sidebar */}
          <aside style={{
            width:        240,
            background:   SB_BG,
            borderRight:  `1px solid ${SB_BORDER}`,
            padding:      '20px 0',
            flexShrink:   0,
          }}>
            {NAV.map(group => (
              <div key={group.group} style={{ marginBottom: 8 }}>
                <div style={{ padding: '0 20px 6px', fontFamily: styles.mono, fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: styles.textDim }}>
                  {group.group}
                </div>
                {group.items.map(item => (
                  <NavItem key={item.id} {...item} active={active === item.id} onClick={setActive} />
                ))}
              </div>
            ))}
          </aside>

          {/* Workspace */}
          <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
            {active === 'profile'       && <ProfilePanel      user={user} toast={toast} />}
            {active === 'notifications' && <NotificationsPanel toast={toast} />}
            {active === 'apikeys'       && <APIKeysPanel       toast={toast} />}
            {active === 'audit'         && <AuditLogPanel      toast={toast} />}
          </main>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
