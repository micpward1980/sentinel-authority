import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI, cat72API } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';
import { API_URL } from '../api';

export default function ApplicationDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [application, setApplication] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadApplication = async () => {
    try {
      const res = await applicationsAPI.getById(id);
      setApplication(res.data);
    } catch (error) {
      console.log('Error loading application:', error);
      Alert.alert('Error', 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApplication();
    setRefreshing(false);
  };

  const updateStatus = async (newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/applications/${id}/state`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ state: newStatus }),
      });
      
      if (response.ok) {
        Alert.alert('Success', `Application ${newStatus}`);
        setStatusModalVisible(false);
        loadApplication();
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update application status');
    }
  };

  const getToken = async () => {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync('token');
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Application',
      'This will approve the application and allow the applicant to deploy their ENVELO agent for CAT-72 testing.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => updateStatus('approved') },
      ]
    );
  };

  const handleStartTesting = async () => {
    Alert.alert(
      'Start CAT-72 Testing',
      'This will initiate the 72-hour continuous autonomous testing period.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Testing', 
          onPress: async () => {
            try {
              // Create CAT-72 test for this application
              await fetch(`${API_URL}/api/cat72/tests`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ application_id: id }),
              });
              await updateStatus('testing');
            } catch (error) {
              Alert.alert('Error', 'Failed to start CAT-72 testing');
            }
          }
        },
      ]
    );
  };

  const handleReject = () => {
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }
    
    try {
      await fetch(`${API_URL}/api/applications/${id}/state`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ state: 'rejected', rejection_reason: rejectReason }),
      });
      
      Alert.alert('Rejected', 'Application has been rejected');
      setRejectModalVisible(false);
      setRejectReason('');
      loadApplication();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject application');
    }
  };

  const handleIssueCertificate = async () => {
    Alert.alert(
      'Issue Certificate',
      'This will issue an ODDC certificate for this system. The applicant will be notified immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Issue Certificate', 
          onPress: async () => {
            try {
              // Find the CAT-72 test for this application and issue certificate
              const testsRes = await cat72API.getTests();
              const test = (testsRes.data || []).find(t => 
                t.application_id === id || t.applicationId === id
              );
              
              if (test) {
                await fetch(`${API_URL}/api/certificates/issue/${test.id}`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`,
                  },
                });
              }
              
              await updateStatus('issued');
              Alert.alert('Success', 'Certificate issued successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to issue certificate');
            }
          }
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.yellowBright;
      case 'approved': return colors.greenBright;
      case 'testing': return colors.purpleBright;
      case 'issued': return colors.greenBright;
      case 'rejected': return colors.redBright;
      default: return colors.textTertiary;
    }
  };

  const getStatusActions = () => {
    if (!isAdmin) return null;
    
    const status = application?.status || application?.state;
    
    switch (status) {
      case 'pending':
        return (
          <View style={styles.adminActions}>
            <Text style={styles.adminActionsTitle}>ADMIN ACTIONS</Text>
            <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.approveBtnText}>Approve Application</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
              <Ionicons name="close-circle" size={20} color={colors.redBright} />
              <Text style={styles.rejectBtnText}>Reject Application</Text>
            </TouchableOpacity>
          </View>
        );
      case 'approved':
        return (
          <View style={styles.adminActions}>
            <Text style={styles.adminActionsTitle}>ADMIN ACTIONS</Text>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.purpleBright} />
              <Text style={styles.infoBoxText}>
                Waiting for applicant to deploy ENVELO agent. Once deployed, you can start CAT-72 testing.
              </Text>
            </View>
            <TouchableOpacity style={styles.testingBtn} onPress={handleStartTesting}>
              <Ionicons name="flask" size={20} color="#fff" />
              <Text style={styles.testingBtnText}>Start CAT-72 Testing</Text>
            </TouchableOpacity>
          </View>
        );
      case 'testing':
        return (
          <View style={styles.adminActions}>
            <Text style={styles.adminActionsTitle}>ADMIN ACTIONS</Text>
            <View style={styles.testingStatus}>
              <View style={styles.testingIndicator}>
                <View style={styles.testingDot} />
                <Text style={styles.testingLabel}>CAT-72 In Progress</Text>
              </View>
              <TouchableOpacity 
                style={styles.viewTestBtn}
                onPress={() => navigation.navigate('CAT72')}
              >
                <Text style={styles.viewTestBtnText}>View in Console →</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.issueBtn} onPress={handleIssueCertificate}>
              <Ionicons name="ribbon" size={20} color="#fff" />
              <Text style={styles.issueBtnText}>Issue Certificate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
              <Ionicons name="close-circle" size={20} color={colors.redBright} />
              <Text style={styles.rejectBtnText}>Fail & Reject</Text>
            </TouchableOpacity>
          </View>
        );
      case 'issued':
        return (
          <View style={styles.adminActions}>
            <Text style={styles.adminActionsTitle}>STATUS</Text>
            <View style={styles.issuedStatus}>
              <Ionicons name="checkmark-circle" size={24} color={colors.greenBright} />
              <Text style={styles.issuedText}>Certificate Issued</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewCertBtn}
              onPress={() => navigation.navigate('Certificates')}
            >
              <Text style={styles.viewCertBtnText}>View Certificate →</Text>
            </TouchableOpacity>
          </View>
        );
      case 'rejected':
        return (
          <View style={styles.adminActions}>
            <Text style={styles.adminActionsTitle}>STATUS</Text>
            <View style={styles.rejectedStatus}>
              <Ionicons name="close-circle" size={24} color={colors.redBright} />
              <Text style={styles.rejectedText}>Application Rejected</Text>
            </View>
            {application?.rejection_reason && (
              <Text style={styles.rejectionReason}>
                Reason: {application.rejection_reason}
              </Text>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Application not found</Text>
      </View>
    );
  }

  const status = application.status || application.state || 'pending';

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.systemName}>
            {application.system_name || application.systemName || 'Untitled System'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>
        {isAdmin && (
          <View style={styles.applicantInfo}>
            <Text style={styles.applicantLabel}>Applicant</Text>
            <Text style={styles.applicantName}>{application.company || application.organization || 'N/A'}</Text>
            <Text style={styles.applicantEmail}>{application.email || application.applicant_email || 'N/A'}</Text>
          </View>
        )}
      </View>

      {/* Admin Actions */}
      {getStatusActions()}

      {/* ODD Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ODD SPECIFICATION</Text>
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>
              {application.odd_description || application.oddDescription || 'No description provided'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Geographic Bounds</Text>
            <Text style={styles.detailValue}>
              {application.geographic_bounds || application.geographicBounds || 'Not specified'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Speed Limits</Text>
            <Text style={styles.detailValue}>
              {application.speed_limits || application.speedLimits || 'Not specified'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Weather Conditions</Text>
            <Text style={styles.detailValue}>
              {application.weather_conditions || application.weatherConditions || 'Not specified'}
            </Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Time Restrictions</Text>
            <Text style={styles.detailValue}>
              {application.time_restrictions || application.timeRestrictions || 'None'}
            </Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIMELINE</Text>
        <View style={styles.card}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: colors.greenBright }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Submitted</Text>
              <Text style={styles.timelineDate}>
                {new Date(application.created_at || application.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>
          {(status === 'approved' || status === 'testing' || status === 'issued') && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.greenBright }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Approved</Text>
                <Text style={styles.timelineDate}>
                  {application.approved_at ? new Date(application.approved_at).toLocaleString() : 'Date not recorded'}
                </Text>
              </View>
            </View>
          )}
          {(status === 'testing' || status === 'issued') && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: status === 'testing' ? colors.purpleBright : colors.greenBright }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>CAT-72 Testing</Text>
                <Text style={styles.timelineDate}>
                  {status === 'testing' ? 'In progress...' : 'Completed'}
                </Text>
              </View>
            </View>
          )}
          {status === 'issued' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.greenBright }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Certificate Issued</Text>
                <Text style={styles.timelineDate}>
                  {application.issued_at ? new Date(application.issued_at).toLocaleString() : 'Date not recorded'}
                </Text>
              </View>
            </View>
          )}
          {status === 'rejected' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.redBright }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Rejected</Text>
                <Text style={styles.timelineDate}>
                  {application.rejected_at ? new Date(application.rejected_at).toLocaleString() : 'Date not recorded'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejection. This will be shared with the applicant.
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Enter rejection reason..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.confirmRejectBtn} onPress={confirmReject}>
              <Text style={styles.confirmRejectBtnText}>Confirm Rejection</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => {
                setRejectModalVisible(false);
                setRejectReason('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgDeep },
  loadingText: { color: colors.textTertiary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgDeep },
  errorText: { color: colors.textTertiary },
  
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  systemName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  applicantInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  applicantLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 1 },
  applicantName: { color: colors.textPrimary, fontSize: 16, fontWeight: '500', marginTop: 4 },
  applicantEmail: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },

  // Admin Actions
  adminActions: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.purpleBright + '30',
  },
  adminActionsTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenBright,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  approveBtnText: { color: '#fff', fontWeight: '600', marginLeft: spacing.sm },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redDim,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.redBright + '30',
  },
  rejectBtnText: { color: colors.redBright, fontWeight: '600', marginLeft: spacing.sm },
  testingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleBright,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  testingBtnText: { color: '#fff', fontWeight: '600', marginLeft: spacing.sm },
  issueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenBright,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  issueBtnText: { color: '#fff', fontWeight: '600', marginLeft: spacing.sm },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.purpleDim + '20',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  infoBoxText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  testingStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  testingIndicator: { flexDirection: 'row', alignItems: 'center' },
  testingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.purpleBright,
    marginRight: spacing.sm,
  },
  testingLabel: { color: colors.purpleBright, fontWeight: '600' },
  viewTestBtn: {},
  viewTestBtnText: { color: colors.purpleBright, fontSize: 13 },
  issuedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  issuedText: { color: colors.greenBright, fontSize: 16, fontWeight: '600', marginLeft: spacing.sm },
  viewCertBtn: { marginTop: spacing.md },
  viewCertBtnText: { color: colors.purpleBright, fontSize: 14 },
  rejectedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectedText: { color: colors.redBright, fontSize: 16, fontWeight: '600', marginLeft: spacing.sm },
  rejectionReason: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },

  // Sections
  section: { margin: spacing.md },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  detailLabel: { color: colors.textTertiary, fontSize: 12, marginBottom: 4 },
  detailValue: { color: colors.textPrimary, fontSize: 14 },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: spacing.md,
  },
  timelineContent: { flex: 1 },
  timelineLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  timelineDate: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  reasonInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 100,
  },
  confirmRejectBtn: {
    backgroundColor: colors.redBright,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmRejectBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: { color: colors.textTertiary, fontSize: 15 },
});
