import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agentAPI, applicationsAPI, certificatesAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function MonitoringScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalEvents: 0,
    blockedActions: 0,
    complianceRate: 100,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  const loadData = async () => {
    try {
      const [sessionsRes, appsRes, certsRes] = await Promise.all([
        agentAPI.getSessions(),
        applicationsAPI.getAll(),
        certificatesAPI.getAll(),
      ]);

      const sessions = sessionsRes.data || [];
      const apps = appsRes.data || [];
      const certs = certsRes.data || [];

      // Calculate stats
      const activeSessions = sessions.filter(s => s.status === 'active').length;
      const totalEvents = sessions.reduce((sum, s) => sum + (s.totalEvents || 0), 0);
      const blockedActions = sessions.reduce((sum, s) => sum + (s.blockedActions || 0), 0);
      const complianceRate = totalEvents > 0 
        ? Math.round(((totalEvents - blockedActions) / totalEvents) * 100) 
        : 100;

      setStats({
        totalSessions: sessions.length,
        activeSessions,
        totalEvents,
        blockedActions,
        complianceRate,
        totalApps: apps.length,
        pendingApps: apps.filter(a => a.status === 'pending').length,
        activeCerts: certs.filter(c => c.status === 'issued' || c.status === 'active').length,
      });

      // Build recent activity
      const activity = [
        ...apps.slice(0, 3).map(a => ({
          type: 'application',
          title: `Application: ${a.systemName || 'Untitled'}`,
          status: a.status,
          time: a.createdAt,
        })),
        ...sessions.slice(0, 3).map(s => ({
          type: 'session',
          title: `CAT-72 Session`,
          status: s.status,
          time: s.startedAt,
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

      setRecentActivity(activity);
    } catch (error) {
      console.log('Error loading monitoring data:', error);
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
    const map = {
      active: colors.greenBright,
      completed: colors.purpleBright,
      pending: colors.yellowBright,
      approved: colors.greenBright,
      testing: colors.purpleBright,
      failed: colors.redBright,
      rejected: colors.redBright,
    };
    return map[status] || colors.textTertiary;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      {/* System Health */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM HEALTH</Text>
        <View style={styles.healthCard}>
          <View style={styles.healthIndicator}>
            <View style={[styles.healthDot, { backgroundColor: colors.greenBright }]} />
            <Text style={styles.healthText}>All Systems Operational</Text>
          </View>
          <Text style={styles.healthTime}>Last checked: just now</Text>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KEY METRICS</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="flask-outline" size={24} color={colors.purpleBright} />
            <Text style={styles.metricValue}>{stats.activeSessions}</Text>
            <Text style={styles.metricLabel}>Active Sessions</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.greenBright} />
            <Text style={[styles.metricValue, { color: colors.greenBright }]}>{stats.complianceRate}%</Text>
            <Text style={styles.metricLabel}>Compliance Rate</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="documents-outline" size={24} color={colors.yellowBright} />
            <Text style={styles.metricValue}>{stats.pendingApps || 0}</Text>
            <Text style={styles.metricLabel}>Pending Apps</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="ribbon-outline" size={24} color={colors.greenBright} />
            <Text style={styles.metricValue}>{stats.activeCerts || 0}</Text>
            <Text style={styles.metricLabel}>Active Certs</Text>
          </View>
        </View>
      </View>

      {/* Event Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EVENT STATISTICS</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Events Processed</Text>
            <Text style={styles.statValue}>{stats.totalEvents.toLocaleString()}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Actions Blocked</Text>
            <Text style={[styles.statValue, { color: colors.redBright }]}>{stats.blockedActions.toLocaleString()}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total CAT-72 Sessions</Text>
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        {recentActivity.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          recentActivity.map((item, i) => (
            <View key={i} style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: getStatusColor(item.status) }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityTime}>
                  {new Date(item.time).toLocaleString()}
                </Text>
              </View>
              <View style={[styles.activityBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.activityStatus, { color: getStatusColor(item.status) }]}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  healthCard: {
    backgroundColor: colors.greenDim,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.greenBright + '30',
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  healthText: {
    color: colors.greenBright,
    fontWeight: '600',
  },
  healthTime: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  metricCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
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
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitle: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  activityTime: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  activityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  activityStatus: {
    fontSize: 9,
    fontWeight: '600',
  },
});
