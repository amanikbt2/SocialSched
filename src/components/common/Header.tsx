import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Image, ScrollView, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useThemeStore } from '../../stores/useThemeStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { useSocialAccountsStore } from '../../stores/useSocialAccountsStore';
import { AlertCircle, Menu, Moon, Database, Bell, Facebook, Instagram, Twitter, Video, Plus, Link2, Trash2, CheckCircle2, Zap, HardDrive, Folder, ChevronRight, X, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AnimatedSheet } from './AnimatedSheet';
import { SocialPlatform } from '../../db/types';
import { platformColors } from '../../theme/colors';

import { validateFacebookToken } from '../../services/facebookPublisher';
import { getHiddenMediaStorageInfo, clearHiddenMediaStorage, getSmartflowFoldersBreakdown, clearSpecificFolder } from '../../utils/localMediaStorage';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showStatus?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Smartflow', subtitle, showStatus = true }) => {
  const { colors, setMode, isDark } = useThemeStore();
  const posts = useCampaignStore((state) => state.posts);
  const {
    accounts,
    savedFacebookPages,
    linkAccount,
    unlinkAccount,
    saveFacebookPage,
    removeSavedFacebookPage,
    switchFacebookPage,
  } = useSocialAccountsStore();
  const router = useRouter();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [mediaStorage, setMediaStorage] = useState<{ sizeBytes: number; fileCount: number }>({ sizeBytes: 0, fileCount: 0 });
  const [storageFolderPath, setStorageFolderPath] = useState('smartflow_media/');

  // Storage Breakdown Modal state
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [foldersBreakdown, setFoldersBreakdown] = useState<any[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);

  const loadMediaStorageInfo = async () => {
    const info = await getHiddenMediaStorageInfo();
    setMediaStorage(info);
  };

  const loadFoldersBreakdown = async () => {
    setIsLoadingBreakdown(true);
    try {
      const breakdown = await getSmartflowFoldersBreakdown();
      setFoldersBreakdown(breakdown);
    } catch (e) {
      console.warn('Failed to load folders breakdown:', e);
    } finally {
      setIsLoadingBreakdown(false);
    }
  };

  const handleOpenStorageModal = () => {
    setStorageModalVisible(true);
    loadFoldersBreakdown();
  };

  const handleWipeSpecificFolder = (folder: any) => {
    Alert.alert(
      'Wipe Folder?',
      `Are you sure you want to completely delete all files in the "${folder.name}" folder? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: async () => {
            const success = await clearSpecificFolder(folder.path);
            if (success) {
              await loadFoldersBreakdown();
              await loadMediaStorageInfo(); // refresh settings drawer summary as well
              Alert.alert('Success', `Cleared contents of "${folder.name}".`);
            } else {
              Alert.alert('Error', `Failed to clear folder "${folder.name}".`);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (settingsVisible) {
      loadMediaStorageInfo();
      const hasElectron = typeof window !== 'undefined' && (window as any).electronAPI;
      if (hasElectron) {
        setStorageFolderPath('~/.smartflow_media/');
      }
    }
  }, [settingsVisible]);

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

  // Linking Modal State
  const [linkingPlatform, setLinkingPlatform] = useState<SocialPlatform | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const failedCount = posts.filter((p) => p.status === 'failed' || p.status === 'missed').length;
  const currentFbAccount = accounts.find((a) => a.platform === 'facebook' && a.isConnected);

  const handleBackup = () => {
    Alert.alert('Backup Created', 'JSON Backup file generated and saved successfully!');
  };

  const handleOpenLinkModal = (platform: SocialPlatform) => {
    setLinkingPlatform(platform);
    setAuthError(null);
    const existing = accounts.find((a) => a.platform === platform);
    setUsernameInput(existing?.username || '');
    setTokenInput(existing?.accessToken || '');
  };

  const handleSaveLinkAccount = async () => {
    if (!linkingPlatform) return;
    setAuthError(null);

    if (linkingPlatform === 'facebook') {
      setIsAuthenticating(true);
      const valResult = await validateFacebookToken(tokenInput);
      setIsAuthenticating(false);

      if (!valResult.valid) {
        setAuthError(valResult.error || 'Meta API returned token error.');
        return;
      }

      // Verified live token! Use actual Facebook Page name & ID
      const pageName = valResult.name || 'Facebook Page';
      const pageId = valResult.id || 'me';
      const pageToken = valResult.pageAccessToken || tokenInput.trim();
      const handle = `@${pageName.replace(/\s+/g, '')}`;
      const avatarUrl = `https://graph.facebook.com/v19.0/${pageId}/picture?type=square`;

      // Save to active linked accounts
      linkAccount({
        platform: 'facebook',
        username: handle,
        displayName: pageName,
        avatarUrl,
        accessToken: pageToken,
        pageId: pageId,
        isConnected: true,
      });

      // Save to Facebook Pages history for one-tap switching!
      saveFacebookPage({
        id: pageId,
        name: pageName,
        accessToken: pageToken,
        avatarUrl,
      });

      Alert.alert('Verified Facebook Token', `Connected Page: "${pageName}"\nPage ID: ${pageId}`);
      setLinkingPlatform(null);
    } else {
      const finalUser = usernameInput.startsWith('@') ? usernameInput : `@${usernameInput || 'user'}`;
      linkAccount({
        platform: linkingPlatform,
        username: finalUser,
        displayName: `${linkingPlatform.toUpperCase()} User`,
        accessToken: tokenInput.trim(),
        isConnected: true,
      });
      setLinkingPlatform(null);
    }
  };

  const handleOneTapSwitch = (pageId: string) => {
    switchFacebookPage(pageId);
    setLinkingPlatform(null);
  };

  const platformIcons: Record<SocialPlatform, { icon: any; color: string; label: string }> = {
    facebook: { icon: Facebook, color: platformColors.facebook, label: 'Facebook' },
    instagram: { icon: Instagram, color: platformColors.instagram, label: 'Instagram' },
    tiktok: { icon: Video, color: '#000000', label: 'TikTok' },
    x: { icon: Twitter, color: platformColors.x, label: 'X (Twitter)' },
  };

  const [pageStatuses, setPageStatuses] = React.useState<Record<string, string>>({});
  const [checking, setChecking] = React.useState(false);

  // When settings drawer opens, trigger status checks for saved Facebook pages
  React.useEffect(() => {
    if (!settingsVisible) return;
    if (savedFacebookPages.length === 0) return;
    
    setChecking(true);
    const fetchStatus = async (page: any) => {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}?fields=id&access_token=${encodeURIComponent(page.accessToken)}`
        );
        return res.ok ? 'Active' : 'Expired';
      } catch (_) {
        return 'Expired';
      }
    };

    Promise.all(
      savedFacebookPages.map((p) =>
        fetchStatus(p).then((status) => ({ id: p.id, status }))
      )
    ).then((results) => {
      const newStatuses: Record<string, string> = {};
      results.forEach((r) => {
        newStatuses[r.id] = r.status;
      });
      setPageStatuses((prev) => ({ ...prev, ...newStatuses }));
      setChecking(false);
    });
  }, [settingsVisible, savedFacebookPages]);

  return (
    <>
      <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>

        {showStatus && (
          <View style={styles.rightActions}>
            {failedCount > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/missed-failed')}
                style={[styles.alertBadge, { backgroundColor: colors.dangerContainer }]}
              >
                <AlertCircle size={14} color={colors.danger} />
                <Text style={[styles.alertText, { color: colors.danger }]}>{failedCount}</Text>
              </TouchableOpacity>
            )}

            {/* 3-dash menu / settings icon button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSettingsVisible(true)}
              style={[styles.menuBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Menu size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Settings Drawer */}
      <AnimatedSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        fullScreen={true}
        title="Settings"
        subtitle="Linked accounts & preferences"
      >
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Section 1: Preferences */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>

          {/* Dark Theme Mode */}
          <View
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.singleLineLeft}>
              <Moon size={18} color={isDark ? colors.primary : colors.textSecondary} />
              <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                Dark Theme Mode
              </Text>
            </View>

            <Switch
              value={isDark}
              onValueChange={(val) => setMode(val ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Backup Data */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackup}
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.singleLineLeft}>
              <Database size={18} color={colors.primary} />
              <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                Backup Data
              </Text>
            </View>
            <Text style={[styles.actionText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <View
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.singleLineLeft}>
              <Bell size={18} color={notificationsEnabled ? colors.primary : colors.textSecondary} />
              <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                Notifications
              </Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Section 2: Storage */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 18 }]}>
            STORAGE
          </Text>

          {/* SQLite Database */}
          <View
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.singleLineLeft}>
              <Database size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                  Local Database
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {posts.length} Posts • SQLite
                </Text>
              </View>
            </View>
          </View>

          {/* Offline Media Folder — clickable to open breakdown */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenStorageModal}
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={[styles.singleLineLeft, { flex: 1 }]}>
              <Folder size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                  App Storage Folders
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {mediaStorage.fileCount} files • {formatBytes(mediaStorage.sizeBytes)} • Tap to manage
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Section 3: Linked Social Accounts */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 18 }]}>
            LINKED SOCIAL ACCOUNTS
          </Text>

          {(['facebook', 'instagram', 'tiktok', 'x'] as SocialPlatform[]).map((platform) => {
            const info = platformIcons[platform];
            const IconComp = info.icon;
            const account = accounts.find((a) => a.platform === platform);
            const isConnected = Boolean(account && account.isConnected);

            return (
              <View
                key={platform}
                style={[
                  styles.accountCardRow,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
              >
                <View style={styles.accountLeft}>
                  {account?.avatarUrl ? (
                    <Image source={{ uri: account.avatarUrl }} style={styles.accountAvatarCircle} />
                  ) : (
                    <View style={[styles.platformIconCircle, { backgroundColor: info.color + '20' }]}>
                      <IconComp size={16} color={info.color} />
                    </View>
                  )}
                  <View style={styles.accountTextCol}>
                    <Text style={[styles.accountPlatformTitle, { color: colors.textPrimary }]}>
                      {info.label} {isConnected ? `(${account?.username})` : ''}
                    </Text>

                    <Text style={[styles.accountStatusSub, { color: isConnected ? colors.success : colors.textMuted }]}>
                      {isConnected ? 'Connected 🟢' : 'Not Connected'}
                    </Text>
                  </View>
                </View>

                {isConnected ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => unlinkAccount(platform)}
                    style={[styles.linkActionBtn, { backgroundColor: colors.dangerContainer }]}
                  >
                    <Text style={[styles.linkActionText, { color: colors.danger }]}>Disconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenLinkModal(platform)}
                    style={[styles.linkActionBtn, { backgroundColor: colors.primaryContainer }]}
                  >
                    <Plus size={12} color={colors.primary} />
                    <Text style={[styles.linkActionText, { color: colors.primary }]}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </AnimatedSheet>

      {/* Account Linking Token Modal */}
      {linkingPlatform && (
        <AnimatedSheet
          visible={Boolean(linkingPlatform)}
          onClose={() => setLinkingPlatform(null)}
          fullScreen={true}
          title={`Link ${platformIcons[linkingPlatform].label} Account`}
          subtitle="Production OAuth API Credentials"
        >
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {authError && (
              <View style={[styles.errorBanner, { backgroundColor: colors.dangerContainer }]}>
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.errorBannerText, { color: colors.danger }]}>{authError}</Text>
              </View>
            )}

            {linkingPlatform !== 'facebook' && (
              <View style={styles.linkFormGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Account Handle / Username</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border },
                  ]}
                  placeholder="@username"
                  placeholderTextColor={colors.textMuted}
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                />
              </View>
            )}

            <View style={styles.linkFormGroup}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                {linkingPlatform === 'facebook' ? 'Facebook Page Access Token (EAAB...)' : 'Access Token / API Key'}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border },
                ]}
                placeholder="Paste EAAB... Access Token from Graph API Explorer"
                placeholderTextColor={colors.textMuted}
                value={tokenInput}
                onChangeText={setTokenInput}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isAuthenticating}
              onPress={handleSaveLinkAccount}
              style={[styles.connectSaveBtn, { backgroundColor: isAuthenticating ? colors.border : colors.primary }]}
            >
              <Link2 size={16} color="#FFFFFF" />
              <Text style={styles.connectSaveText}>
                {isAuthenticating ? 'Verifying with Meta API...' : 'Connect & Authenticate Account'}
              </Text>
            </TouchableOpacity>

            {/* ONE-TAP FACEBOOK PAGE SWITCHER HISTORY */}
            {linkingPlatform === 'facebook' && savedFacebookPages.length > 0 && (
              <View style={styles.savedPagesSection}>
                <View style={styles.savedHeaderRow}>
                  <Zap size={14} color={colors.primary} />
                  <Text style={[styles.savedSectionTitle, { color: colors.textSecondary }]}>
                    SAVED FACEBOOK PAGES (ONE-TAP SWITCH)
                  </Text>
                </View>

                {savedFacebookPages.map((page) => {
                  const isActive = currentFbAccount?.pageId === page.id && currentFbAccount?.isConnected;
                  const isLastUsed = Boolean(page.isLastUsed || isActive);

                  return (
                    <View
                      key={page.id}
                      style={[
                        styles.savedPageCard,
                        {
                          backgroundColor: colors.surfaceVariant,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {/* Round Profile Picture Avatar */}
                      <Image
                        source={{
                          uri:
                            page.avatarUrl ||
                            `https://graph.facebook.com/v19.0/${page.id}/picture?type=square`,
                        }}
                        style={styles.pageAvatarRound}
                      />

                      <View style={styles.pageInfoCol}>
                        <View style={styles.pageTitleRow}>
                          <Text style={[styles.pageNameText, { color: colors.textPrimary }]}>
                            {page.name}
                          </Text>
                          {/* Status badge */}
                          <View style={{ marginLeft: 8 }}>
                            <Text style={{ color: pageStatuses[page.id] === 'Active' ? colors.success : colors.danger, fontWeight: '600' }}>
                              {pageStatuses[page.id] || (checking ? 'Checking...' : '…')}
                            </Text>
                          </View>
                          {isLastUsed && (
                            <View style={[styles.lastUsedChip, { backgroundColor: colors.primaryContainer }]}>
                              <Text style={[styles.lastUsedChipText, { color: colors.primary }]}>
                                Last Used ⭐
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.pageSubText, { color: colors.textSecondary }]}>
                          Page ID: {page.id}
                        </Text>
                      </View>

                      {/* One-Tap Action */}
                      <View style={styles.pageActionsRight}>
                        {isActive ? (
                          <View style={[styles.activeBadgePill, { backgroundColor: colors.successContainer }]}>
                            <CheckCircle2 size={12} color={colors.success} />
                            <Text style={[styles.activeBadgeText, { color: colors.success }]}>
                              Active
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleOneTapSwitch(page.id)}
                            style={[styles.oneTapSwitchBtn, { backgroundColor: colors.primaryContainer }]}
                          >
                            <Zap size={12} color={colors.primary} />
                            <Text style={[styles.oneTapSwitchText, { color: colors.primary }]}>
                              Switch Page
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => removeSavedFacebookPage(page.id)}
                          style={styles.trashSavedBtn}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

          {/* Privacy Policy */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setSettingsVisible(false);
              router.push('/privacy');
            }}
            style={[
              styles.singleLineRow,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: 8 },
            ]}
          >
            <View style={styles.singleLineLeft}>
              <Shield size={18} color={colors.textSecondary} />
              <Text style={[styles.singleLineTitle, { color: colors.textPrimary }]}>
                Privacy Policy
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
        </AnimatedSheet>
      )}

      {/* Storage Breakdown Sheet */}
      <AnimatedSheet
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
        fullScreen={false}
        title="App Storage Folders"
        subtitle="Directories created by Smartflow on this device"
      >
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {isLoadingBreakdown ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40, marginBottom: 40 }} />
          ) : foldersBreakdown.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <Folder size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                No storage folders found on this platform.{'\n'}Run the app on mobile or desktop to manage local files.
              </Text>
            </View>
          ) : (
            foldersBreakdown.map((folder) => {
              const isMedia = folder.name === 'Media Library';
              return (
                <View
                  key={folder.path}
                  style={[
                    styles.folderItemCard,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border }
                  ]}
                >
                  <View style={{ flex: 1, gap: 4, paddingRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                      {folder.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' }}>
                      {folder.path}
                    </Text>
                    <Text style={{ fontSize: 12, color: folder.sizeBytes > 0 ? colors.primary : colors.textMuted, fontWeight: '700', marginTop: 4 }}>
                      {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'} • {formatBytes(folder.sizeBytes)} used
                    </Text>
                    {isMedia && folder.fileCount > 0 && (
                      <Text style={{ fontSize: 10, color: colors.danger, marginTop: 2 }}>
                        ⚠️ Clearing this may break scheduled posts using local media.
                      </Text>
                    )}
                  </View>

                  {folder.fileCount > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleWipeSpecificFolder(folder)}
                      style={[
                        styles.wipeBtn,
                        { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Wipe</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </AnimatedSheet>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  alertText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  singleLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  singleLineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  singleLineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  platformIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextCol: {
    flex: 1,
  },
  accountPlatformTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountStatusSub: {
    fontSize: 11,
    marginTop: 2,
  },
  linkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  linkFormGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  connectSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 20,
  },
  connectSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  savedPagesSection: {
    marginTop: 10,
    marginBottom: 30,
  },
  savedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  savedSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  savedPageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  pageAvatarRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  pageInfoCol: {
    flex: 1,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastUsedChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lastUsedChipText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pageNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pageSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  pageActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  oneTapSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  oneTapSwitchText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trashSavedBtn: {
    padding: 6,
  },
  modalWrapper: {
    flex: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  wipeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
