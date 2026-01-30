import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
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
  const isAdmin = user?.role === 'admin';
  const [applications, setApplications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadApplications = async () => {
    try {
      const res = await applicationsAPI.getAll();
      const apps = res.data || [];
      setApplications(apps);
      filterApps(apps, search, statusFilter);
    } catch (error) {
      console.log('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterApps = (apps, searchTerm, status) => {
    let result = apps;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.systemName?.toLowerCase().includes(term) ||
        a.system_name?.toLowerCase().includes(term) ||
        a.company?.toLowerCase().includes(term) ||
        a.email?.toLowerCase().includes(term)
      );
    }
    if (status !== 'all') {
      result = result.filter(a => a.status === status);
    }
    setFiltered(result);
  };

  const handleSearch = (text) => {
    setSearch(text);
    filterApps(applications, text, statusFilter);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    filterApps(applications, search, status);
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  };

  const statusOptions = ['all', 'pending', 'approved', 'testing', 'issued', 'rejected'];

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('ApplicationDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.systemName} numberOfLines={1}>
          {item.systemName || item.system_name || 'Untitled System'}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      
      {isAdmin && (
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.metaText}>{item.company || 'N/A'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="mail-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.metaText}>{item.email || item.applicant_email || 'N/A'}</Text>
          </View>
        </View>
      )}
      
      <Text style={styles.description} numberOfLines={2}>
        {item.oddDescription || item.odd_description || 'No description'}
      </Text>
      
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.footerText}>
            {new Date(item.createdAt || item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  // Admin View - with search and filters
  if (isAdmin) {
    return (
      <View style={styles.container}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search applications..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Status Filters */}
        <FlatList
          horizontal
          data={statusOptions}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterBtn, statusFilter === item && styles.filterBtnActive]}
              onPress={() => handleStatusFilter(item)}
            >
              <Text style={[styles.filterText, statusFilter === item && styles.filterTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Stats */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {filtered.length} application{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && ` • ${statusFilter}`}
          </Text>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
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
              <Text style={styles.emptyText}>No applications match your criteria</Text>
            </View>
          }
        />
      </View>
    );
  }

  // Customer View - simpler, with new application button
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  filterList: {
    maxHeight: 50,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterBtnActive: {
    backgroundColor: colors.purpleBright + '20',
    borderColor: colors.purpleBright,
  },
  filterText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  filterTextActive: {
    color: colors.purpleBright,
    fontWeight: '600',
  },
  statsBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statsText: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
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
  cardMeta: {
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginLeft: spacing.xs,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: spacing.xl,
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
