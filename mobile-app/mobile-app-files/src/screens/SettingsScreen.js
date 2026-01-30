import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const openLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.company?.[0] || user?.email?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.company || 'Company'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Settings Links */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Security</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="business-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Organization</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RESOURCES</Text>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => openLink('https://www.sentinelauthority.org')}
        >
          <Ionicons name="globe-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Website</Text>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => openLink('https://www.sentinelauthority.org/#contact')}
        >
          <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Support</Text>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => openLink('https://www.sentinelauthority.org/privacy.html')}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => openLink('https://www.sentinelauthority.org/terms.html')}
        >
          <Ionicons name="document-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.menuText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.redBright} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <View style={styles.footer}>
        <Text style={styles.version}>Sentinel Authority v1.0.0</Text>
        <Text style={styles.copyright}>© 2025 Sentinel Authority — ODDC</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  section: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  profileEmail: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.purpleBright + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    color: colors.purpleBright,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  menuText: {
    color: colors.textSecondary,
    flex: 1,
    marginLeft: spacing.md,
    fontSize: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redDim,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.redBright + '30',
  },
  logoutText: {
    color: colors.redBright,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  version: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  copyright: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
