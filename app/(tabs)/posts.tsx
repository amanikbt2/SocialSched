import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useSocialAccountsStore, SavedFacebookPage } from '../../src/stores/useSocialAccountsStore';
import { Header } from '../../src/components/common/Header';
import { FacebookMediaGrid } from '../../src/components/common/FacebookMediaGrid';
import { TopReloadProgressBar } from '../../src/components/common/TopReloadProgressBar';
import { deleteMetaScheduledPost, fetchMetaPublishedPosts, fetchMetaScheduledPosts } from '../../src/services/facebookPublisher';
import { Post, SocialPlatform } from '../../src/db/types';
import {
  Facebook,
  Twitter,
  Instagram,
  Video,
  ChevronDown,
  LayoutGrid,
  List,
  Layers,
  Search,
  Calendar,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  MoreHorizontal,
  ThumbsUp,
  MessageSquare,
  Share2,
} from 'lucide-react-native';

type ViewMode = 'fb' | 'tiles' | 'list';
type StatusFilter = 'all' | 'scheduled' | 'published' | 'failed';
type DateFilter = 'all' | 'today' | 'future' | 'past';

export default function PostsManagerScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { posts, deletePost, loadData } = useCampaignStore();
  const { accounts, savedFacebookPages, switchFacebookPage, getAccount, loadSavedAccounts } = useSocialAccountsStore();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('facebook');
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('fb');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Facebook Live Feed integration
  const [postsSource, setPostsSource] = useState<'app' | 'facebook_live'>('app');
  const [facebookLivePosts, setFacebookLivePosts] = useState<Post[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  // Active Facebook Account
  const activeFbAccount = getAccount('facebook');
  const activePageName = activeFbAccount?.displayName || 'Facebook Page';
  const activePageId = activeFbAccount?.pageId || 'me';
  const activeAvatar =
    activeFbAccount?.avatarUrl ||
    `https://graph.facebook.com/v19.0/${activePageId}/picture?type=square`;

  const fetchFacebookLivePosts = async () => {
    if (!activeFbAccount?.accessToken) return;
    setIsLoadingLive(true);
    try {
      const sched = await fetchMetaScheduledPosts(activeFbAccount.accessToken, activeFbAccount.pageId);
      const pub = await fetchMetaPublishedPosts(activeFbAccount.accessToken, activeFbAccount.pageId);

      const mappedSched: Post[] = sched.map((p) => ({
        id: p.id,
        campaignId: null,
        caption: p.message || '[No caption]',
        images: p.full_picture ? [p.full_picture] : [],
        videos: [],
        platforms: ['facebook'],
        scheduledAt: p.scheduled_publish_time
          ? new Date(p.scheduled_publish_time * 1000).toISOString()
          : p.created_time || new Date().toISOString(),
        status: 'scheduled',
        notes: 'Meta Server (Scheduled)',
        failureReason: null,
        uploadProgress: 100,
        tags: [],
        hashtags: [],
        mentions: [],
        createdAt: p.created_time || new Date().toISOString(),
        updatedAt: p.created_time || new Date().toISOString(),
        facebookPostId: p.id,
      }));

      const mappedPub: Post[] = pub.map((p) => ({
        id: p.id,
        campaignId: null,
        caption: p.message || '[No caption]',
        images: p.full_picture ? [p.full_picture] : [],
        videos: [],
        platforms: ['facebook'],
        scheduledAt: p.created_time || new Date().toISOString(),
        status: 'published',
        notes: 'Meta Server (Published Feed)',
        failureReason: null,
        uploadProgress: 100,
        tags: [],
        hashtags: [],
        mentions: [],
        createdAt: p.created_time || new Date().toISOString(),
        updatedAt: p.created_time || new Date().toISOString(),
        facebookPostId: p.id,
      }));

      const combined = [...mappedSched, ...mappedPub].sort(
        (a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)
      );

      setFacebookLivePosts(combined);
    } catch (err) {
      console.warn('Failed fetching live Facebook posts:', err);
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    if (selectedPlatform === 'facebook' && postsSource === 'facebook_live') {
      fetchFacebookLivePosts();
    }
  }, [selectedPlatform, postsSource, activePageId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    await loadSavedAccounts();
    if (selectedPlatform === 'facebook' && postsSource === 'facebook_live') {
      await fetchFacebookLivePosts();
    }
    setRefreshing(false);
  }, [loadData, loadSavedAccounts, selectedPlatform, postsSource, activePageId]);

  // Multi-select & deletion progress state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [deletingPostIds, setDeletingPostIds] = useState<string[]>([]);
  const [deletionProgress, setDeletionProgress] = useState({ total: 0, done: 0, isDeleting: false });

  // Filtered Posts
  const displayedPosts = postsSource === 'facebook_live' ? facebookLivePosts : posts;

  const filteredPosts = useMemo(() => {
    return displayedPosts.filter((post) => {
      // Platform filter (only for local app queue posts)
      if (postsSource === 'app' && post.platforms && post.platforms.length > 0) {
        if (!post.platforms.includes(selectedPlatform)) return false;
      }

      // Status filter
      if (statusFilter === 'scheduled' && post.status !== 'scheduled' && post.status !== 'waiting') {
        return false;
      }
      if (statusFilter === 'published' && post.status !== 'published') {
        return false;
      }
      if (statusFilter === 'failed' && post.status !== 'failed' && post.status !== 'missed') {
        return false;
      }

      // Date filter
      const postTime = Date.parse(post.scheduledAt);
      const now = Date.now();
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const todayEnd = new Date().setHours(23, 59, 59, 999);

      if (dateFilter === 'today') {
        if (isNaN(postTime) || postTime < todayStart || postTime > todayEnd) return false;
      } else if (dateFilter === 'future') {
        if (isNaN(postTime) || postTime <= now) return false;
      } else if (dateFilter === 'past') {
        if (isNaN(postTime) || postTime > now) return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesCaption = post.caption.toLowerCase().includes(q);
        const matchesTags = (post.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesCaption && !matchesTags) return false;
      }

      return true;
    });
  }, [displayedPosts, selectedPlatform, statusFilter, dateFilter, searchQuery, postsSource]);

  // Handle Multi-Select Toggles
  const handleToggleSelectPost = (postId: string) => {
    if (selectedPostIds.includes(postId)) {
      setSelectedPostIds(selectedPostIds.filter((id) => id !== postId));
    } else {
      setSelectedPostIds([...selectedPostIds, postId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedPostIds.length === filteredPosts.length) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(filteredPosts.map((p) => p.id));
    }
  };

  // Delete Single Post
  const handleDeletePost = (post: Post) => {
    const isLive = postsSource === 'facebook_live';
    const alertTitle = isLive ? 'Delete Live Post' : 'Delete Post';
    const alertMsg = isLive
      ? 'Are you sure you want to delete this post directly off your Facebook Page feed/schedule?'
      : 'Are you sure you want to delete this post from the container and cancel it on Meta server?';

    const performDelete = async () => {
      setDeletingPostIds((prev) => [...prev, post.id]);
      const fbId = post.facebookPostId || post.id;

      if (activeFbAccount?.accessToken && fbId) {
        await deleteMetaScheduledPost(
          activeFbAccount.accessToken,
          fbId,
          activeFbAccount.pageId || 'me'
        );
      }

      if (isLive) {
        setFacebookLivePosts((prev) => prev.filter((p) => p.id !== post.id));
        const localMatch = posts.find((p) => p.facebookPostId === fbId || p.id === post.id);
        if (localMatch) {
          await deletePost(localMatch.id);
        }
      } else {
        if (post.campaignId) {
          const { smartDeleteLoopPosts } = useCampaignStore.getState();
          await smartDeleteLoopPosts(post.campaignId, [post.id]);
        } else {
          await deletePost(post.id);
        }
      }

      setDeletingPostIds((prev) => prev.filter((id) => id !== post.id));
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${alertTitle}\n\n${alertMsg}`)) {
        performDelete();
      }
    } else {
      Alert.alert(alertTitle, alertMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedPostIds.length === 0) return;
    const count = selectedPostIds.length;
    const isLive = postsSource === 'facebook_live';
    const title = `Delete ${count} Post${count !== 1 ? 's' : ''}`;
    const msg = `Are you sure you want to delete ${count} post(s)? They will be removed from your app and canceled on Meta servers.`;

    const performBulkDelete = async () => {
      setDeletionProgress({ total: count, done: 0, isDeleting: true });
      setDeletingPostIds(selectedPostIds);

      const targetIds = [...selectedPostIds];
      const CHUNK_SIZE = 5;
      let completed = 0;

      for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
        const chunk = targetIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (pid) => {
            const targetPost = displayedPosts.find((p) => p.id === pid);
            if (targetPost) {
              const fbId = targetPost.facebookPostId || targetPost.id;
              if (activeFbAccount?.accessToken && fbId) {
                await deleteMetaScheduledPost(
                  activeFbAccount.accessToken,
                  fbId,
                  activeFbAccount.pageId || 'me'
                );
              }
              if (targetPost.campaignId) {
                const { smartDeleteLoopPosts } = useCampaignStore.getState();
                await smartDeleteLoopPosts(targetPost.campaignId, [pid]);
              } else {
                await deletePost(pid);
              }
            }
            if (isLive) {
              setFacebookLivePosts((prev) => prev.filter((p) => p.id !== pid));
            }
            completed++;
            setDeletionProgress((prev) => ({ ...prev, done: completed }));
          })
        );
      }

      setDeletingPostIds([]);
      setSelectedPostIds([]);
      setIsMultiSelectMode(false);
      setDeletionProgress({ total: 0, done: 0, isDeleting: false });
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${msg}`)) {
        performBulkDelete();
      }
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: `Delete ${count} Post${count !== 1 ? 's' : ''}`, style: 'destructive', onPress: performBulkDelete },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopReloadProgressBar loading={refreshing} />
      <Header title="Posts Manager" subtitle="Manage & filter scheduled posts across pages" />

      {/* Smart Real-Time Deletion Progress Bar */}
      {deletionProgress.isDeleting && (
        <View style={[styles.deletionBarCard, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#EF4444" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#EF4444' }}>
                Deleting posts... {deletionProgress.done} / {deletionProgress.total} ({Math.round((deletionProgress.done / Math.max(1, deletionProgress.total)) * 100)}%)
              </Text>
            </View>
          </View>
          <View style={{ height: 5, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 3, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                backgroundColor: '#EF4444',
                width: `${(deletionProgress.done / Math.max(1, deletionProgress.total)) * 100}%`,
              }}
            />
          </View>
        </View>
      )}

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
        {/* Top Platform Selection Discs */}
        <View style={[styles.platformDiscsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlatform('facebook')}
            style={[
              styles.platformDisc,
              selectedPlatform === 'facebook' && { backgroundColor: '#1877F218', borderColor: '#1877F2', borderWidth: 2 },
            ]}
          >
            <View style={[styles.discIconCircle, { backgroundColor: '#1877F2' }]}>
              <Facebook size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.discText, { color: selectedPlatform === 'facebook' ? '#1877F2' : colors.textSecondary }]}>
              Facebook
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlatform('x')}
            style={[
              styles.platformDisc,
              selectedPlatform === 'x' && { backgroundColor: '#1DA1F218', borderColor: '#1DA1F2', borderWidth: 2 },
            ]}
          >
            <View style={[styles.discIconCircle, { backgroundColor: '#1DA1F2' }]}>
              <Twitter size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.discText, { color: selectedPlatform === 'x' ? '#1DA1F2' : colors.textSecondary }]}>
              Twitter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlatform('instagram')}
            style={[
              styles.platformDisc,
              selectedPlatform === 'instagram' && { backgroundColor: '#E4405F18', borderColor: '#E4405F', borderWidth: 2 },
            ]}
          >
            <View style={[styles.discIconCircle, { backgroundColor: '#E4405F' }]}>
              <Instagram size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.discText, { color: selectedPlatform === 'instagram' ? '#E4405F' : colors.textSecondary }]}>
              Instagram
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlatform('tiktok')}
            style={[
              styles.platformDisc,
              selectedPlatform === 'tiktok' && { backgroundColor: '#00000018', borderColor: colors.textPrimary, borderWidth: 2 },
            ]}
          >
            <View style={[styles.discIconCircle, { backgroundColor: '#000000' }]}>
              <Video size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.discText, { color: selectedPlatform === 'tiktok' ? colors.textPrimary : colors.textSecondary }]}>
              TikTok
            </Text>
          </TouchableOpacity>
        </View>

        {/* Facebook Page Dropdown (shown when Facebook platform is selected) */}
        {selectedPlatform === 'facebook' && (
          <View style={styles.fbPageContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPageDropdownOpen(!pageDropdownOpen)}
              style={[styles.pageSelectorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Image source={{ uri: activeAvatar }} style={styles.pageAvatar} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{activePageName}</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>Active Page</Text>
                  </View>
                </View>
                <Text style={[styles.pageSub, { color: colors.textSecondary }]}>
                  Page ID: {activePageId} {savedFacebookPages.length > 1 ? `(${savedFacebookPages.length} Pages Saved)` : ''}
                </Text>
              </View>
              <ChevronDown size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {pageDropdownOpen && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.dropdownHeader, { color: colors.textMuted }]}>SWITCH FACEBOOK PAGE</Text>
                {savedFacebookPages.map((page) => (
                  <TouchableOpacity
                    key={page.id}
                    activeOpacity={0.8}
                    onPress={async () => {
                      await switchFacebookPage(page.id);
                      setPageDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      page.id === activePageId && { backgroundColor: '#1877F210' },
                    ]}
                  >
                    <Image source={{ uri: page.avatarUrl || activeAvatar }} style={styles.dropdownAvatar} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.dropdownName, { color: colors.textPrimary }]}>{page.name}</Text>
                      <Text style={[styles.dropdownId, { color: colors.textSecondary }]}>{page.id}</Text>
                    </View>
                    {page.id === activePageId && <CheckCircle2 size={16} color="#1877F2" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Source Toggle Tabs (App Queue vs Facebook Live) */}
        {selectedPlatform === 'facebook' && (
          <View style={styles.sourceTabsContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setPostsSource('app');
                setIsMultiSelectMode(false);
                setSelectedPostIds([]);
              }}
              style={[
                styles.sourceTab,
                postsSource === 'app'
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Layers size={14} color={postsSource === 'app' ? '#FFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.sourceTabText,
                  postsSource === 'app' ? { color: '#FFF' } : { color: colors.textPrimary },
                ]}
              >
                App Queue ({posts.filter(p => p.platforms.includes('facebook')).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setPostsSource('facebook_live');
                setIsMultiSelectMode(false);
                setSelectedPostIds([]);
              }}
              style={[
                styles.sourceTab,
                postsSource === 'facebook_live'
                  ? { backgroundColor: '#1877F2', borderColor: '#1877F2' }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Facebook size={14} color={postsSource === 'facebook_live' ? '#FFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.sourceTabText,
                  postsSource === 'facebook_live' ? { color: '#FFF' } : { color: colors.textPrimary },
                ]}
              >
                Live Page Feed
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Control Bar: Filters + Windows Explorer Style Layout Switcher */}
        <View style={[styles.controlsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Search */}
          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Search size={14} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search posts..."
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* View Mode Layout Switcher Buttons */}
          <View style={styles.viewModeGroup}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode('fb')}
              style={[
                styles.viewBtn,
                viewMode === 'fb' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Facebook size={14} color={viewMode === 'fb' ? '#FFF' : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode('tiles')}
              style={[
                styles.viewBtn,
                viewMode === 'tiles' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <LayoutGrid size={14} color={viewMode === 'tiles' ? '#FFF' : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode('list')}
              style={[
                styles.viewBtn,
                viewMode === 'list' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <List size={14} color={viewMode === 'list' ? '#FFF' : colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status & Date Filter Pills Bar */}
        <View style={styles.filterPillsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
            <TouchableOpacity
              onPress={() => setStatusFilter('all')}
              style={[styles.filterPill, statusFilter === 'all' && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.filterPillText, statusFilter === 'all' && { color: '#FFF' }]}>All Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter('scheduled')}
              style={[styles.filterPill, statusFilter === 'scheduled' && { backgroundColor: '#8B5CF6' }]}
            >
              <Text style={[styles.filterPillText, statusFilter === 'scheduled' && { color: '#FFF' }]}>Scheduled</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter('published')}
              style={[styles.filterPill, statusFilter === 'published' && { backgroundColor: '#10B981' }]}
            >
              <Text style={[styles.filterPillText, statusFilter === 'published' && { color: '#FFF' }]}>Posted / Published</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter('failed')}
              style={[styles.filterPill, statusFilter === 'failed' && { backgroundColor: '#EF4444' }]}
            >
              <Text style={[styles.filterPillText, statusFilter === 'failed' && { color: '#FFF' }]}>Failed / Missed</Text>
            </TouchableOpacity>

            <View style={styles.dividerDot} />

            <TouchableOpacity
              onPress={() => setDateFilter('all')}
              style={[styles.filterPill, dateFilter === 'all' && { backgroundColor: colors.surfaceVariant }]}
            >
              <Text style={[styles.filterPillText, { color: colors.textPrimary }]}>All Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDateFilter('today')}
              style={[styles.filterPill, dateFilter === 'today' && { backgroundColor: colors.surfaceVariant }]}
            >
              <Text style={[styles.filterPillText, { color: colors.textPrimary }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDateFilter('future')}
              style={[styles.filterPill, dateFilter === 'future' && { backgroundColor: colors.surfaceVariant }]}
            >
              <Text style={[styles.filterPillText, { color: colors.textPrimary }]}>Future</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Multi-Select Header Bar */}
        <View style={[styles.multiSelectHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedPostIds([]);
            }}
            style={styles.selectToggleBtn}
          >
            {isMultiSelectMode ? <CheckSquare size={16} color={colors.primary} /> : <Square size={16} color={colors.textSecondary} />}
            <Text style={[styles.selectToggleText, { color: colors.textPrimary }]}>
              {isMultiSelectMode ? 'Cancel Select' : 'Select Mode'}
            </Text>
          </TouchableOpacity>

          {isMultiSelectMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity activeOpacity={0.8} onPress={handleSelectAll} style={styles.selectAllBtn}>
                <Text style={[styles.selectAllText, { color: colors.primary }]}>
                  {selectedPostIds.length === filteredPosts.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>

              {selectedPostIds.length > 0 && (
                <TouchableOpacity activeOpacity={0.85} onPress={handleBulkDelete} style={styles.bulkDeleteBtn}>
                  <Trash2 size={14} color="#FFF" />
                  <Text style={styles.bulkDeleteText}>Delete ({selectedPostIds.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Posts List View Area */}
        {isLoadingLive ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#1877F2" />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, marginTop: 12 }]}>
              Fetching Facebook Feed...
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Pulling real-time published and scheduled posts from your Page.
            </Text>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Layers size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Posts Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              No posts match your active filters for {selectedPlatform.toUpperCase()}.
            </Text>
          </View>
        ) : (
          <View style={styles.postsListContainer}>
            {filteredPosts.map((post) => {
              const isSelected = selectedPostIds.includes(post.id);

              // 1. FB FEED VIEW (Rich Facebook card layout)
              if (viewMode === 'fb') {
                return (
                  <View
                    key={post.id}
                    style={[
                      styles.fbCard,
                      { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.fbCardHeader}>
                      {isMultiSelectMode && (
                        <TouchableOpacity onPress={() => handleToggleSelectPost(post.id)} style={{ marginRight: 8 }}>
                          {isSelected ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textSecondary} />}
                        </TouchableOpacity>
                      )}
                      <Image source={{ uri: activeAvatar }} style={styles.fbAvatar} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.fbPageName, { color: colors.textPrimary }]}>{activePageName}</Text>
                        {(() => {
                          const isFailed = post.status === 'failed' || post.status === 'missed';
                          const isPublished = post.status === 'published' || Date.parse(post.scheduledAt) <= Date.now();
                          const formattedDate = new Date(post.scheduledAt).toLocaleString();

                          if (isFailed) {
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <AlertCircle size={12} color="#EF4444" />
                                <Text style={[styles.fbTimeText, { color: '#EF4444', fontWeight: '700' }]}>
                                  Failed ({formattedDate})
                                </Text>
                              </View>
                            );
                          }

                          if (isPublished) {
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={12} color="#10B981" />
                                <Text style={[styles.fbTimeText, { color: '#10B981', fontWeight: '700' }]}>
                                  Published ({formattedDate})
                                </Text>
                              </View>
                            );
                          }

                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} color={colors.primary} />
                              <Text style={[styles.fbTimeText, { color: colors.primary, fontWeight: '700' }]}>
                                Scheduled: {formattedDate}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {deletingPostIds.includes(post.id) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ActivityIndicator size="small" color="#EF4444" />
                          <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>Deleting...</Text>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => handleDeletePost(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={[styles.fbCaption, { color: colors.textPrimary }]}>{post.caption}</Text>

                    {post.images && post.images.length > 0 && <FacebookMediaGrid images={post.images} />}

                    <View style={[styles.fbFooter, { borderTopColor: colors.border }]}>
                      <View style={styles.fbFooterBtn}>
                        <ThumbsUp size={14} color={colors.textSecondary} />
                        <Text style={[styles.fbFooterText, { color: colors.textSecondary }]}>Like</Text>
                      </View>
                      <View style={styles.fbFooterBtn}>
                        <MessageSquare size={14} color={colors.textSecondary} />
                        <Text style={[styles.fbFooterText, { color: colors.textSecondary }]}>Comment</Text>
                      </View>
                      <View style={styles.fbFooterBtn}>
                        <Share2 size={14} color={colors.textSecondary} />
                        <Text style={[styles.fbFooterText, { color: colors.textSecondary }]}>Share</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              // 2. TILES VIEW (Grid cards)
              if (viewMode === 'tiles') {
                return (
                  <View
                    key={post.id}
                    style={[
                      styles.tileCard,
                      { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.tileHeader}>
                      {isMultiSelectMode && (
                        <TouchableOpacity onPress={() => handleToggleSelectPost(post.id)} style={{ marginRight: 6 }}>
                          {isSelected ? <CheckSquare size={18} color={colors.primary} /> : <Square size={18} color={colors.textSecondary} />}
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.statusBadge, post.status === 'published' ? styles.statusPub : styles.statusSched]}>
                        {post.status.toUpperCase()}
                      </Text>
                      {deletingPostIds.includes(post.id) ? (
                        <ActivityIndicator size="small" color="#EF4444" style={{ marginLeft: 'auto' }} />
                      ) : (
                        <TouchableOpacity onPress={() => handleDeletePost(post)} style={{ marginLeft: 'auto' }}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {post.images && post.images.length > 0 && (
                      <Image source={{ uri: post.images[0] }} style={styles.tileImage} />
                    )}

                    <Text style={[styles.tileCaption, { color: colors.textPrimary }]} numberOfLines={2}>
                      {post.caption || '(No Caption)'}
                    </Text>
                    <Text style={[styles.tileTime, { color: colors.textSecondary }]}>
                      {new Date(post.scheduledAt).toLocaleString()}
                    </Text>
                  </View>
                );
              }

              // 3. COMPACT 1-LINE LIST VIEW (Occupies minimal space)
              return (
                <View
                  key={post.id}
                  style={[
                    styles.listRow,
                    { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                >
                  {isMultiSelectMode && (
                    <TouchableOpacity onPress={() => handleToggleSelectPost(post.id)} style={{ marginRight: 6 }}>
                      {isSelected ? <CheckSquare size={16} color={colors.primary} /> : <Square size={16} color={colors.textSecondary} />}
                    </TouchableOpacity>
                  )}
                  <View style={[styles.miniStatusDot, { backgroundColor: post.status === 'published' ? '#10B981' : '#8B5CF6' }]} />
                  <Text style={[styles.listCaption, { color: colors.textPrimary }]} numberOfLines={1}>
                    {post.caption || '(No Caption)'}
                  </Text>
                  <Text style={[styles.listTime, { color: colors.textSecondary }]}>
                    {new Date(post.scheduledAt).toLocaleDateString()} {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {deletingPostIds.includes(post.id) ? (
                    <ActivityIndicator size="small" color="#EF4444" style={{ marginLeft: 8 }} />
                  ) : (
                    <TouchableOpacity onPress={() => handleDeletePost(post)} style={{ marginLeft: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deletionBarCard: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
  },
  platformDiscsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  platformDisc: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    minWidth: 70,
  },
  discIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  discText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fbPageContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pageSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  pageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  liveBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  pageSub: {
    fontSize: 11,
    marginTop: 2,
  },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  dropdownHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    marginVertical: 2,
  },
  dropdownAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownId: {
    fontSize: 10,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    marginLeft: 6,
  },
  viewModeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsRow: {
    paddingVertical: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888',
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  multiSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  selectToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bulkDeleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  postsListContainer: {
    padding: 16,
    gap: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // FB Feed View Styles
  fbCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  fbCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  fbAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  fbPageName: {
    fontSize: 13,
    fontWeight: '700',
  },
  fbTimeText: {
    fontSize: 11,
  },
  fbCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  fbFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  fbFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fbFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Tile View Styles
  tileCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPub: {
    backgroundColor: '#10B98120',
    color: '#10B981',
  },
  statusSched: {
    backgroundColor: '#8B5CF620',
    color: '#8B5CF6',
  },
  tileImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  tileCaption: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileTime: {
    fontSize: 10,
    marginTop: 4,
  },

  // 1-Line Compact List View Styles
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  miniStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  listCaption: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  listTime: {
    fontSize: 11,
  },
  sourceTabsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sourceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourceTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
