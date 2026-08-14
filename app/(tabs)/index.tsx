import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Header } from '../../src/components/common/Header';
import { ContainerCard } from '../../src/components/container/ContainerCard';
import { AddContainerModal } from '../../src/components/container/AddContainerModal';
import { AnimatedSheet } from '../../src/components/common/AnimatedSheet';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useSocialAccountsStore } from '../../src/stores/useSocialAccountsStore';
import { fetchMetaScheduledPostsCount, fetchMetaScheduledPosts, deleteMetaScheduledPost, MetaScheduledPost } from '../../src/services/facebookPublisher';
import { TopReloadProgressBar } from '../../src/components/common/TopReloadProgressBar';
import { Container, Post } from '../../src/db/types';
import { Plus, Layers, Globe, FolderPlus, Clock, ChevronRight, CheckCircle2, Trash2, Repeat } from 'lucide-react-native';

export default function HomeScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, toggleCampaignPause, deleteCampaign, deletePost, loadData } = useCampaignStore();
  const { accounts, loadSavedAccounts } = useSocialAccountsStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [initialIsLoop, setInitialIsLoop] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [metaServerScheduledCount, setMetaServerScheduledCount] = useState<number | null>(null);
  const [remoteScheduledPosts, setRemoteScheduledPosts] = useState<MetaScheduledPost[]>([]);
  const [scheduledPopupVisible, setScheduledPopupVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fbAccount = accounts.find((a) => a.platform === 'facebook' && a.isConnected);

  // Scheduled / Waiting posts list for popup verification fallback
  const localScheduledPosts = posts.filter(
    (p) => p.status === 'scheduled' || p.status === 'waiting'
  );

  const handleDeletePost = (post: Post | MetaScheduledPost) => {
    const isRemote = 'scheduled_publish_time' in post;
    const postTitle = isRemote ? (post as MetaScheduledPost).message || 'Meta Scheduled Post' : (post as Post).caption || 'Scheduled Post';
    const targetPostId = isRemote ? post.id : ((post as Post).facebookPostId || (post as Post).id);

    Alert.alert(
      'Delete Scheduled Post',
      `Are you sure you want to delete "${postTitle.substring(0, 30)}..." and cancel it on Meta server?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Remove',
          style: 'destructive',
          onPress: async () => {
            if (!isRemote) {
              await deletePost((post as Post).id);
            }
            if (fbAccount?.accessToken && targetPostId) {
              await deleteMetaScheduledPost(
                fbAccount.accessToken,
                targetPostId,
                fbAccount.pageId || 'me'
              );
            }
            if (fbAccount?.accessToken) {
              const updated = await fetchMetaScheduledPosts(
                fbAccount.accessToken,
                fbAccount.pageId || 'me'
              );
              setRemoteScheduledPosts(updated);
              setMetaServerScheduledCount(updated.length);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    await loadSavedAccounts();

    if (fbAccount && fbAccount.accessToken && fbAccount.isConnected) {
      const fetchedMeta = await fetchMetaScheduledPosts(
        fbAccount.accessToken,
        fbAccount.pageId || 'me'
      );
      setRemoteScheduledPosts(fetchedMeta);
      setMetaServerScheduledCount(Math.max(fetchedMeta.length, localScheduledPosts.length));
    }
    setRefreshing(false);
  }, [fbAccount?.accessToken, fbAccount?.isConnected, fbAccount?.pageId, loadData, loadSavedAccounts, localScheduledPosts.length]);

  // Fetch live scheduled posts directly from Meta Graph API with instant local fallback
  useEffect(() => {
    let isMounted = true;
    const localScheduledCount = localScheduledPosts.length;

    if (fbAccount && fbAccount.accessToken && fbAccount.isConnected) {
      fetchMetaScheduledPosts(fbAccount.accessToken, fbAccount.pageId || 'me')
        .then((fetchedMeta) => {
          if (isMounted) {
            setRemoteScheduledPosts(fetchedMeta);
            setMetaServerScheduledCount(Math.max(fetchedMeta.length, localScheduledCount));
          }
        })
        .catch(() => {
          if (isMounted) setMetaServerScheduledCount(localScheduledCount);
        });
    } else {
      if (isMounted) setMetaServerScheduledCount(localScheduledCount);
    }

    return () => {
      isMounted = false;
    };
  }, [fbAccount?.accessToken, fbAccount?.isConnected, posts]);

  const handleOpenAdd = () => {
    setEditingContainer(null);
    setTypeModalVisible(true);
  };

  const handleChooseType = (isLoop: boolean) => {
    setInitialIsLoop(isLoop);
    setTypeModalVisible(false);
    setModalVisible(true);
  };

  const handleEditContainer = (container: Container) => {
    setEditingContainer(container);
    setInitialIsLoop(container.isLoopContainer || false);
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopReloadProgressBar loading={refreshing} />
      <Header title="SyncFlow" subtitle="Android Batch Scheduler" />

      <ScrollView
        style={{ flex: 1, opacity: refreshing ? 0.55 : 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1877F2']}
            tintColor="#1877F2"
          />
        }
      >
        {/* Top Overview Banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroLeft}>
            <View style={[styles.heroIconBox, { backgroundColor: colors.primaryContainer }]}>
              <Layers size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                Scheduler Containers
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                {campaigns.length} Active Containers • {posts.length} Total Posts
              </Text>

              {/* Interactive Tappable Meta Server Scheduled Verification Badge */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setScheduledPopupVisible(true)}
                style={[styles.metaBadge, { backgroundColor: colors.primaryContainer }]}
              >
                <Globe size={11} color={colors.primary} />
                <Text style={[styles.metaBadgeText, { color: colors.primary }]}>
                  Meta Server Scheduled:{' '}
                  {metaServerScheduledCount !== null
                    ? `${metaServerScheduledCount} Posts`
                    : 'Verifying...'}
                </Text>
                <ChevronRight size={10} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reduced Add Container button to Add */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenAdd}
            style={[styles.bannerAddBtn, { backgroundColor: colors.primary }]}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.bannerAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Containers Grid (2 Columns) or Empty State */}
        {campaigns.length > 0 ? (
          <View style={styles.containersList}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              YOUR ACTIVE CONTAINERS ({campaigns.length})
            </Text>

            <View style={styles.cardsGrid}>
              {campaigns.map((item) => (
                <ContainerCard
                  key={item.id}
                  container={item}
                  posts={posts}
                  onTogglePause={(id) => toggleCampaignPause(id)}
                  onEdit={handleEditContainer}
                  onDelete={(id) => deleteCampaign(id)}
                />
              ))}
            </View>
          </View>
        ) : (
          /* Empty State when no containers created */
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryContainer }]}>
              <FolderPlus size={36} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No Containers Created Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              A Container is a special batch scheduler where you can define platform rules, smart intervals, and add Facebook-style multi-image posts.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenAdd}
              style={[styles.emptyCreateBtn, { backgroundColor: colors.primary }]}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.emptyCreateBtnText}>Create First Container</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Container Modal */}
      <AddContainerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        existingContainer={editingContainer}
        initialIsLoop={initialIsLoop}
      />

      {/* Container Type Selection Modal Sheet */}
      <AnimatedSheet
        visible={typeModalVisible}
        onClose={() => setTypeModalVisible(false)}
        title="Select Container Type"
        subtitle="Choose scheduling mechanics for your campaign"
      >
        <View style={{ gap: 14, padding: 4, marginBottom: 20 }}>
          {/* Option A: Standard Container */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleChooseType(false)}
            style={{
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
              <Layers size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                Standard Container
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 }}>
                Add individual posts with fixed descriptions, custom times, and specific attached image galleries.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option B: Loop Container */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleChooseType(true)}
            style={{
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#8B5CF618', alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
              <Repeat size={22} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                Loop Container
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 }}>
                Upload a general pool of media and descriptions. SocialSched shuffles and schedules them automatically.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </AnimatedSheet>

      {/* POPUP LIST MODAL FOR SCHEDULED POSTS */}
      {(() => {
        const displayList = remoteScheduledPosts.length > 0 ? remoteScheduledPosts : localScheduledPosts;
        return (
          <AnimatedSheet
            visible={scheduledPopupVisible}
            onClose={() => setScheduledPopupVisible(false)}
            title="Meta Server Scheduled Posts"
            subtitle={`Showing ${displayList.length} posts uploaded & queued for auto-publishing`}
          >
            <ScrollView style={styles.popupListContent} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
              {displayList.length > 0 ? (
                displayList.map((item, idx) => {
                  const isRemote = 'scheduled_publish_time' in item;
                  const remoteItem = item as MetaScheduledPost;
                  const localItem = item as Post;

                  const captionText = isRemote
                    ? remoteItem.message || 'Meta Scheduled Post (Media)'
                    : localItem.caption || 'Scheduled Post';

                  const scheduledTimestamp = isRemote
                    ? (remoteItem.scheduled_publish_time ? remoteItem.scheduled_publish_time * 1000 : Date.now())
                    : Date.parse(localItem.scheduledAt || '');

                  const formattedDate = new Date(scheduledTimestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const parentCampaign = !isRemote && localItem.campaignId
                    ? campaigns.find((c) => c.id === localItem.campaignId)
                    : null;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.scheduledItemRow,
                        { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                      ]}
                    >
                      <View style={[styles.itemNumBadge, { backgroundColor: colors.primaryContainer }]}>
                        <Text style={[styles.itemNumText, { color: colors.primary }]}>#{idx + 1}</Text>
                      </View>

                      <View style={styles.itemTextCol}>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.itemCaptionText, { color: colors.textPrimary }]}
                        >
                          {captionText}
                        </Text>

                        <Text style={[styles.itemMetaSub, { color: colors.textSecondary }]}>
                          📁 {parentCampaign?.title || 'Meta Server Queued'}
                        </Text>
                      </View>

                      <View style={[styles.itemTimePill, { backgroundColor: colors.primaryContainer }]}>
                        <Clock size={10} color={colors.primary} />
                        <Text style={[styles.itemTimeText, { color: colors.primary }]}>
                          {formattedDate}
                        </Text>
                        <Globe size={10} color={colors.success} />
                      </View>

                      {/* SMART TRASH DELETE BUTTON */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeletePost(item)}
                        style={styles.itemTrashBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyPopupBox}>
                  <Globe size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyPopupText, { color: colors.textSecondary }]}>
                    No scheduled posts found. Create a container to schedule posts directly on Meta servers!
                  </Text>
                </View>
              )}
            </ScrollView>
          </AnimatedSheet>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  heroBanner: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bannerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bannerAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  containersList: {
    marginBottom: 20,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyBox: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  popupListContent: {
    flex: 1,
    width: '100%',
    marginTop: 10,
  },
  scheduledItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  itemNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemTextCol: {
    flex: 1,
  },
  itemCaptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemMetaSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  itemTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemTrashBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EF444415',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPopupBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyPopupText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
