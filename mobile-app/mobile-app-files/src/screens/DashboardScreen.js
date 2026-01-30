import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI, certificatesAPI, agentAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

function StatCard({ label, value, icon, color = colors.purpleBright }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const statusColors = {
    pending: colors.yellowBright,
    approved: colors.greenBright,
    testing: colors.purpleBright,
    issued: colors.greenBright,
    active: colors.greenBright,
    rejected: colors.redBright,
    suspended: colors.redBright,
  };
  
  return (
    <View style={[styles.badge, { backgroundColor: statusColors[status] + '20' }]}>
      <Text style={[styles.badgeText, { color: statusColors[status] }]}>
        {status?.toUpperCase()}
      </Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    applications: 0,
    certificates: 0,
    sessions: 0,
    activeAgents: 0,
  });
  const [recentApps, setRecentApps] = useState([]);
  const [recentCerts, setRecentCerts] = useState([]);

  const loadData = async () => {
    try {
      const [appsRes, certsRes] = await Promise.all([
        user.role === 'admin' ? applicationsAPI.getAll() : applicationsAPI.getMine(),
        user.role === 'admin' ? certificatesAPI.getAll() : certificatesAPI.getMine(),
      ]);
      
      const apps = appsRes.data || [];
      const certs = certsRes.data || [];
      
      setStats({
        applications: apps.length,
        certificates: certs.filter(c => c.status === 'issued' || c.status === 'active').length,
        pending: apps.filter(a => a.status === 'pending').length,
        testing: apps.filter(a => a.status === 'testing').length,
      });
      
      setRecentApps(apps.slice(0, 3));
      setRecentCerts(certs.slice(0, 3));
    } catch (error) {
      console.log('Error loading dashboard:', error);
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

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.company || user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard 
          label="Applications" 
          value={stats.applications} 
          icon="documents-outline"
          color={colors.purpleBright}
        />
        <StatCard 
          label="Certificates" 
          value={stats.certificates} 
          icon="shield-checkmark-outline"
          color={colors.greenBright}
        />
        <StatCard 
          label="Pending" 
          value={stats.pending} 
          icon="time-outline"
          color={colors.yellowBright}
        />
        <StatCard 
          label="Testing" 
          value={stats.testing} 
          icon="flask-outline"
          color={colors.purpleBright}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Applications</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Applications')}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        {recentApps.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="documents-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No applications yet</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('NewApplication')}
            >
              <Text style={styles.emptyButtonText}>Submit Application</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentApps.map((app, i) => (
            <TouchableOpacity 
              key={app.id || i} 
              style={styles.listItem}
              onPress={() => navigation.navigate('ApplicationDetail', { id: app.id })}
            >
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{app.systemName || 'Untitled'}</Text>
                <Text style={styles.listItemSub}>{app.oddDescription?.substring(0, 50)}...</Text>
              </View>
              <StatusBadge status={app.status} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Certificates</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Certificates')}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        {recentCerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No certificates issued</Text>
          </View>
        ) : (
          recentCerts.map((cert, i) => (
            <View key={cert.id || i} style={styles.listItem}>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{cert.certificateId}</Text>
                <Text style={styles.listItemSub}>Expires: {new Date(cert.expiresAt).toLocaleDateString()}</Text>
              </View>
              <StatusBadge status={cert.status} />
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
  welcomeCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  welcomeText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  roleBadge: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.purpleBright + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    color: colors.purpleBright,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  statCard: {
    width: '47%',
    margin: '1.5%',
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    margin: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  viewAll: {
    color: colors.purpleBright,
    fontSize: 13,
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
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.purpleBright,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listItem: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  listItemContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  listItemTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  listItemSub: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
