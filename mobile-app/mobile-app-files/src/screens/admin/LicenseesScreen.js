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
import { licenseesAPI, certificatesAPI } from '../../api';
import { colors, spacing, borderRadius } from '../../styles/theme';

export default function LicenseesScreen() {
  const [licensees, setLicensees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadLicensees = async () => {
    try {
      // Get all certificates and group by company
      const res = await certificatesAPI.getAll();
      const certs = res.data || [];
      
      // Group by company
      const grouped = certs.reduce((acc, cert) => {
        const company = cert.company || 'Unknown';
        if (!acc[company]) {
          acc[company] = {
            company,
            email: cert.email,
            certificates: [],
            activeCerts: 0,
          };
        }
        acc[company].certificates.push(cert);
        if (cert.status === 'issued' || cert.status === 'active') {
          acc[company].activeCerts++;
        }
        return acc;
      }, {});

      const list = Object.values(grouped);
      setLicensees(list);
      setFiltered(list);
    } catch (error) {
      console.log('Error loading licensees:', error);
    }
  };

  useEffect(() => {
    loadLicensees();
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFiltered(licensees);
    } else {
      const term = text.toLowerCase();
      setFiltered(licensees.filter(l => 
        l.company?.toLowerCase().includes(term) ||
        l.email?.toLowerCase().includes(term)
      ));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLicensees();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.company?.[0] || '?'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.company}>{item.company}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.certificates?.length || 0}</Text>
          <Text style={styles.statLabel}>Total Certs</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.greenBright }]}>{item.activeCerts}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statusIndicator, { backgroundColor: item.activeCerts > 0 ? colors.greenBright : colors.textTertiary }]} />
          <Text style={styles.statLabel}>{item.activeCerts > 0 ? 'Compliant' : 'Inactive'}</Text>
        </View>
      </View>

      {item.certificates?.length > 0 && (
        <View style={styles.certList}>
          <Text style={styles.certListTitle}>Certificates</Text>
          {item.certificates.slice(0, 3).map((cert, i) => (
            <View key={cert.id || i} style={styles.certItem}>
              <Text style={styles.certId}>{cert.certificateId}</Text>
              <View style={[
                styles.certStatus,
                { backgroundColor: (cert.status === 'issued' || cert.status === 'active') ? colors.greenDim : colors.redDim }
              ]}>
                <Text style={[
                  styles.certStatusText,
                  { color: (cert.status === 'issued' || cert.status === 'active') ? colors.greenBright : colors.redBright }
                ]}>
                  {cert.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
          {item.certificates.length > 3 && (
            <Text style={styles.moreText}>+{item.certificates.length - 3} more</Text>
          )}
        </View>
      )}
    </View>
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
          placeholder="Search licensees..."
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filtered.length} licensee{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.company + index}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No licensees found</Text>
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
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purpleBright,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  company: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  certList: {
    marginTop: spacing.md,
  },
  certListTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  certItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  certId: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  certStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  certStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  moreText: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: spacing.xs,
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
