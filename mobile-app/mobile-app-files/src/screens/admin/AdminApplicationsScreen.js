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
import { applicationsAPI } from '../../api';
import { colors, spacing, borderRadius } from '../../styles/theme';

export default function AdminApplicationsScreen({ navigation }) {
  const [applications, setApplications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadApplications = async () => {
    try {
      const res = await applicationsAPI.getAll();
      setApplications(res.data || []);
      filterApps(res.data || [], search, statusFilter);
    } catch (error) {
      console.log('Error loading applications:', error);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const filterApps = (apps, searchTerm, status) => {
    let result = apps;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.systemName?.toLowerCase().includes(term) ||
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
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

  const statusOptions = ['all', 'pending', 'approved', 'testing', 'issued', 'rejected'];

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('ApplicationDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={styles.systemName} numberOfLines={1}>{item.systemName || 'Untitled'}</Text>
      </View>
      
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.metaText}>{item.company}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="mail-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.metaText}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
            {item.status?.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

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

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filtered.length} application{filtered.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (${statusFilter})`}
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
            <Text style={styles.emptyText}>No applications found</Text>
          </View>
        }
      />
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  systemName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  date: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
