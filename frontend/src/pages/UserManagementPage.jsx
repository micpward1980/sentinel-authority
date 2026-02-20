import React, { useState, useEffect } from 'react';
import { Settings, Activity, Users, X, CheckCircle, Search, Plus, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';

function UserManagementPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', company: '', role: 'applicant' });
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users/');
      setUsers(res.data || []);
    } catch (err) {
      console.log('Users API not available:', err);
      setUsers([]);
    }
    setLoading(false);
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    applicants: users.filter(u => u.role === 'applicant').length,
    pending: users.filter(u => u.role === 'pending').length,
    inactive: users.filter(u => u.is_active === false).length
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) { toast.show('Email and full name are required', 'warning'); return; }
    setInviteLoading(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      await api.post('/api/users/', { ...inviteForm, password: tempPassword });
      toast.show('User created — share credentials securely','success');
      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' });
      loadUsers();
    } catch (err) {
      toast.show('Failed to create user: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setInviteLoading(false);
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (!await confirm({title: 'Change Role', message: 'Change user role to ' + newRole.toUpperCase() + '?'})) return;
    try {
      await api.patch('/api/users/' + userId, { role: newRole });
      loadUsers();
      setExpandedUserId(null);
    } catch (err) {
      toast.show('Failed to update role: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    const action = currentActive ? 'deactivate' : 'activate';
    if (!await confirm({title: action.charAt(0).toUpperCase() + action.slice(1), message: action.charAt(0).toUpperCase() + action.slice(1) + ' this user?'})) return;
    try {
      await api.patch('/api/users/' + userId, { is_active: !currentActive });
      loadUsers();
      setExpandedUserId(null);
    } catch (err) {
      toast.show('Failed to update user: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleResetPassword = async (userId, email) => {
    if (!await confirm({title: 'Reset Password', message: 'Reset password for ' + email + '?'})) return;
    try {
      const newPassword = Math.random().toString(36).slice(-8) + 'A1!';
      await api.post('/api/users/' + userId + '/reset-password');
      toast.show('Password reset — share credentials securely','success');
    } catch (err) {
      toast.show('Failed to reset password: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleApproveUser = async (userId, email) => {
    if (!await confirm({title: 'Approve User', message: 'Approve ' + email + ' as an applicant?'})) return;
    try {
      await api.post('/api/users/' + userId + '/approve');
      loadUsers();
      setExpandedUserId(null);
    } catch (err) {
      toast.show('Failed to approve: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleRejectUser = async (userId, email) => {
    if (!await confirm({title: 'Reject User', message: 'Reject ' + email + '? Their account will be deactivated.', danger: true})) return;
    try {
      await api.post('/api/users/' + userId + '/reject');
      loadUsers();
      setExpandedUserId(null);
    } catch (err) {
      toast.show('Failed to reject: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!await confirm({title: 'Delete User', message: 'DELETE ' + email + '? This cannot be undone.', danger: true, confirmLabel: 'Delete'})) return;
    try {
      await api.delete('/api/users/' + userId);
      loadUsers();
      setExpandedUserId(null);
    } catch (err) {
      toast.show('Failed to delete user: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Administration" title="User Management" description="Manage admin and applicant accounts"
        action={<button onClick={() => setShowInviteModal(true)} className="px-4 py-2 flex items-center gap-2" style={{background: 'transparent', border: 'none', borderBottom: '1px solid ' + styles.purpleBright, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}><Plus className="w-4 h-4" /> Invite User</button>}
      />
      <div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"}}>
        <StatCard label="Total Users" value={stats.total} color={styles.textPrimary} />
        <StatCard label="Admins" value={stats.admins} color={styles.purpleBright} />
        <StatCard label="Applicants" value={stats.applicants} color={styles.accentGreen} />
        <StatCard label="Pending" value={stats.pending} color={styles.accentAmber || styles.accentAmber} />
        <StatCard label="Inactive" value={stats.inactive} color={styles.accentRed} />
      </div>
      <Panel>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5" style={{color: styles.textTertiary}} />
          <input type="text" placeholder="Search by name, email, or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-4 py-3" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none', borderRadius: 8}} />
        </div>
      </Panel>
      <Panel>
        {loading ? (<div style={{color: styles.textTertiary, textAlign: 'center', padding: 'clamp(16px, 4vw, 40px)'}}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{textAlign: 'center', padding: 'clamp(24px, 5vw, 60px)'}}>
            <Users fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} className="w-12 h-12 mx-auto mb-4" style={{color: styles.textTertiary}} />
            <p style={{color: styles.textSecondary, marginBottom: '8px'}}>No users found</p>
            <p style={{color: styles.textTertiary, fontSize: '14px'}}>{users.length === 0 ? 'The /api/users/ endpoint may not be configured.' : 'Try adjusting your search.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map(user => (
              <div key={user.id || user.email} style={{borderRadius: 8, overflow: 'hidden', border: '1px solid ' + (expandedUserId === (user.id || user.email) ? styles.purpleBright : styles.borderGlass), transition: 'border-color 0.2s'}}>
              <div onClick={() => { if (expandedUserId === (user.id || user.email)) { setExpandedUserId(null); setSelectedUser(null); } else { setExpandedUserId(user.id || user.email); setSelectedUser(user); } }} className="flex items-center gap-4 p-4 cursor-pointer transition-all" style={{background: styles.cardSurface}}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{background: 'transparent', color: styles.purpleBright, fontWeight: '400'}}>{user.full_name?.[0] || user.email?.[0] || '?'}</div>
                <div className="flex-1 min-w-0">
                  <p style={{color: styles.textPrimary, fontWeight: '500'}}>{user.full_name || 'No Name'}</p>
                  <p style={{color: styles.textTertiary, fontSize: '13px'}}>{user.email}</p>
                  {user.company && <p style={{color: styles.textTertiary, fontSize: '12px'}}>{user.company}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs" style={{background: user.role === 'admin' ? 'rgba(74,61,117,0.10)' : user.role === 'pending' ? 'rgba(158,110,18,0.10)' : 'rgba(0,0,0,0.04)', color: user.role === 'admin' ? styles.purpleBright : user.role === 'pending' ? styles.accentAmber : styles.textTertiary, fontFamily: styles.mono, textTransform: 'uppercase'}}>{user.role}</span>
                  {user.role === 'pending' && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleApproveUser(user.id, user.email)} className="px-2 py-1 text-xs" style={{background: 'rgba(22,135,62,0.10)', color: styles.accentGreen, border: '1px solid rgba(22,135,62,0.3)', cursor: 'pointer'}}>Approve</button>
                      <button onClick={() => handleRejectUser(user.id, user.email)} className="px-2 py-1 text-xs" style={{background: styles.cardSurface, color: styles.accentRed, border: '1px solid ' + styles.borderSubtle, cursor: 'pointer', borderRadius: 8}}>Reject</button>
                    </div>
                  )}
                  {user.is_active === false && <span className="px-2 py-1 text-xs" style={{background: 'transparent', color: styles.accentRed}}>Inactive</span>}
                </div>
              </div>
              {expandedUserId === (user.id || user.email) && selectedUser && (
                <div onClick={e => e.stopPropagation()} style={{background: 'rgba(74,61,117,0.03)', borderTop: '1px solid ' + styles.borderGlass, padding: '20px 24px'}}>
                  <div style={{display: 'flex', gap: '12px', marginBottom: '16px'}}>
                    <button onClick={() => handleUpdateRole(selectedUser.id, 'applicant')} style={{flex: 1, padding: '10px', background: selectedUser.role === 'applicant' ? 'rgba(74,61,117,0.10)' : 'transparent', border: '1px solid ' + (selectedUser.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'applicant' ? styles.purpleBright : styles.textTertiary, borderRadius: 6, cursor: 'pointer', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>Applicant</button>
                    <button onClick={() => handleUpdateRole(selectedUser.id, 'admin')} style={{flex: 1, padding: '10px', background: selectedUser.role === 'admin' ? 'rgba(74,61,117,0.10)' : 'transparent', border: '1px solid ' + (selectedUser.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'admin' ? styles.purpleBright : styles.textTertiary, borderRadius: 6, cursor: 'pointer', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>Admin</button>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <button onClick={() => handleResetPassword(selectedUser.id, selectedUser.email)} style={{width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, textAlign: 'left', borderRadius: 6, cursor: 'pointer'}}><RefreshCw className="w-4 h-4" style={{color: styles.purpleBright}} />Reset Password</button>
                    <button onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active !== false)} style={{width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: selectedUser.is_active === false ? styles.accentGreen : styles.accentRed, textAlign: 'left', borderRadius: 6, cursor: 'pointer'}}>{selectedUser.is_active === false ? <><CheckCircle className="w-4 h-4" /> Activate Account</> : <><X className="w-4 h-4" /> Deactivate Account</>}</button>
                    <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)} style={{width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentRed, textAlign: 'left', borderRadius: 6, cursor: 'pointer'}}><X className="w-4 h-4" /> Delete User</button>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </Panel>
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0,0,0,0.4)'}}>
          <div className="w-full max-w-md mx-4 p-6" style={{background: 'rgba(255,255,255,0.96)', backdropFilter: styles.frostModal, WebkitBackdropFilter: styles.frostModal, border: '1px solid ' + styles.borderGlass, borderRadius: 8}}>
            <h2 style={{fontFamily: styles.serif, color: styles.textPrimary, fontSize: '20px', fontWeight: 200, marginBottom: '24px', textAlign: 'center'}}>Invite New User</h2>
            <div className="space-y-4">
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Email *</label><input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} placeholder="user@company.com" className="w-full px-4 py-3" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none', borderRadius: 8}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Full Name *</label><input type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm({...inviteForm, full_name: e.target.value})} placeholder="John Smith" className="w-full px-4 py-3" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none', borderRadius: 8}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Company</label><input type="text" value={inviteForm.company} onChange={(e) => setInviteForm({...inviteForm, company: e.target.value})} placeholder="Company name" className="w-full px-4 py-3" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none', borderRadius: 8}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Role</label>
                <div className="flex gap-3">
                  <button onClick={() => setInviteForm({...inviteForm, role: 'applicant'})} className="flex-1 px-4 py-3" style={{background: inviteForm.role === 'applicant' ? 'rgba(74,61,117,0.10)' : 'rgba(0,0,0,0.025)', border: '1px solid ' + (inviteForm.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'applicant' ? styles.purpleBright : styles.textTertiary, borderRadius: 8}}>Applicant</button>
                  <button onClick={() => setInviteForm({...inviteForm, role: 'admin'})} className="flex-1 px-4 py-3" style={{background: inviteForm.role === 'admin' ? 'rgba(74,61,117,0.10)' : 'rgba(0,0,0,0.025)', border: '1px solid ' + (inviteForm.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'admin' ? styles.purpleBright : styles.textTertiary, borderRadius: 8}}>Admin</button>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={handleInvite} disabled={inviteLoading} className="w-full px-4 py-3" style={{background: 'transparent', border: 'none', borderBottom: '1px solid ' + styles.purpleBright, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: inviteLoading ? 0.5 : 1}}>{inviteLoading ? 'Creating...' : 'Create Account'}</button>
              <button onClick={() => { setShowInviteModal(false); setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' }); }} className="w-full px-4 py-3" style={{background: 'transparent', border: 'none', color: styles.textTertiary}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// ═══ Settings Page ═══

// ═══ Activity History / Audit Log ═══

export default UserManagementPage;

