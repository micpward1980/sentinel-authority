import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

function StatusBadge({ status }) {
  const statusColors = {
    pending: colors.yellowBright,
    approved: colors.greenBright,
    testing: colors.purpleBright,
    issued: colors.greenBright,
    rejected: colors.redBright,
  };
  
  return (
    <View style={[styles.badge, { backgroundColor: (statusColors[status] || colors.textTertiary) + '20' }]}>
      <Text style={[styles.badgeText, { color: statusColors[status] || colors.textTertiary }]}>
        {status?.toUpperCase()}
      </Text>
    </View>
  );
}

export default function ApplicationsScreen({ navigation }) {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadApplications = async () => {
    try {
      const res = user.role === 'admin' 
        ? await applicationsAPI.getAll()
        : await applicationsAPI.getMine();
      setApplications(res.data || []);
    } catch (error) {
      console.log('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('ApplicationDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.systemName}>{item.systemName || 'Untitled System'}</Text>
        <StatusBadge status={item.status} />
      </View>
      
      <Text style={styles.description} numberOfLines={2}>
        {item.oddDescription || 'No description'}
      </Text>
      
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="business-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.footerText}>{item.company || 'N/A'}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.footerText}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="documents-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptyText}>Submit your first application to get started</Text>
            <TouchableOpacity 
              style={styles.newButton}
              onPress={() => navigation.navigate('NewApplication')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newButtonText}>New Application</Text>
            </TouchableOpacity>
          </View>
        }
      />
      
      {applications.length > 0 && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('NewApplication')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  list: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  systemName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  footerText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginLeft: spacing.xs,
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
  empty: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purpleBright,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.lg,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
