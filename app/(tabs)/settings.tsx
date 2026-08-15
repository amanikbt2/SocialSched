import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useQueueStore } from '../../src/stores/useQueueStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { exportAppDataJSON, importAppDataJSON } from '../../src/services/backupService';
import { getHiddenMediaStorageInfo, clearHiddenMediaStorage } from '../../src/utils/localMediaStorage';
import { Moon, Sun, Monitor, HardDrive, Wifi, ShieldAlert, Download, Upload, Bell, Shield, FileText, Trash2, ChevronRight, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { mode, setMode } = useThemeStore();
  const { networkStatus, setNetworkStatus, autoRetry, setAutoRetry } = useQueueStore();
  const { posts, campaigns, loadData } = useCampaignStore();
  const router = useRouter();

  const [notifications, setNotifications] = useState(true);
  const [mediaStorage, setMediaStorage] = useState<{ sizeBytes: number; fileCount: number }>({ sizeBytes: 0, fileCount: 0 });
  const [folderPath, setFolderPath] = useState('smartflow_media/');

  const loadMediaStorageInfo = async () => {
    const info = await getHiddenMediaStorageInfo();
    setMediaStorage(info);
  };

  useEffect(() => {
    loadMediaStorageInfo();
    const hasElectron = typeof window !== 'undefined' && (window as any).electronAPI;
    if (hasElectron) {
      setFolderPath('~/.smartflow_media/');
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearMediaFolder = () => {
    Alert.alert(
      'Clear Media Storage?',
      'This will delete all copied offline photos/videos from the app directory. Scheduled posts using these local files may fail to upload.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Storage',
          style: 'destructive',
          onPress: async () => {
            const success = await clearHiddenMediaStorage();
            if (success) {
              await loadMediaStorageInfo();
              Alert.alert('Success', 'Local media folder cleared successfully!');
            } else {
              Alert.alert('Error', 'Failed to clear local media folder.');
            }
          }
        }
      ]
    );
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportAppDataJSON();
      Alert.alert(
        'Export Backup Successful',
        `JSON Backup generated with ${posts.length} posts and ${campaigns.length} campaigns.\n\nData size: ${(json.length / 1024).toFixed(1)} KB`
      );
    } catch (e) {
      Alert.alert('Export Failed', 'Unable to generate JSON backup.');
    }
  };

  const handleImportBackup = async () => {
    Alert.alert(
      'Restore Backup',
      'This will merge imported campaigns and posts into your local SQLite database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            const mockBackup = await exportAppDataJSON();
            const success = await importAppDataJSON(mockBackup);
            if (success) {
              await loadData();
              Alert.alert('Success', 'Backup restored successfully!');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" subtitle="Preferences, theme & database backups" />

      <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
        {/* MD3 Appearance & Theme */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance & Theme</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Select your preferred MD3 interface theme</Text>

          <View style={styles.themeRow}>
            {[
              { key: 'dark', label: 'Dark Mode', icon: Moon },
              { key: 'light', label: 'Light Mode', icon: Sun },
              { key: 'system', label: 'System', icon: Monitor },
            ].map(({ key, label, icon: Icon }) => (
              <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                onPress={() => setMode(key as any)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: mode === key ? colors.primaryContainer : colors.surfaceVariant,
                    borderColor: mode === key ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon size={18} color={mode === key ? colors.primary : colors.textSecondary} />
                <Text
                  style={[
                    styles.themeText,
                    { color: mode === key ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Network & Simulation */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Network & Queue Engine</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Test offline behavior and automatic retry rules</Text>

          <View style={styles.optionRow}>
            <View style={styles.optionTextGroup}>
              <Wifi size={18} color={colors.primary} />
              <View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Network Connection State</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Current: {networkStatus.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.netChoiceRow}>
            {(['online', 'offline', 'flaky'] as const).map((net) => (
              <TouchableOpacity
                key={net}
                activeOpacity={0.8}
                onPress={() => setNetworkStatus(net)}
                style={[
                  styles.netChip,
                  {
                    backgroundColor: networkStatus === net ? colors.primaryContainer : colors.surfaceVariant,
                    borderColor: networkStatus === net ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.netText,
                    { color: networkStatus === net ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {net.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
            <View style={styles.optionTextGroup}>
              <ShieldAlert size={18} color={colors.warning} />
              <View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Auto-Retry Failed Posts</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Automatically retry when connection returns</Text>
              </View>
            </View>
            <Switch
              value={autoRetry}
              onValueChange={setAutoRetry}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
            />
          </View>
        </Card>

        {/* Local Storage & Backup */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Storage & Backup</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>SQLite database management & JSON export</Text>

          <View style={styles.storageInfo}>
            <HardDrive size={20} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Local Database Usage</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                {posts.length} Posts • {campaigns.length} Campaigns • ~1.2 MB SQLite
              </Text>
            </View>
          </View>

          <View style={[styles.storageInfo, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
            <HardDrive size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Offline Media Directory</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Folder: {folderPath} {'\n'}
                {mediaStorage.fileCount} files • {formatBytes(mediaStorage.sizeBytes)} used
              </Text>
            </View>
            {mediaStorage.fileCount > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleClearMediaFolder}
                style={[styles.clearBtn, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.backupBtnRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleExportBackup}
              style={[styles.backupBtn, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
            >
              <Download size={16} color={colors.primary} />
              <Text style={[styles.backupText, { color: colors.primary }]}>Export JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleImportBackup}
              style={[styles.backupBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Upload size={16} color={colors.textPrimary} />
              <Text style={[styles.backupText, { color: colors.textPrimary }]}>Restore Backup</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Notifications */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Schedule alerts and queue updates</Text>

          <View style={styles.optionRow}>
            <View style={styles.optionTextGroup}>
              <Bell size={18} color={colors.accent} />
              <View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Push Notifications</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Notify when post uploads finish or fail</Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: colors.surfaceVariant, true: colors.accent }}
            />
          </View>
        </Card>

        {/* Legal & Platform Compliance Section */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Legal & Compliance</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Terms of Service, Privacy Policy & Meta Data Rights</Text>

          <View style={{ marginTop: 8, gap: 4 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/terms' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FileText size={18} color={colors.primary} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Terms of Service</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>/terms</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/privacy' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Shield size={18} color="#10B981" />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Privacy Policy</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>/privacy</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/data-detection' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Search size={18} color="#3B82F6" />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Data Detection Policy</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>/data-detection</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Developer / Electron Debugging Section */}
        {typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron && (
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Developer Tools</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Access Chrome developer logs and inspectors</Text>

            <View style={{ marginTop: 4 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleDevTools) {
                    (window as any).electronAPI.toggleDevTools();
                  }
                }}
                style={[styles.backupBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
              >
                <Monitor size={16} color={colors.textPrimary} />
                <Text style={[styles.backupText, { color: colors.textPrimary }]}>Toggle Developer Tools (Debug)</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollList: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  sectionCard: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  themeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  netChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  netChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  netText: {
    fontSize: 11,
    fontWeight: '800',
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backupBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  backupText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
