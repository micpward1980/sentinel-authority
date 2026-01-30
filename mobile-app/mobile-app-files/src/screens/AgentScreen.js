import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agentAPI } from '../api';
import { colors, spacing, borderRadius } from '../styles/theme';

export default function AgentScreen() {
  const [apiKeys, setApiKeys] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    try {
      const [keysRes, sessionsRes] = await Promise.all([
        agentAPI.getKeys(),
        agentAPI.getSessions(),
      ]);
      setApiKeys(keysRes.data || []);
      setSessions(sessionsRes.data || []);
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

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await agentAPI.generateKey();
      Alert.alert(
        'API Key Generated',
        'Your new API key:\n\n' + res.data.key + '\n\nSave this now - it won\'t be shown again!',
        [
          { text: 'Copy', onPress: () => Clipboard.setString(res.data.key) },
          { text: 'OK' },
        ]
      );
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return colors.greenBright;
      case 'completed': return colors.purpleBright;
      case 'failed': return colors.redBright;
      default: return colors.textTertiary;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purpleBright} />}
    >
      {/* API Keys Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>API Keys</Text>
          <TouchableOpacity 
            style={[styles.generateBtn, generating && styles.btnDisabled]}
            onPress={generateKey}
            disabled={generating}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.generateBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>

        {apiKeys.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="key-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No API keys generated</Text>
            <Text style={styles.emptySubtext}>Generate a key to deploy your ENVELO agent</Text>
          </View>
        ) : (
          apiKeys.map((key, i) => (
            <View key={key.id || i} style={styles.keyCard}>
              <View style={styles.keyHeader}>
                <Text style={styles.keyName}>{key.name || 'API Key'}</Text>
                <View style={[styles.statusDot, { backgroundColor: key.active ? colors.greenBright : colors.redBright }]} />
              </View>
              <Text style={styles.keyValue}>•••• {key.lastFour || '****'}</Text>
              <Text style={styles.keyDate}>Created: {new Date(key.createdAt).toLocaleDateString()}</Text>
            </View>
          ))
        )}
      </View>

      {/* Sessions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CAT-72 Sessions</Text>
        
        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="flask-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No test sessions</Text>
            <Text style={styles.emptySubtext}>Deploy your agent to start CAT-72 testing</Text>
          </View>
        ) : (
          sessions.map((session, i) => (
            <View key={session.id || i} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionId}>Session {session.id?.substring(0, 8)}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(session.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(session.status) }]}>
                    {session.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              {session.status === 'active' && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(session.hoursCompleted / 72) * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{session.hoursCompleted || 0}/72 hours</Text>
                </View>
              )}
              
              <View style={styles.sessionStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{session.totalEvents || 0}</Text>
                  <Text style={styles.statLabel}>Events</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{session.blockedActions || 0}</Text>
                  <Text style={styles.statLabel}>Blocked</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.greenBright }]}>
                    {session.complianceRate || 100}%
                  </Text>
                  <Text style={styles.statLabel}>Compliant</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentation</Text>
        <TouchableOpacity style={styles.docLink}>
          <Ionicons name="document-text-outline" size={20} color={colors.purpleBright} />
          <Text style={styles.docLinkText}>Integration Guide</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.docLink}>
          <Ionicons name="code-slash-outline" size={20} color={colors.purpleBright} />
          <Text style={styles.docLinkText}>API Reference</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.docLink}>
          <Ionicons name="download-outline" size={20} color={colors.purpleBright} />
          <Text style={styles.docLinkText}>Download SDK</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
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
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purpleBright,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.xs,
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
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptySubtext: {
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  keyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  keyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyName: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  keyValue: {
    color: colors.textTertiary,
    fontFamily: 'monospace',
    marginTop: spacing.sm,
  },
  keyDate: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  sessionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sessionId: {
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressContainer: {
    marginVertical: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.bgCardHover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.purpleBright,
    borderRadius: 3,
  },
  progressText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  docLinkText: {
    color: colors.textSecondary,
    flex: 1,
    marginLeft: spacing.md,
  },
});
