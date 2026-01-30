import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applicationsAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function NewApplicationScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    systemName: '',
    oddDescription: '',
    oddBoundary: '',
    sensorTypes: '',
    actuatorTypes: '',
    failsafeDescription: '',
  });

  const updateForm = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleSubmit = async () => {
    if (!form.systemName || !form.oddDescription) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      await applicationsAPI.create(form);
      Alert.alert(
        'Success',
        'Application submitted successfully. You will be notified when it is reviewed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="document-text-outline" size={32} color={colors.purpleBright} />
          <Text style={styles.headerTitle}>New ODDC Application</Text>
          <Text style={styles.headerSubtitle}>
            Submit your autonomous system for conformance determination
          </Text>
        </View>

        {/* System Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM INFORMATION</Text>
          
          <Text style={styles.label}>System Name *</Text>
          <TextInput
            style={styles.input}
            value={form.systemName}
            onChangeText={(v) => updateForm('systemName', v)}
            placeholder="e.g., AutoPilot Delivery Robot v2.1"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>ODD Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.oddDescription}
            onChangeText={(v) => updateForm('oddDescription', v)}
            placeholder="Describe the operational design domain including environment, conditions, and constraints..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>ODD Boundary Specification</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.oddBoundary}
            onChangeText={(v) => updateForm('oddBoundary', v)}
            placeholder="Define the specific boundaries: geographic limits, speed ranges, weather conditions, etc."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Technical Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TECHNICAL DETAILS</Text>
          
          <Text style={styles.label}>Sensor Types</Text>
          <TextInput
            style={styles.input}
            value={form.sensorTypes}
            onChangeText={(v) => updateForm('sensorTypes', v)}
            placeholder="e.g., LIDAR, Camera, Radar, GPS"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>Actuator Types</Text>
          <TextInput
            style={styles.input}
            value={form.actuatorTypes}
            onChangeText={(v) => updateForm('actuatorTypes', v)}
            placeholder="e.g., Motors, Brakes, Steering"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>Failsafe Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.failsafeDescription}
            onChangeText={(v) => updateForm('failsafeDescription', v)}
            placeholder="Describe the system's failsafe mechanisms and minimal risk condition..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.purpleBright} />
          <Text style={styles.infoText}>
            After submission, your application will be reviewed within 5-10 business days. 
            Upon approval, you'll receive instructions for ENVELO agent deployment and CAT-72 testing.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Submit Application</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  headerSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.purpleBright + '10',
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.purpleBright + '30',
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    marginLeft: spacing.sm,
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleBright,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
});
