import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function SecuritySettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
    
    const savedEmail = await SecureStore.getItemAsync('savedEmail');
    const savedPassword = await SecureStore.getItemAsync('savedPassword');
    setBiometricEnabled(!!(savedEmail && savedPassword));
  };

  const toggleBiometric = async (value) => {
    if (value) {
      // Enable - authenticate first
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Face ID for Sentinel Authority',
        cancelLabel: 'Cancel',
      });
      
      if (result.success) {
        // Credentials should already be saved from login
        const savedEmail = await SecureStore.getItemAsync('savedEmail');
        if (savedEmail) {
          setBiometricEnabled(true);
          Alert.alert('Success', 'Face ID enabled for sign in');
        } else {
          Alert.alert('Error', 'Please sign out and sign in again to enable Face ID');
        }
      }
    } else {
      // Disable
      await SecureStore.deleteItemAsync('savedEmail');
      await SecureStore.deleteItemAsync('savedPassword');
      setBiometricEnabled(false);
      Alert.alert('Disabled', 'Face ID sign in has been disabled');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    // TODO: Call API to change password
    Alert.alert('Success', 'Password changed successfully', [
      { text: 'OK', onPress: () => {
        setPasswordModalVisible(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }}
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AUTHENTICATION</Text>
        
        {biometricAvailable && (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Ionicons name="scan-outline" size={20} color={colors.purpleBright} />
                <Text style={styles.settingLabel}>Face ID</Text>
              </View>
              <Text style={styles.settingDesc}>Use Face ID to sign in quickly</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
              thumbColor={biometricEnabled ? colors.purpleBright : colors.textTertiary}
            />
          </View>
        )}

        <TouchableOpacity 
          style={styles.settingRow}
          onPress={() => setPasswordModalVisible(true)}
        >
          <View style={styles.settingInfo}>
            <View style={styles.settingHeader}>
              <Ionicons name="key-outline" size={20} color={colors.purpleBright} />
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <Text style={styles.settingDesc}>Update your account password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SESSIONS</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.sessionRow}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.greenBright} />
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDevice}>This Device</Text>
              <Text style={styles.sessionTime}>Active now</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: colors.greenBright }]} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SECURITY TIPS</Text>
        <View style={styles.infoCard}>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.greenBright} />
            <Text style={styles.tipText}>Use a unique password</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.greenBright} />
            <Text style={styles.tipText}>Enable Face ID for faster, secure access</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.greenBright} />
            <Text style={styles.tipText}>Never share your credentials</Text>
          </View>
        </View>
      </View>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showPasswords}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPasswords}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPasswords}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <TouchableOpacity 
              style={styles.showPasswordBtn}
              onPress={() => setShowPasswords(!showPasswords)}
            >
              <Ionicons 
                name={showPasswords ? 'eye-off-outline' : 'eye-outline'} 
                size={18} 
                color={colors.textTertiary} 
              />
              <Text style={styles.showPasswordText}>
                {showPasswords ? 'Hide' : 'Show'} passwords
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
              <Text style={styles.saveBtnText}>Update Password</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => setPasswordModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  section: { marginTop: spacing.lg, marginHorizontal: spacing.md },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  settingInfo: { flex: 1, marginRight: spacing.md },
  settingHeader: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: { color: colors.textPrimary, fontSize: 15, marginLeft: spacing.sm },
  settingDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 4, marginLeft: 28 },
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionInfo: { flex: 1, marginLeft: spacing.md },
  sessionDevice: { color: colors.textPrimary, fontSize: 14 },
  sessionTime: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  tipText: { color: colors.textSecondary, fontSize: 13, marginLeft: spacing.sm },
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
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
  },
  input: {
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  showPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  showPasswordText: {
    color: colors.textTertiary,
    fontSize: 13,
    marginLeft: spacing.xs,
  },
  saveBtn: {
    backgroundColor: colors.purpleBright,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: { color: colors.textTertiary, fontSize: 15 },
});
