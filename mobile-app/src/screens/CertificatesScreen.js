import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { certificatesAPI, API_URL } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function CertificatesScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [certificates, setCertificates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);

  const loadCertificates = async () => {
    try {
      const res = await certificatesAPI.getAll();
      const certs = res.data || [];
      setCertificates(certs);
      setFiltered(certs);
    } catch (error) {
      console.log('Error loading certificates:', error);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFiltered(certificates);
    } else {
      const term = text.toLowerCase();
      setFiltered(certificates.filter(c => 
        c.certificate_number?.toLowerCase().includes(term) ||
        c.certificateId?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.system_name?.toLowerCase().includes(term)
      ));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCertificates();
    setRefreshing(false);
  };

  const downloadPDF = async (cert) => {
    const certNum = cert.certificate_number || cert.certificateId;
    const url = `${API_URL}/api/certificates/${certNum}/pdf`;
    Alert.alert(
      'Download Certificate',
      `Download PDF for certificate ${certNum}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => Linking.openURL(url) },
      ]
    );
  };

  const handleAction = async (action) => {
    if (!selectedCert) return;
    
    const certNum = selectedCert.certificate_number || selectedCert.certificateId;
    const actionLabels = {
      suspend: 'Suspend',
      revoke: 'Revoke',
      reinstate: 'Reinstate',
    };

    Alert.alert(
      `${actionLabels[action]} Certificate`,
      `Are you sure you want to ${action} certificate ${certNum}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: actionLabels[action], 
          style: action === 'reinstate' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const endpoint = `/api/certificates/${certNum}/${action}`;
              await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
              Alert.alert('Success', `Certificate ${action}ed successfully`);
              setActionModalVisible(false);
              setSelectedCert(null);
              loadCertificates();
            } catch (error) {
              Alert.alert('Error', `Failed to ${action} certificate`);
            }
          }
        },
      ]
    );
  };

  const openActionModal = (cert) => {
    setSelectedCert(cert);
    setActionModalVisible(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'issued':
        return colors.greenBright;
      case 'suspended':
        return colors.yellowBright;
      case 'revoked':
      case 'expired':
        return colors.redBright;
      default:
        return colors.textTertiary;
    }
  };

  const isExpired = (cert) => {
    const expiry = cert.expires_at || cert.expiresAt;
    return expiry && new Date(expiry) < new Date();
  };

  const renderItem = ({ item }) => {
    const certNum = item.certificate_number || item.certificateId;
    const status = isExpired(item) ? 'expired' : (item.status || 'active');
    const statusColor = getStatusColor(status);
    
    return (
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.cardHeader}>
          <View style={styles.certInfo}>
            <Text style={styles.certNumber}>{certNum}</Text>
            {isAdmin && (
              <Text style={styles.company}>{item.company || item.organization || 'Unknown'}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>System</Text>
            <Text style={styles.detailValue}>{item.system_name || item.systemName || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Issued</Text>
            <Text style={styles.detailValue}>
              {new Date(item.issued_at || item.issuedAt || item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={[styles.detailValue, isExpired(item) && { color: colors.redBright }]}>
              {new Date(item.expires_at || item.expiresAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => downloadPDF(item)}>
            <Ionicons name="download-outline" size={18} color={colors.purpleBright} />
            <Text style={styles.actionText}>PDF</Text>
          </TouchableOpacity>
          
          {!isAdmin && (
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => {
                const url = `https://www.sentinelauthority.org/#verify?cert=${certNum}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="share-outline" size={18} color={colors.purpleBright} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          )}
          
          {isAdmin && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal(item)}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.purpleBright} />
              <Text style={styles.actionText}>Actions</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search - Admin only */}
      {isAdmin && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search certificates..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.greenBright }]}>
            {certificates.filter(c => (c.status === 'active' || c.status === 'issued') && !isExpired(c)).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.yellowBright }]}>
            {certificates.filter(c => c.status === 'suspended').length}
          </Text>
          <Text style={styles.statLabel}>Suspended</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.redBright }]}>
            {certificates.filter(c => c.status === 'revoked' || isExpired(c)).length}
          </Text>
          <Text style={styles.statLabel}>Revoked/Expired</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => (item.certificate_number || item.certificateId || item.id)?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Certificates</Text>
            <Text style={styles.emptyText}>
              {isAdmin 
                ? 'No certificates have been issued yet' 
                : 'Complete CAT-72 testing to receive your ODDC certificate'}
            </Text>
          </View>
        }
      />

      {/* Admin Action Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setActionModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Certificate Actions</Text>
            <Text style={styles.modalCertNum}>
              {selectedCert?.certificate_number || selectedCert?.certificateId}
            </Text>

            {selectedCert?.status !== 'suspended' && selectedCert?.status !== 'revoked' && (
              <TouchableOpacity style={styles.modalAction} onPress={() => handleAction('suspend')}>
                <Ionicons name="pause-circle-outline" size={24} color={colors.yellowBright} />
                <View style={styles.modalActionInfo}>
                  <Text style={styles.modalActionTitle}>Suspend Certificate</Text>
                  <Text style={styles.modalActionDesc}>Temporarily disable this certificate</Text>
                </View>
              </TouchableOpacity>
            )}

            {selectedCert?.status !== 'revoked' && (
              <TouchableOpacity style={styles.modalAction} onPress={() => handleAction('revoke')}>
                <Ionicons name="close-circle-outline" size={24} color={colors.redBright} />
                <View style={styles.modalActionInfo}>
                  <Text style={styles.modalActionTitle}>Revoke Certificate</Text>
                  <Text style={styles.modalActionDesc}>Permanently invalidate this certificate</Text>
                </View>
              </TouchableOpacity>
            )}

            {(selectedCert?.status === 'suspended' || selectedCert?.status === 'revoked') && (
              <TouchableOpacity style={styles.modalAction} onPress={() => handleAction('reinstate')}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.greenBright} />
                <View style={styles.modalActionInfo}>
                  <Text style={styles.modalActionTitle}>Reinstate Certificate</Text>
                  <Text style={styles.modalActionDesc}>Restore this certificate to active status</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalAction} onPress={() => downloadPDF(selectedCert)}>
              <Ionicons name="download-outline" size={24} color={colors.purpleBright} />
              <View style={styles.modalActionInfo}>
                <Text style={styles.modalActionTitle}>Download PDF</Text>
                <Text style={styles.modalActionDesc}>Get the official certificate document</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCancel} 
              onPress={() => setActionModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  certInfo: { flex: 1 },
  certNumber: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  company: {
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
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
  details: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: { color: colors.textTertiary, fontSize: 13 },
  detailValue: { color: colors.textSecondary, fontSize: 13 },
  cardActions: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCertNum: {
    color: colors.textTertiary,
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bgCardHover,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  modalActionInfo: { marginLeft: spacing.md, flex: 1 },
  modalActionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  modalActionDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  modalCancel: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalCancelText: { color: colors.textTertiary, fontSize: 15 },
});
