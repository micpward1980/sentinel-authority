import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { agentAPI, applicationsAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function AgentScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [refreshing, setRefreshing] = useState(false);
  const [approvedApp, setApprovedApp] = useState(null);
  const [agentStatus, setAgentStatus] = useState('not_deployed'); // not_deployed, pending, active, reporting
  const [session, setSession] = useState(null);
  const [allSessions, setAllSessions] = useState([]);

  const loadData = async () => {
    try {
      if (isAdmin) {
        // Admin sees all sessions
        const sessionsRes = await agentAPI.getSessions();
        setAllSessions(sessionsRes.data || []);
      } else {
        // Customer sees their approved app and agent status
        const appsRes = await applicationsAPI.getMine();
        const apps = appsRes.data || [];
        const approved = apps.find(a => a.status === 'approved' || a.status === 'testing' || a.status === 'issued');
        setApprovedApp(approved);

        if (approved) {
          const sessionsRes = await agentAPI.getSessions();
          const sessions = sessionsRes.data || [];
          const mySession = sessions.find(s => s.applicationId === approved.id || s.application_id === approved.id);
          if (mySession) {
            setSession(mySession);
            setAgentStatus(mySession.status === 'active' ? 'reporting' : 'active');
          } else if (approved.status === 'approved') {
            setAgentStatus('pending');
          }
        }
      }
    } catch (error) {
      console.log('Error loading agent data:', error);
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

  const handleDownload = () => {
    Alert.alert(
      'Download Agent',
      'Your pre-configured ENVELO agent package will be downloaded. This agent is locked to your approved ODD specification.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => Linking.openURL('https://www.sentinelauthority.org/downloads/envelo-agent') },
      ]
    );
  };

  // Admin View
  if (isAdmin) {
    return (
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>ENVELO Agent Management</Text>
          <Text style={styles.subtitle}>Monitor deployed agents across all licensees</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.greenBright }]}>
              {allSessions.filter(s => s.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{allSessions.length}</Text>
            <Text style={styles.statLabel}>Total Deployed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEPLOYED AGENTS</Text>
          {allSessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No agents deployed yet</Text>
            </View>
          ) : (
            allSessions.map((s, i) => (
              <View key={s.id || i} style={styles.agentCard}>
                <View style={styles.agentHeader}>
                  <View style={[styles.statusDot, { backgroundColor: s.status === 'active' ? colors.greenBright : colors.textTertiary }]} />
                  <Text style={styles.agentCompany}>{s.company || 'Unknown'}</Text>
                </View>
                <View style={styles.agentMeta}>
                  <Text style={styles.agentMetaText}>{s.systemName || 'System'}</Text>
                  <Text style={styles.agentMetaText}>{s.hoursCompleted || 0}/72 hrs</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Customer View - No approved application yet
  if (!approvedApp) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="cube-outline" size={48} color={colors.purpleBright} />
          </View>
          <Text style={styles.title}>ENVELO Agent</Text>
          <Text style={styles.subtitle}>Enforcer for Non-Violable Execution & Limit Oversight</Text>
        </View>

        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textTertiary} />
          <Text style={styles.lockedTitle}>Agent Not Available</Text>
          <Text style={styles.lockedText}>
            Your ENVELO agent will be available once your application is approved. The agent is pre-configured to your specific ODD specification.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What is ENVELO?</Text>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.purpleBright} />
            <Text style={styles.infoText}>Hardware-enforced boundary compliance</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.purpleBright} />
            <Text style={styles.infoText}>Tamper-proof, pre-configured to your ODD</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="analytics-outline" size={20} color={colors.purpleBright} />
            <Text style={styles.infoText}>Continuous monitoring during CAT-72</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.purpleBright} />
            <Text style={styles.infoText}>Secure telemetry to Sentinel Authority</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Customer View - Has approved application
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube" size={48} color={colors.purpleBright} />
        </View>
        <Text style={styles.title}>Your ENVELO Agent</Text>
        <Text style={styles.subtitle}>{approvedApp.systemName || approvedApp.system_name}</Text>
      </View>

      {/* Agent Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>AGENT STATUS</Text>
          <View style={[styles.statusBadge, { 
            backgroundColor: agentStatus === 'reporting' ? colors.greenDim : 
                           agentStatus === 'active' ? colors.yellowDim : 
                           agentStatus === 'pending' ? colors.purpleDim + '30' : colors.bgCardHover 
          }]}>
            <View style={[styles.statusDotSmall, { 
              backgroundColor: agentStatus === 'reporting' ? colors.greenBright : 
                             agentStatus === 'active' ? colors.yellowBright : 
                             agentStatus === 'pending' ? colors.purpleBright : colors.textTertiary 
            }]} />
            <Text style={[styles.statusBadgeText, { 
              color: agentStatus === 'reporting' ? colors.greenBright : 
                    agentStatus === 'active' ? colors.yellowBright : 
                    agentStatus === 'pending' ? colors.purpleBright : colors.textTertiary 
            }]}>
              {agentStatus === 'reporting' ? 'REPORTING' : 
               agentStatus === 'active' ? 'ACTIVE' : 
               agentStatus === 'pending' ? 'AWAITING DEPLOYMENT' : 'NOT DEPLOYED'}
            </Text>
          </View>
        </View>

        {agentStatus === 'pending' && (
          <Text style={styles.statusDescription}>
            Your application has been approved. Download and install your pre-configured ENVELO agent to begin CAT-72 testing.
          </Text>
        )}

        {(agentStatus === 'active' || agentStatus === 'reporting') && session && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>CAT-72 Progress</Text>
              <Text style={styles.progressValue}>{session.hoursCompleted || 0}/72 hours</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((session.hoursCompleted || 0) / 72) * 100}%` }]} />
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{session.totalEvents || 0}</Text>
                <Text style={styles.metricLabel}>Events</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: colors.redBright }]}>{session.blockedActions || 0}</Text>
                <Text style={styles.metricLabel}>Blocked</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: colors.greenBright }]}>{session.complianceRate || 100}%</Text>
                <Text style={styles.metricLabel}>Compliant</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Download Section */}
      {agentStatus === 'pending' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEPLOY YOUR AGENT</Text>
          
          <TouchableOpacity style={styles.downloadCard} onPress={handleDownload}>
            <View style={styles.downloadIcon}>
              <Ionicons name="download-outline" size={28} color={colors.purpleBright} />
            </View>
            <View style={styles.downloadInfo}>
              <Text style={styles.downloadTitle}>Download ENVELO Agent</Text>
              <Text style={styles.downloadSubtitle}>Pre-configured for your ODD specification</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>Installation Steps</Text>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Download the agent package above</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Install on your autonomous system</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Agent auto-connects to Sentinel Authority</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
              <Text style={styles.stepText}>CAT-72 testing begins automatically</Text>
            </View>
          </View>
        </View>
      )}

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT THIS AGENT</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ODD Specification</Text>
            <Text style={styles.infoValue}>{approvedApp.systemName || approvedApp.system_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Configuration</Text>
            <Text style={styles.infoValue}>Locked & Tamper-Proof</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reporting</Text>
            <Text style={styles.infoValue}>Sentinel Authority Only</Text>
          </View>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={20} color={colors.purpleBright} />
        <Text style={styles.noticeText}>
          This agent is pre-configured and cannot be modified. It enforces your declared ODD boundaries and reports telemetry directly to Sentinel Authority for conformance determination.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
  iconContainer: { marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '600' },
  subtitle: { color: colors.textTertiary, fontSize: 13, marginTop: spacing.xs, textAlign: 'center' },
  
  // Stats Row (Admin)
  statsRow: { flexDirection: 'row', padding: spacing.md },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.bgCard, marginHorizontal: 4, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  statValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  statLabel: { color: colors.textTertiary, fontSize: 11, marginTop: 4, textTransform: 'uppercase' },

  // Section
  section: { padding: spacing.md },
  sectionTitle: { color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.md },

  // Locked Card
  lockedCard: { margin: spacing.md, padding: spacing.xl, backgroundColor: colors.bgCard, borderRadius: borderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  lockedTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: spacing.md },
  lockedText: { color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },

  // Info Section
  infoSection: { padding: spacing.md },
  infoTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: spacing.md },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  infoText: { color: colors.textSecondary, fontSize: 14, marginLeft: spacing.md },

  // Status Card
  statusCard: { margin: spacing.md, padding: spacing.md, backgroundColor: colors.bgCard, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  statusDescription: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },

  // Progress
  progressSection: { marginTop: spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressLabel: { color: colors.textTertiary, fontSize: 12 },
  progressValue: { color: colors.textSecondary, fontSize: 12 },
  progressBar: { height: 8, backgroundColor: colors.bgCardHover, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.purpleBright, borderRadius: 4 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  metric: { alignItems: 'center' },
  metricValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  metricLabel: { color: colors.textTertiary, fontSize: 10, marginTop: 2 },

  // Download Card
  downloadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.purpleBright + '40' },
  downloadIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.purpleDim + '30', justifyContent: 'center', alignItems: 'center' },
  downloadInfo: { flex: 1, marginLeft: spacing.md },
  downloadTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  downloadSubtitle: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

  // Steps Card
  stepsCard: { marginTop: spacing.md, backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle },
  stepsTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.purpleDim + '30', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: colors.purpleBright, fontSize: 12, fontWeight: '600' },
  stepText: { color: colors.textSecondary, fontSize: 13, marginLeft: spacing.sm },

  // Info Card
  infoCard: { backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  infoLabel: { color: colors.textTertiary, fontSize: 13 },
  infoValue: { color: colors.textSecondary, fontSize: 13 },

  // Notice Card
  noticeCard: { flexDirection: 'row', margin: spacing.md, padding: spacing.md, backgroundColor: colors.purpleDim + '15', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.purpleBright + '30' },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: 12, marginLeft: spacing.sm, lineHeight: 18 },

  // Empty Card
  emptyCard: { backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  emptyText: { color: colors.textTertiary, marginTop: spacing.md },

  // Agent Card (Admin)
  agentCard: { backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  agentHeader: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  agentCompany: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  agentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  agentMetaText: { color: colors.textTertiary, fontSize: 12 },
});
