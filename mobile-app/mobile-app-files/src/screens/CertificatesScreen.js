import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { certificatesAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function CertificatesScreen() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCertificates = async () => {
    try {
      const res = user.role === 'admin' 
        ? await certificatesAPI.getAll()
        : await certificatesAPI.getMine();
      setCertificates(res.data || []);
    } catch (error) {
      console.log('Error loading certificates:', error);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCertificates();
    setRefreshing(false);
  };

  const shareCertificate = async (cert) => {
    try {
      await Share.share({
        message: `ODDC Certificate: ${cert.certificateId}\nVerify at: https://www.sentinelauthority.org/#verify`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const renderItem = ({ item }) => {
    const isActive = item.status === 'issued' || item.status === 'active';
    const isExpired = new Date(item.expiresAt) < new Date();
    
    return (
      <View style={[styles.card, isActive && styles.cardActive]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: isExpired ? colors.redBright : colors.greenBright }]} />
          <Text style={styles.certId}>{item.certificateId}</Text>
        </View>
        
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>System</Text>
          <Text style={styles.detailValue}>{item.systemName || 'N/A'}</Text>
        </View>
        
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Issued</Text>
          <Text style={styles.detailValue}>{new Date(item.issuedAt).toLocaleDateString()}</Text>
        </View>
        
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Expires</Text>
          <Text style={[styles.detailValue, isExpired && { color: colors.redBright }]}>
            {new Date(item.expiresAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => shareCertificate(item)}>
            <Ionicons name="share-outline" size={18} color={colors.purpleBright} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="download-outline" size={18} color={colors.purpleBright} />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={certificates}
        renderItem={renderItem}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Certificates</Text>
            <Text style={styles.emptyText}>Complete CAT-72 testing to receive your ODDC certificate</Text>
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
  cardActive: {
    borderColor: colors.greenBright + '40',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  certId: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  actionText: {
    color: colors.purpleBright,
    fontSize: 13,
    marginLeft: spacing.xs,
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
});
