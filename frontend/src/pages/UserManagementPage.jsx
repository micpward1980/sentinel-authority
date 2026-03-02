import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, X, CheckCircle } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import SortHeader from '../components/SortHeader';

const LIMIT = 25;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'admin', label: 'Admins' },
  { key: 'applicant', label: 'Applicants' },
  { key: 'pending', label: 'Pending' },
];

function UserManagementPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [counts, setCounts] = useState({ all: 0, admin: 0, applicant: 0, pending: 0 });
  const [expandedId, setExpandedId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', company: '', role: 'applicant' });
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT, offset, sort_by: sortBy, sort_order: sortOrder,
      });
      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      const res = await api.get('/api/v1/users/list?' + params.toString());
      setUsers(res.data.users || res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.counts) setCounts(res.data.counts);
    } catch {
      // Fallback to old endpoint
      try {
        const res = await api.get('/api/users/');
        const all = res.data || [];
        setUsers(all);
        setTotal(all.length);
        setCounts({
          all: all.length,
          admin: all.filter(u => u.role === 'admin').length,
          applicant: all.filter(u => u.role === 'applicant').length,
          pending: all.filter(u => u.role === 'pending').length,
        });
      } catch { setUsers([]); setTotal(0); }
    }
    setLoading(false);
  }, [offset, sortBy, sortOrder, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); };
  const handleFilter = (key) => { setRoleFilter(key); setOffset(0); };

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const handleUpdateRole = async (userId, newRole) => {
    if (!await confirm({ title: 'Change Role', message: 'Change role to ' + newRole.toUpperCase() + '?' })) return;
    try { await api.patch('/api/users/' + userId, { role: newRole }); fetchUsers(); setExpandedId(null); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleToggleActive = async (userId, currentActive) => {
    const action = currentActive ? 'Deactivate' : 'Activate';
    if (!await confirm({ title: action, message: action + ' this user?' })) return;
    try { await api.patch('/api/users/' + userId, { is_active: !currentActive }); fetchUsers(); setExpandedId(null); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleApprove = async (userId, email) => {
    if (!await confirm({ title: 'Approve', message: 'Approve ' + email + '?' })) return;
    try { await api.post('/api/users/' + userId + '/approve'); fetchUsers(); setExpandedId(null); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleReject = async (userId, email) => {
    if (!await confirm({ title: 'Reject', message: 'Reject ' + email + '?', danger: true })) return;
    try { await api.post('/api/users/' + userId + '/reject'); fetchUsers(); setExpandedId(null); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleDelete = async (userId, email) => {
    if (!await confirm({ title: 'Delete', message: 'DELETE ' + email + '? Cannot be undone.', danger: true, confirmLabel: 'Delete' })) return;
    try { await api.delete('/api/users/' + userId); fetchUsers(); setExpandedId(null); }
    catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) { toast.show('Email and name required', 'warning'); return; }
    setInviteLoading(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      await api.post('/api/users/', { ...inviteForm, password: tempPassword });
      toast.show('User created — share credentials securely', 'success');
      setShowInvite(false);
      setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' });
      fetchUsers();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
    setInviteLoading(false);
  };

  const roleBadge = (role) => ({
    padding: '3px 8px', fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
    color: role === 'admin' ? styles.purpleBright : role === 'pending' ? styles.accentAmber : styles.textTertiary,
    background: role === 'admin' ? 'rgba(29,26,59,0.08)' : role === 'pending' ? 'rgba(221,122,1,0.08)' : 'rgba(0,0,0,0.03)',
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Search + Invite */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
          <input type="text" placeholder="Search by name, email, or company..."
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }}
          />
        </div>
        <button onClick={() => setShowInvite(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
          background: styles.purplePrimary, border: '1px solid ' + styles.purplePrimary, color: '#fff',
          fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer',
        }}><Plus size={12} /> Invite User</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid ' + styles.borderSubtle, marginBottom: '16px' }}>
        {TABS.map(tab => {
          const active = roleFilter === tab.key;
          const count = counts[tab.key] || 0;
          return (
            <button key={tab.key} onClick={() => handleFilter(tab.key)} style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
              color: active ? styles.purpleBright : styles.textTertiary,
              borderBottom: active ? '2px solid ' + styles.purpleBright : '2px solid transparent',
              transition: 'color 0.2s',
            }}>
              {tab.label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortHeader label="Name" field="full_name" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="Email" field="email" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Company</th>
              <SortHeader label="Role" field="role" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="Joined" field="created_at" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px' }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: styles.textTertiary, fontSize: '14px' }}>
                {search ? 'No users match "' + search + '"' : 'No users found'}
              </td></tr>
            ) : users.map(u => (
              <React.Fragment key={u.id || u.email}>
                <tr style={{ borderBottom: '1px solid ' + styles.borderSubtle, transition: 'background 0.15s', cursor: 'pointer' }}
                  onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px', fontWeight: 500, color: styles.textPrimary, fontSize: '13px' }}>{u.full_name || '—'}</td>
                  <td style={{ padding: '12px', fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary }}>{u.email}</td>
                  <td style={{ padding: '12px', color: styles.textSecondary, fontSize: '13px' }}>{u.company || '—'}</td>
                  <td style={{ padding: '12px' }}><span style={roleBadge(u.role)}>{u.role}</span>{u.is_active === false && <span style={{ marginLeft: '8px', fontFamily: styles.mono, fontSize: '9px', color: styles.accentRed }}>INACTIVE</span>}</td>
                  <td style={{ padding: '12px', fontFamily: styles.mono, fontSize: '12px', color: styles.textTertiary }}>{u.created_at ? new Date(u.created_at).toISOString().substring(0,10) : '—'}</td>
                  <td style={{ padding: '12px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {u.role === 'pending' && (<>
                        <button onClick={() => handleApprove(u.id, u.email)} style={{ padding: '4px 10px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => handleReject(u.id, u.email)} style={{ padding: '4px 10px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentRed, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Reject</button>
                      </>)}
                    </div>
                  </td>
                </tr>
                {expandedId === u.id && (
                  <tr><td colSpan={6} style={{ padding: '16px 20px', background: 'rgba(29,26,59,0.02)', borderBottom: '1px solid ' + styles.borderGlass }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => handleUpdateRole(u.id, u.role === 'admin' ? 'applicant' : 'admin')} style={{ padding: '6px 14px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Make {u.role === 'admin' ? 'Applicant' : 'Admin'}
                      </button>
                      <button onClick={() => handleToggleActive(u.id, u.is_active !== false)} style={{ padding: '6px 14px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: u.is_active === false ? styles.accentGreen : styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {u.is_active === false ? 'Activate' : 'Deactivate'}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.email)} style={{ padding: '6px 14px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.accentRed, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ width: '100%', maxWidth: '420px', margin: '0 16px', padding: '28px', background: 'rgba(255,255,255,0.96)', backdropFilter: styles.frostModal, border: '1px solid ' + styles.borderGlass }}>
            <h2 style={{ fontFamily: styles.serif, fontSize: '20px', fontWeight: 200, margin: '0 0 24px', color: styles.textPrimary, textAlign: 'center' }}>Invite User</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" placeholder="Email *" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                style={{ padding: '10px 12px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }} />
              <input type="text" placeholder="Full Name *" value={inviteForm.full_name} onChange={e => setInviteForm({...inviteForm, full_name: e.target.value})}
                style={{ padding: '10px 12px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }} />
              <input type="text" placeholder="Company" value={inviteForm.company} onChange={e => setInviteForm({...inviteForm, company: e.target.value})}
                style={{ padding: '10px 12px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                {['applicant', 'admin'].map(r => (
                  <button key={r} onClick={() => setInviteForm({...inviteForm, role: r})} style={{
                    flex: 1, padding: '10px', border: '1px solid ' + (inviteForm.role === r ? styles.purpleBright : styles.borderGlass),
                    background: inviteForm.role === r ? 'rgba(29,26,59,0.06)' : 'transparent',
                    color: inviteForm.role === r ? styles.purpleBright : styles.textTertiary,
                    fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
                  }}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => { setShowInvite(false); setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' }); }}
                style={{ flex: 1, padding: '10px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleInvite} disabled={inviteLoading}
                style={{ flex: 1, padding: '10px', border: '1px solid ' + styles.purplePrimary, background: styles.purplePrimary, color: '#fff', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: inviteLoading ? 0.5 : 1 }}>{inviteLoading ? 'Creating...' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
