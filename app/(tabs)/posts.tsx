import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useSocialAccountsStore, SavedFacebookPage } from '../../src/stores/useSocialAccountsStore';
import { Header } from '../../src/components/common/Header';
import { FacebookMediaGrid } from '../../src/components/common/FacebookMediaGrid';
import { deleteMetaScheduledPost } from '../../src/services/facebookPublisher';
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
  const { posts, deletePost } = useCampaignStore();
  const { accounts, savedFacebookPages, switchFacebookPage, getAccount } = useSocialAccountsStore();

  // State
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('facebook');
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('fb');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  // Active Facebook Account
  const activeFbAccount = getAccount('facebook');
  const activePageName = activeFbAccount?.displayName || 'Facebook Page';
  const activePageId = activeFbAccount?.pageId || 'me';
  const activeAvatar =
    activeFbAccount?.avatarUrl ||
    `https://graph.facebook.com/v19.0/${activePageId}/picture?type=square`;

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Platform filter
      if (post.platforms && post.platforms.length > 0) {
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
  }, [posts, selectedPlatform, statusFilter, dateFilter, searchQuery]);

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
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post from the container and cancel it on Meta server?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Post',
          style: 'destructive',
          onPress: async () => {
            await deletePost(post.id);
            if (activeFbAccount?.accessToken) {
              await deleteMetaScheduledPost(activeFbAccount.accessToken, post.id);
            }
          },
        },
      ]
    );
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedPostIds.length === 0) return;
    Alert.alert(
      'Bulk Delete Posts',
      `Delete ${selectedPostIds.length} selected post(s) from app & cancel on Meta server?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Selected',
          style: 'destructive',
          onPress: async () => {
            for (const pid of selectedPostIds) {
              await deletePost(pid);
              if (activeFbAccount?.accessToken) {
                await deleteMetaScheduledPost(activeFbAccount.accessToken, pid);
              }
            }
            setSelectedPostIds([]);
            setIsMultiSelectMode(false);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Posts Manager" subtitle="Manage & filter scheduled posts across pages" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
        {filteredPosts.length === 0 ? (
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Clock size={11} color={colors.textSecondary} />
                          <Text style={[styles.fbTimeText, { color: colors.textSecondary }]}>
                            Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleDeletePost(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
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
                      <TouchableOpacity onPress={() => handleDeletePost(post)} style={{ marginLeft: 'auto' }}>
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
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
                  <TouchableOpacity onPress={() => handleDeletePost(post)} style={{ marginLeft: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
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
});
