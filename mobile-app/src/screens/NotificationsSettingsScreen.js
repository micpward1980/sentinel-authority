import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function NotificationsSettingsScreen() {
  const [settings, setSettings] = useState({
    applicationUpdates: true,
    cat72Progress: true,
    certificateAlerts: true,
    agentStatus: true,
    marketingEmails: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await SecureStore.getItemAsync('notificationSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading notification settings:', error);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await SecureStore.setItemAsync('notificationSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.log('Error saving notification settings:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PUSH NOTIFICATIONS</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Application Updates</Text>
            <Text style={styles.settingDesc}>Status changes on your applications</Text>
          </View>
          <Switch
            value={settings.applicationUpdates}
            onValueChange={(v) => updateSetting('applicationUpdates', v)}
            trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
            thumbColor={settings.applicationUpdates ? colors.purpleBright : colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>CAT-72 Progress</Text>
            <Text style={styles.settingDesc}>Testing milestones and completion</Text>
          </View>
          <Switch
            value={settings.cat72Progress}
            onValueChange={(v) => updateSetting('cat72Progress', v)}
            trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
            thumbColor={settings.cat72Progress ? colors.purpleBright : colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Certificate Alerts</Text>
            <Text style={styles.settingDesc}>Issuance, expiry warnings, status changes</Text>
          </View>
          <Switch
            value={settings.certificateAlerts}
            onValueChange={(v) => updateSetting('certificateAlerts', v)}
            trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
            thumbColor={settings.certificateAlerts ? colors.purpleBright : colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Agent Status</Text>
            <Text style={styles.settingDesc}>ENVELO agent connectivity alerts</Text>
          </View>
          <Switch
            value={settings.agentStatus}
            onValueChange={(v) => updateSetting('agentStatus', v)}
            trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
            thumbColor={settings.agentStatus ? colors.purpleBright : colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EMAIL</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Marketing & Updates</Text>
            <Text style={styles.settingDesc}>News about Sentinel Authority</Text>
          </View>
          <Switch
            value={settings.marketingEmails}
            onValueChange={(v) => updateSetting('marketingEmails', v)}
            trackColor={{ false: colors.bgCardHover, true: colors.purpleBright + '60' }}
            thumbColor={settings.marketingEmails ? colors.purpleBright : colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Critical security and compliance notifications cannot be disabled and will always be sent to your registered email.
        </Text>
      </View>
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
  settingLabel: { color: colors.textPrimary, fontSize: 15 },
  settingDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  infoCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  infoText: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
});
