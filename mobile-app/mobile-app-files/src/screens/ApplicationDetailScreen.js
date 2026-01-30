import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

const statusFlow = ['pending', 'approved', 'testing', 'issued'];

export default function ApplicationDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadApplication = async () => {
    try {
      const res = await applicationsAPI.getById(id);
      setApplication(res.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load application');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await applicationsAPI.updateStatus(id, newStatus);
      setApplication({ ...application, status: newStatus });
      Alert.alert('Success', `Application ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    const colors_map = {
      pending: colors.yellowBright,
      approved: colors.greenBright,
      testing: colors.purpleBright,
      issued: colors.greenBright,
      rejected: colors.redBright,
    };
    return colors_map[status] || colors.textTertiary;
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.purpleBright} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: getStatusColor(application.status) + '15' }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(application.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(application.status) }]}>
          {application.status?.toUpperCase()}
        </Text>
      </View>

      {/* Main Info */}
      <View style={styles.section}>
        <Text style={styles.systemName}>{application.systemName || 'Untitled'}</Text>
        <Text style={styles.company}>{application.company}</Text>
      </View>

      {/* Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ODD Description</Text>
        <Text style={styles.cardContent}>{application.oddDescription || 'No description'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Application Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Submitted</Text>
          <Text style={styles.detailValue}>
            {new Date(application.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Applicant</Text>
          <Text style={styles.detailValue}>{application.email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Application ID</Text>
          <Text style={[styles.detailValue, { fontFamily: 'monospace' }]}>
            {application.id?.substring(0, 12)}
          </Text>
        </View>
      </View>

      {/* Status Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress</Text>
        <View style={styles.timeline}>
          {statusFlow.map((status, i) => {
            const currentIdx = statusFlow.indexOf(application.status);
            const isComplete = i <= currentIdx;
            const isCurrent = i === currentIdx;
            
            return (
              <View key={status} style={styles.timelineItem}>
                <View style={[
                  styles.timelineDot,
                  isComplete && { backgroundColor: colors.greenBright },
                  isCurrent && { borderWidth: 2, borderColor: colors.purpleBright }
                ]} />
                {i < statusFlow.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    isComplete && i < currentIdx && { backgroundColor: colors.greenBright }
                  ]} />
                )}
                <Text style={[
                  styles.timelineText,
                  isComplete && { color: colors.textSecondary }
                ]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Admin Actions */}
      {user.role === 'admin' && application.status !== 'issued' && (
        <View style={styles.actions}>
          {application.status === 'pending' && (
            <>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => updateStatus('approved')}
                disabled={updating}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => updateStatus('rejected')}
                disabled={updating}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {application.status === 'approved' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={() => updateStatus('testing')}
              disabled={updating}
            >
              <Ionicons name="flask" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Start CAT-72</Text>
            </TouchableOpacity>
          )}
          {application.status === 'testing' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => updateStatus('issued')}
              disabled={updating}
            >
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Issue Certificate</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  section: {
    padding: spacing.md,
  },
  systemName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  company: {
    color: colors.textTertiary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  cardContent: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  detailLabel: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.borderMedium,
  },
  timelineLine: {
    position: 'absolute',
    top: 7,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: colors.borderSubtle,
  },
  timelineText: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  primaryBtn: {
    backgroundColor: colors.purpleBright,
  },
  approveBtn: {
    backgroundColor: colors.greenBright,
  },
  rejectBtn: {
    backgroundColor: colors.redBright,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});
