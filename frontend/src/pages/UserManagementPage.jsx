import React, { useState, useEffect } from 'react';
import { Settings, Activity, Users, X, CheckCircle, Search, Plus, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';

function UserManagementPage() {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
    inactive: users.filter(u => u.is_active === false).length,
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
      setShowEditModal(false);
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
      setShowEditModal(false);
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
      setShowEditModal(false);
    } catch (err) {
      toast.show('Failed to approve: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleRejectUser = async (userId, email) => {
    if (!await confirm({title: 'Reject User', message: 'Reject ' + email + '? Their account will be deactivated.', danger: true})) return;
    try {
      await api.post('/api/users/' + userId + '/reject');
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      toast.show('Failed to reject: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!await confirm({title: 'Delete User', message: 'DELETE ' + email + '? This cannot be undone.', danger: true, confirmLabel: 'Delete'})) return;
    try {
      await api.delete('/api/users/' + userId);
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      toast.show('Failed to delete user: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Administration" title="User Management" description="Manage admin and applicant accounts"
        action={<button onClick={() => setShowInviteModal(true)} className="sexy-btn px-4 py-2 rounded-lg flex items-center gap-2" style={{background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, color: '#fff'}}><Plus className="w-4 h-4" /> Invite User</button>}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Users" value={stats.total} color={styles.textPrimary} />
        <StatCard label="Admins" value={stats.admins} color={styles.purpleBright} />
        <StatCard label="Applicants" value={stats.applicants} color={styles.accentGreen} />
        <StatCard label="Pending" value={stats.pending} color={styles.accentAmber || '#f59e0b'} />
        <StatCard label="Inactive" value={stats.inactive} color={styles.accentRed} />
      </div>
      <Panel>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5" style={{color: styles.textTertiary}} />
          <input type="text" placeholder="Search by name, email, or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="sexy-input flex-1 px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} />
        </div>
      </Panel>
      <Panel>
        {loading ? (<div style={{color: styles.textTertiary, textAlign: 'center', padding: '40px'}}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{textAlign: 'center', padding: '60px'}}>
            <Users className="w-12 h-12 mx-auto mb-4" style={{color: styles.textTertiary}} />
            <p style={{color: styles.textSecondary, marginBottom: '8px'}}>No users found</p>
            <p style={{color: styles.textTertiary, fontSize: '14px'}}>{users.length === 0 ? 'The /api/users/ endpoint may not be configured.' : 'Try adjusting your search.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map(user => (
              <div key={user.id || user.email} onClick={() => { setSelectedUser(user); setShowEditModal(true); }} className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background: styles.purplePrimary, color: '#fff', fontWeight: '400'}}>{user.full_name?.[0] || user.email?.[0] || '?'}</div>
                <div className="flex-1 min-w-0">
                  <p style={{color: styles.textPrimary, fontWeight: '500'}}>{user.full_name || 'No Name'}</p>
                  <p style={{color: styles.textTertiary, fontSize: '13px'}}>{user.email}</p>
                  {user.company && <p style={{color: styles.textTertiary, fontSize: '12px'}}>{user.company}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded text-xs" style={{background: user.role === 'admin' ? 'rgba(157,140,207,0.2)' : user.role === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.1)', color: user.role === 'admin' ? styles.purpleBright : user.role === 'pending' ? '#f59e0b' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>{user.role}</span>
                  {user.role === 'pending' && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleApproveUser(user.id, user.email)} className="px-2 py-1 rounded text-xs" style={{background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer'}}>Approve</button>
                      <button onClick={() => handleRejectUser(user.id, user.email)} className="px-2 py-1 rounded text-xs" style={{background: 'rgba(214,92,92,0.15)', color: '#d65c5c', border: '1px solid rgba(214,92,92,0.3)', cursor: 'pointer'}}>Reject</button>
                    </div>
                  )}
                  {user.is_active === false && <span className="px-2 py-1 rounded text-xs" style={{background: 'rgba(214,92,92,0.15)', color: styles.accentRed}}>Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0,0,0,0.7)'}}>
          <div className="w-full max-w-md mx-4 p-6 rounded-xl" style={{background: styles.bgDeep, border: '1px solid ' + styles.borderGlass}}>
            <h2 style={{color: styles.textPrimary, fontSize: '20px', fontWeight: '400', marginBottom: '24px', textAlign: 'center'}}>Invite New User</h2>
            <div className="space-y-4">
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Email *</label><input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} placeholder="user@company.com" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Full Name *</label><input type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm({...inviteForm, full_name: e.target.value})} placeholder="John Smith" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Company</label><input type="text" value={inviteForm.company} onChange={(e) => setInviteForm({...inviteForm, company: e.target.value})} placeholder="Company name" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Role</label>
                <div className="flex gap-3">
                  <button onClick={() => setInviteForm({...inviteForm, role: 'applicant'})} className="flex-1 px-4 py-3 rounded-lg" style={{background: inviteForm.role === 'applicant' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (inviteForm.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'applicant' ? styles.purpleBright : styles.textTertiary}}>Applicant</button>
                  <button onClick={() => setInviteForm({...inviteForm, role: 'admin'})} className="flex-1 px-4 py-3 rounded-lg" style={{background: inviteForm.role === 'admin' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (inviteForm.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'admin' ? styles.purpleBright : styles.textTertiary}}>Admin</button>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={handleInvite} disabled={inviteLoading} className="sexy-btn w-full px-4 py-3 rounded-lg" style={{background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, color: '#fff', opacity: inviteLoading ? 0.7 : 1}}>{inviteLoading ? 'Creating...' : 'Create Account'}</button>
              <button onClick={() => { setShowInviteModal(false); setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' }); }} className="w-full px-4 py-3 rounded-lg" style={{background: 'transparent', border: 'none', color: styles.textTertiary}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0,0,0,0.7)'}}>
          <div className="w-full max-w-md mx-4 p-6 rounded-xl" style={{background: styles.bgDeep, border: '1px solid ' + styles.borderGlass}}>
            <h2 style={{color: styles.textPrimary, fontSize: '20px', fontWeight: '400', marginBottom: '24px', textAlign: 'center'}}>Manage User</h2>
            <div className="text-center mb-6 p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)'}}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{background: styles.purplePrimary, color: '#fff', fontSize: '24px', fontWeight: '400'}}>{selectedUser.full_name?.[0] || selectedUser.email?.[0] || '?'}</div>
              <p style={{color: styles.textPrimary, fontSize: '18px', fontWeight: '500'}}>{selectedUser.full_name || 'No Name'}</p>
              <p style={{color: styles.textTertiary, fontSize: '14px'}}>{selectedUser.email}</p>
            </div>
            <div className="mb-6">
              <label style={{color: styles.textTertiary, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px'}}>Role</label>
              <div className="flex gap-3">
                <button onClick={() => handleUpdateRole(selectedUser.id, 'applicant')} className="flex-1 px-4 py-3 rounded-lg" style={{background: selectedUser.role === 'applicant' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (selectedUser.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'applicant' ? styles.purpleBright : styles.textTertiary}}>Applicant</button>
                <button onClick={() => handleUpdateRole(selectedUser.id, 'admin')} className="flex-1 px-4 py-3 rounded-lg" style={{background: selectedUser.role === 'admin' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (selectedUser.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'admin' ? styles.purpleBright : styles.textTertiary}}>Admin</button>
              </div>
            </div>
            <div className="space-y-2 mb-6">
              <label style={{color: styles.textTertiary, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px'}}>Actions</label>
              <button onClick={() => handleResetPassword(selectedUser.id, selectedUser.email)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, textAlign: 'left'}}><RefreshCw className="w-4 h-4" style={{color: styles.purpleBright}} />Reset Password</button>
              <button onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active !== false)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: selectedUser.is_active === false ? styles.accentGreen : styles.accentRed, textAlign: 'left'}}>{selectedUser.is_active === false ? <><CheckCircle className="w-4 h-4" /> Activate Account</> : <><X className="w-4 h-4" /> Deactivate Account</>}</button>
              <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, textAlign: 'left'}}><X className="w-4 h-4" /> Delete User</button>
            </div>
            <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="w-full px-4 py-3 rounded-lg" style={{background: 'transparent', border: 'none', color: styles.textTertiary}}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══ Settings Page ═══

// ═══ Activity History / Audit Log ═══

export default UserManagementPage;

