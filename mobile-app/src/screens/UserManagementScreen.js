import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersAPI, API_URL } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';
import * as SecureStore from 'expo-secure-store';

export default function UserManagementScreen() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviteRole, setInviteRole] = useState('applicant');
  const [inviteLoading, setInviteLoading] = useState(false);

  const getToken = async () => {
    return await SecureStore.getItemAsync('token');
  };

  const loadUsers = async () => {
    try {
      const res = await usersAPI.getAll();
      const data = res.data || [];
      setUsers(data);
      setFiltered(data);
    } catch (error) {
      console.log('Error loading users:', error);
      // If endpoint doesn't exist, show sample data structure
      Alert.alert('Note', 'User management API endpoint not configured on backend. Contact developer to enable /api/users/ endpoints.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFiltered(users);
    } else {
      const term = text.toLowerCase();
      setFiltered(users.filter(u => 
        u.email?.toLowerCase().includes(term) ||
        u.full_name?.toLowerCase().includes(term) ||
        u.company?.toLowerCase().includes(term)
      ));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteFullName) {
      Alert.alert('Error', 'Email and full name are required');
      return;
    }

    setInviteLoading(true);
    try {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      await fetch(`${API_URL}/api/users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteFullName,
          company: inviteCompany,
          role: inviteRole,
          password: tempPassword,
        }),
      });

      Alert.alert(
        'User Created',
        `Account created for ${inviteEmail}\n\nTemporary password:\n${tempPassword}\n\nShare this with the user securely.`,
        [{ text: 'OK' }]
      );
      
      setInviteModalVisible(false);
      resetInviteForm();
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'Failed to create user. The API endpoint may not be configured.');
    } finally {
      setInviteLoading(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteFullName('');
    setInviteCompany('');
    setInviteRole('applicant');
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  const handleUpdateRole = async (newRole) => {
    if (!selectedUser) return;
    
    try {
      await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      Alert.alert('Success', `User role updated to ${newRole}`);
      setEditModalVisible(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'Failed to update user role');
    }
  };

  const handleToggleActive = async () => {
    if (!selectedUser) return;
    
    const newStatus = !selectedUser.is_active;
    const action = newStatus ? 'activate' : 'deactivate';
    
    Alert.alert(
      `${newStatus ? 'Activate' : 'Deactivate'} User`,
      `Are you sure you want to ${action} ${selectedUser.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Activate' : 'Deactivate',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ is_active: newStatus }),
              });
              
              Alert.alert('Success', `User ${action}d`);
              setEditModalVisible(false);
              setSelectedUser(null);
              loadUsers();
            } catch (error) {
              Alert.alert('Error', `Failed to ${action} user`);
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    
    Alert.alert(
      'Reset Password',
      `Send password reset to ${selectedUser.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const newPassword = Math.random().toString(36).slice(-8) + 'A1!';
              
              await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ password: newPassword }),
              });
              
              Alert.alert(
                'Password Reset',
                `New temporary password:\n${newPassword}\n\nShare this with the user securely.`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to reset password');
            }
          }
        }
      ]
    );
  };

  const getRoleBadgeColor = (role) => {
    return role === 'admin' ? colors.purpleBright : colors.textTertiary;
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => handleEditUser(item)}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>
          {item.full_name?.[0] || item.email?.[0] || '?'}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name || 'No Name'}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        {item.company && <Text style={styles.userCompany}>{item.company}</Text>}
      </View>
      <View style={styles.userMeta}>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) + '20' }]}>
          <Text style={[styles.roleText, { color: getRoleBadgeColor(item.role) }]}>
            {item.role?.toUpperCase()}
          </Text>
        </View>
        {item.is_active === false && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveText}>INACTIVE</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>User Management</Text>
          <Text style={styles.subtitle}>{users.length} total users</Text>
        </View>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteModalVisible(true)}>
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search users..."
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.purpleBright }]}>
            {users.filter(u => u.role === 'admin').length}
          </Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.greenBright }]}>
            {users.filter(u => u.role === 'applicant').length}
          </Text>
          <Text style={styles.statLabel}>Applicants</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.redBright }]}>
            {users.filter(u => u.is_active === false).length}
          </Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
      </View>

      {/* User List */}
      <FlatList
        data={filtered}
        renderItem={renderUser}
        keyExtractor={(item) => item.id?.toString() || item.email}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptyText}>Invite team members to get started</Text>
          </View>
        }
      />

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite New User</Text>

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="user@company.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={inviteFullName}
              onChangeText={setInviteFullName}
              placeholder="John Smith"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.inputLabel}>Company</Text>
            <TextInput
              style={styles.input}
              value={inviteCompany}
              onChangeText={setInviteCompany}
              placeholder="Company name"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === 'applicant' && styles.roleOptionActive]}
                onPress={() => setInviteRole('applicant')}
              >
                <Text style={[styles.roleOptionText, inviteRole === 'applicant' && styles.roleOptionTextActive]}>
                  Applicant
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === 'admin' && styles.roleOptionActive]}
                onPress={() => setInviteRole('admin')}
              >
                <Text style={[styles.roleOptionText, inviteRole === 'admin' && styles.roleOptionTextActive]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, inviteLoading && styles.submitBtnDisabled]} 
              onPress={handleInvite}
              disabled={inviteLoading}
            >
              <Text style={styles.submitBtnText}>
                {inviteLoading ? 'Creating...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => {
                setInviteModalVisible(false);
                resetInviteForm();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage User</Text>
            
            {selectedUser && (
              <>
                <View style={styles.userDetailCard}>
                  <View style={styles.userDetailAvatar}>
                    <Text style={styles.userDetailAvatarText}>
                      {selectedUser.full_name?.[0] || selectedUser.email?.[0] || '?'}
                    </Text>
                  </View>
                  <Text style={styles.userDetailName}>{selectedUser.full_name || 'No Name'}</Text>
                  <Text style={styles.userDetailEmail}>{selectedUser.email}</Text>
                </View>

                <View style={styles.actionSection}>
                  <Text style={styles.actionSectionTitle}>ROLE</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[styles.roleOption, selectedUser.role === 'applicant' && styles.roleOptionActive]}
                      onPress={() => handleUpdateRole('applicant')}
                    >
                      <Text style={[styles.roleOptionText, selectedUser.role === 'applicant' && styles.roleOptionTextActive]}>
                        Applicant
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleOption, selectedUser.role === 'admin' && styles.roleOptionActive]}
                      onPress={() => handleUpdateRole('admin')}
                    >
                      <Text style={[styles.roleOptionText, selectedUser.role === 'admin' && styles.roleOptionTextActive]}>
                        Admin
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.actionSection}>
                  <Text style={styles.actionSectionTitle}>ACTIONS</Text>
                  
                  <TouchableOpacity style={styles.actionRow} onPress={handleResetPassword}>
                    <Ionicons name="key-outline" size={20} color={colors.purpleBright} />
                    <Text style={styles.actionRowText}>Reset Password</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionRow} onPress={handleToggleActive}>
                    <Ionicons 
                      name={selectedUser.is_active === false ? 'checkmark-circle-outline' : 'ban-outline'} 
                      size={20} 
                      color={selectedUser.is_active === false ? colors.greenBright : colors.redBright} 
                    />
                    <Text style={[styles.actionRowText, { 
                      color: selectedUser.is_active === false ? colors.greenBright : colors.redBright 
                    }]}>
                      {selectedUser.is_active === false ? 'Activate Account' : 'Deactivate Account'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => {
                setEditModalVisible(false);
                setSelectedUser(null);
              }}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '600' },
  subtitle: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purpleBright,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  inviteBtnText: { color: '#fff', fontWeight: '600', marginLeft: spacing.xs },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  list: { padding: spacing.md },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  userInfo: { flex: 1, marginLeft: spacing.md },
  userName: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  userEmail: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  userCompany: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  userMeta: { alignItems: 'flex-end' },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  roleText: { fontSize: 10, fontWeight: '600' },
  inactiveBadge: {
    marginTop: 4,
    backgroundColor: colors.redDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  inactiveText: { color: colors.redBright, fontSize: 9, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: spacing.md },
  emptyText: { color: colors.textTertiary, fontSize: 14, marginTop: spacing.xs },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  roleSelector: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  roleOption: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bgCardHover,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginHorizontal: 4,
    borderRadius: borderRadius.sm,
  },
  roleOptionActive: {
    backgroundColor: colors.purpleBright + '20',
    borderColor: colors.purpleBright,
  },
  roleOptionText: { color: colors.textTertiary, fontWeight: '500' },
  roleOptionTextActive: { color: colors.purpleBright },
  submitBtn: {
    backgroundColor: colors.purpleBright,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: { color: colors.textTertiary, fontSize: 15 },

  // Edit modal specific
  userDetailCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgCardHover,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  userDetailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userDetailAvatarText: { color: '#fff', fontSize: 26, fontWeight: '600' },
  userDetailName: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  userDetailEmail: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  actionSection: { marginTop: spacing.md },
  actionSectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCardHover,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  actionRowText: { flex: 1, color: colors.textSecondary, fontSize: 14, marginLeft: spacing.md },
});
