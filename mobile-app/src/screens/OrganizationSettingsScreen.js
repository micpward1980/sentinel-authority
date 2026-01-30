import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function OrganizationSettingsScreen() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState(user?.company || user?.organization || '');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    // TODO: Call API to update organization info
    Alert.alert('Success', 'Organization information updated', [
      { text: 'OK', onPress: () => setEditing(false) }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{company?.[0] || '?'}</Text>
        </View>
        <Text style={styles.companyName}>{company || 'Your Organization'}</Text>
        <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ORGANIZATION DETAILS</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Company Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={company}
                onChangeText={setCompany}
                placeholder="Enter company name"
                placeholderTextColor={colors.textTertiary}
              />
            ) : (
              <Text style={styles.fieldValue}>{company || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Website</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={website}
                onChangeText={setWebsite}
                placeholder="https://example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="url"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.fieldValue}>{website || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Address</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Business address"
                placeholderTextColor={colors.textTertiary}
              />
            ) : (
              <Text style={styles.fieldValue}>{address || 'Not set'}</Text>
            )}
          </View>

          <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.fieldLabel}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{phone || 'Not set'}</Text>
            )}
          </View>
        </View>

        {editing && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PRIMARY CONTACT</Text>
        <View style={styles.card}>
          <View style={styles.contactRow}>
            <Ionicons name="person-outline" size={20} color={colors.purpleBright} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{user?.full_name || user?.email}</Text>
              <Text style={styles.contactEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT STATUS</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Account Type</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{user?.role === 'admin' ? 'ADMINISTRATOR' : 'APPLICANT'}</Text>
            </View>
          </View>
          <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: colors.greenDim }]}>
              <Text style={[styles.statusText, { color: colors.greenBright }]}>ACTIVE</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '600' },
  companyName: { color: colors.textPrimary, fontSize: 20, fontWeight: '600' },
  role: {
    color: colors.purpleBright,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  section: { marginTop: spacing.lg, marginHorizontal: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  editBtn: { color: colors.purpleBright, fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  fieldRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  fieldLabel: { color: colors.textTertiary, fontSize: 12, marginBottom: spacing.xs },
  fieldValue: { color: colors.textPrimary, fontSize: 15 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: colors.purpleBright,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
  contactInfo: { marginLeft: spacing.md },
  contactName: { color: colors.textPrimary, fontSize: 15 },
  contactEmail: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statusLabel: { color: colors.textSecondary, fontSize: 14 },
  statusBadge: {
    backgroundColor: colors.purpleDim + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: { color: colors.purpleBright, fontSize: 10, fontWeight: '600' },
});
