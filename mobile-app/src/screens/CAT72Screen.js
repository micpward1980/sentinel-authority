import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cat72API } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function CAT72Screen() {
  const [tests, setTests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    totalHours: 0,
  });

  const loadData = async () => {
    try {
      const res = await cat72API.getTests();
      const data = res.data || [];
      setTests(data);
      
      setStats({
        active: data.filter(s => s.status === 'active' || s.status === 'in_progress').length,
        completed: data.filter(s => s.status === 'completed' || s.status === 'passed').length,
        failed: data.filter(s => s.status === 'failed').length,
        totalHours: data.reduce((sum, s) => sum + (s.hours_completed || s.hoursCompleted || 0), 0),
      });
    } catch (error) {
      console.log('Error loading CAT-72 data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return colors.greenBright;
      case 'completed':
      case 'passed':
        return colors.purpleBright;
      case 'failed':
        return colors.redBright;
      default:
        return colors.textTertiary;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>CAT-72 Console</Text>
        <Text style={styles.subtitle}>Continuous Autonomous Testing • 72 Hours</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.greenBright }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.purpleBright }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.redBright }]}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalHours}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
      </View>

      {/* Active Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE TESTS</Text>
        {tests.filter(s => s.status === 'active' || s.status === 'in_progress').length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="flask-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No active CAT-72 tests</Text>
            <Text style={styles.emptySubtext}>Tests begin when applicants deploy their ENVELO agent</Text>
          </View>
        ) : (
          tests.filter(s => s.status === 'active' || s.status === 'in_progress').map((test, i) => (
            <View key={test.id || i} style={styles.testCard}>
              <View style={styles.testHeader}>
                <View style={styles.testInfo}>
                  <Text style={styles.testCompany}>{test.company || test.organization || 'Unknown'}</Text>
                  <Text style={styles.testSystem}>{test.system_name || test.systemName || 'System'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.greenDim }]}>
                  <View style={[styles.statusDot, { backgroundColor: colors.greenBright }]} />
                  <Text style={[styles.statusText, { color: colors.greenBright }]}>ACTIVE</Text>
                </View>
              </View>
              
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{test.hours_completed || test.hoursCompleted || 0}/72 hrs</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${((test.hours_completed || test.hoursCompleted || 0) / 72) * 100}%` }]} />
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{test.total_events || test.totalEvents || 0}</Text>
                  <Text style={styles.metricLabel}>Events</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.redBright }]}>{test.blocked_actions || test.blockedActions || 0}</Text>
                  <Text style={styles.metricLabel}>Blocked</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.greenBright }]}>{test.compliance_rate || test.complianceRate || 100}%</Text>
                  <Text style={styles.metricLabel}>Compliant</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Completed Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COMPLETED</Text>
        {tests.filter(s => s.status === 'completed' || s.status === 'passed').length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No completed tests yet</Text>
          </View>
        ) : (
          tests.filter(s => s.status === 'completed' || s.status === 'passed').slice(0, 5).map((test, i) => (
            <View key={test.id || i} style={styles.completedCard}>
              <View style={styles.completedInfo}>
                <Text style={styles.completedCompany}>{test.company || test.organization || 'Unknown'}</Text>
                <Text style={styles.completedDate}>
                  {new Date(test.completed_at || test.completedAt || test.updated_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.purpleDim + '30' }]}>
                <Text style={[styles.statusText, { color: colors.purpleBright }]}>PASSED</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Failed Tests */}
      {tests.filter(s => s.status === 'failed').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FAILED</Text>
          {tests.filter(s => s.status === 'failed').map((test, i) => (
            <View key={test.id || i} style={[styles.completedCard, { borderLeftColor: colors.redBright }]}>
              <View style={styles.completedInfo}>
                <Text style={styles.completedCompany}>{test.company || test.organization || 'Unknown'}</Text>
                <Text style={styles.completedDate}>{test.failure_reason || 'Compliance threshold not met'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.redDim }]}>
                <Text style={[styles.statusText, { color: colors.redBright }]}>FAILED</Text>
              </View>
            </View>
          ))}
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
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.bgCard,
    marginHorizontal: 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
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
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  testCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.greenBright + '30',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  testInfo: {
    flex: 1,
  },
  testCompany: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  testSystem: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  progressValue: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.bgCardHover,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.greenBright,
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  completedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.purpleBright,
  },
  completedInfo: {
    flex: 1,
  },
  completedCompany: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  completedDate: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
});
