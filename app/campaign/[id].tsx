import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { PlatformBadge } from '../../src/components/common/PlatformBadge';
import { FacebookMediaGrid } from '../../src/components/common/FacebookMediaGrid';
import { pickLocalMedia } from '../../src/utils/mediaPicker';
import {
  ArrowLeft,
  Play,
  Pause,
  Edit3,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Globe,
  Repeat,
  Upload,
  CheckCircle2,
} from 'lucide-react-native';
import { AddContainerModal } from '../../src/components/container/AddContainerModal';

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, toggleCampaignPause, triggerNextLoop, addMediaToLoopPool, loadData } = useCampaignStore();

  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const container = campaigns.find((c) => c.id === id);
  const containerPosts = posts.filter((p) => p.campaignId === id);

    containerPosts.length > 0 ? containerPosts[0].id : null
  );
  const [editModalVisible, setEditModalVisible] = useState(false);

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (!container) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.notFoundBox}>
          <Text style={[styles.notFoundText, { color: colors.textPrimary }]}>
            Container Not Found
          </Text>
          <TouchableOpacity onPress={handleSafeBack} style={styles.backBtn}>
            <Text style={{ color: colors.primary }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const scheduledCount = containerPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'waiting'
  ).length;

  const defaultThumbnail =
    container.thumbnailUri ||
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60';

  const getFirst5Words = (text: string) => {
    if (!text || text.trim() === '') return 'Empty post caption...';
    const words = text.trim().split(/\s+/);
    if (words.length <= 5) return words.join(' ');
    return words.slice(0, 5).join(' ') + '...';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleSafeBack} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {container.title}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setEditModalVisible(true)}
          style={[styles.editHeaderBtn, { backgroundColor: colors.primaryContainer }]}
        >
          <Edit3 size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Container Cover Thumbnail Card */}
        <View style={[styles.coverCard, { borderColor: colors.border }]}>
          <Image source={{ uri: defaultThumbnail }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverOverlay}>
            <View style={styles.platformsRow}>
              {(container.platforms || ['facebook', 'instagram']).map((plat) => (
                <PlatformBadge key={plat} platform={plat} showLabel />
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleCampaignPause(container.id)}
              style={[
                styles.runPauseBtn,
                { backgroundColor: container.isPaused ? colors.warning : colors.success },
              ]}
            >
              {container.isPaused ? (
                <>
                  <Play size={12} color="#FFFFFF" />
                  <Text style={styles.runPauseText}>RUN CONTAINER</Text>
                </>
              ) : (
                <>
                  <Pause size={12} color="#FFFFFF" />
                  <Text style={styles.runPauseText}>PAUSE CONTAINER</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Layers size={18} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {scheduledCount} / {containerPosts.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Scheduled</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Sparkles size={18} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {container.smartSchedulingEnabled ? `${container.intervalMinutes}m` : 'Custom'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Spreading</Text>
          </View>
        </View>

        {/* Loop Container Status Banner & Controls */}
        {container.isLoopContainer && (
          <View style={[styles.loopStatusCard, { backgroundColor: colors.surface, borderColor: '#8B5CF6' }]}>
            <View style={styles.loopStatusHeader}>
              <View style={styles.loopStatusTitleLeft}>
                <Repeat size={18} color="#8B5CF6" />
                <Text style={[styles.loopStatusTitle, { color: colors.textPrimary }]}>
                  Media current round: {container.currentLoopRound || 1}
                </Text>
              </View>
              {container.isLoopCompleted && (
                <View style={styles.mediaDonePill}>
                  <CheckCircle2 size={12} color="#10B981" />
                  <Text style={styles.mediaDoneText}>Media done</Text>
                </View>
              )}
            </View>

            <View style={styles.loopInfoMetricsRow}>
              <View style={styles.loopMetricCell}>
                <Text style={[styles.loopMetricVal, { color: '#8B5CF6' }]}>
                  #{container.currentLoopRound || 1}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary }]}>Current Round</Text>
              </View>
              <View style={styles.loopMetricCell}>
                <Text style={[styles.loopMetricVal, { color: colors.textPrimary }]}>
                  {container.loopMediaPool?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary }]}>Media Pool</Text>
              </View>
              <View style={styles.loopMetricCell}>
                <Text style={[styles.loopMetricVal, { color: colors.textPrimary }]}>
                  {container.usedMediaUris?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary }]}>Used Media</Text>
              </View>
              <View style={styles.loopMetricCell}>
                <Text style={[styles.loopMetricVal, { color: colors.textPrimary }]}>
                  {container.loopDescriptions?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary }]}>Captions</Text>
              </View>
            </View>

            <View style={styles.loopActionBtnsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => triggerNextLoop(container.id)}
                style={[styles.nextLoopMainBtn, { backgroundColor: '#10B981' }]}
              >
                <Repeat size={14} color="#FFFFFF" />
                <Text style={styles.nextLoopMainBtnText}>Next Loop (Round {(container.currentLoopRound || 1) + 1})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  const picked = await pickLocalMedia();
                  if (picked && picked.length > 0) {
                    await addMediaToLoopPool(container.id, picked);
                  }
                }}
                style={[styles.addMediaLoopBtn, { backgroundColor: colors.primaryContainer }]}
              >
                <Upload size={14} color={colors.primary} />
                <Text style={[styles.addMediaLoopBtnText, { color: colors.primary }]}>+ Add Photos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Posts List */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          CONTAINER POSTS ({containerPosts.length})
        </Text>

        {containerPosts.map((post, index) => {
          const isExpanded = expandedPostId === post.id;
          const isPastOrPublished =
            post.status === 'published' || Date.parse(post.scheduledAt) <= Date.now();
          const formattedSchedule = new Date(post.scheduledAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View
              key={post.id}
              style={[
                styles.postCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Minimized Header Row: Scheduled Time Top/Left + First 5 Words */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setExpandedPostId(isExpanded ? null : post.id)}
                style={styles.minimizedHeader}
              >
                <View style={styles.minimizedLeft}>
                  <View style={[styles.numBadge, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.numBadgeText, { color: colors.primary }]}>#{index + 1}</Text>
                  </View>

                  <View style={styles.headerTitleCol}>
                    {/* Top/Left Scheduled Time Pill or Green Check Tick when reached/passed */}
                    {isPastOrPublished ? (
                      <View style={[styles.scheduledPill, { backgroundColor: '#10B98118', borderColor: '#10B981', borderWidth: 1 }]}>
                        <CheckCircle2 size={11} color="#10B981" />
                        <Text style={[styles.scheduledPillText, { color: '#10B981', fontWeight: '800' }]}>
                          Published ✔
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.scheduledPill, { backgroundColor: colors.primaryContainer }]}>
                        <Clock size={10} color={colors.primary} />
                        <Text style={[styles.scheduledPillText, { color: colors.primary }]}>
                          {formattedSchedule}
                        </Text>
                        <Globe size={10} color={colors.success} />
                      </View>
                    )}

                    <Text style={[styles.minimizedTitleText, { color: colors.textPrimary }]}>
                      {getFirst5Words(post.caption)}
                    </Text>
                  </View>
                </View>

                <View style={styles.minimizedRight}>
                  {post.images && post.images.length > 0 && (
                    <Text style={[styles.mediaBadgeText, { color: colors.textSecondary }]}>
                      📷 {post.images.length}
                    </Text>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={18} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={18} color={colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Expanded Real Post Preview */}
              {isExpanded && (
                <View style={[styles.expandedBody, { borderTopColor: colors.border }]}>
                  <Text style={[styles.fullCaption, { color: colors.textPrimary }]}>
                    {post.caption}
                  </Text>

                  {/* Hashtags & Mentions */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {post.hashtags.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.tagPill, { backgroundColor: colors.primaryContainer }]}
                        >
                          <Tag size={10} color={colors.primary} />
                          <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Facebook Multi-Image Grid View */}
                  {post.images && post.images.length > 0 && (
                    <FacebookMediaGrid images={post.images} />
                  )}

                  {/* Scheduled Time info */}
                  <View style={styles.scheduleInfoRow}>
                    <Clock size={12} color={colors.textSecondary} />
                    <Text style={[styles.scheduleInfoText, { color: colors.textSecondary }]}>
                      Scheduled for {new Date(post.scheduledAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Container Modal */}
      <AddContainerModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        existingContainer={container}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 60,
    marginTop: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  iconBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginHorizontal: 12,
  },
  editHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  coverCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 14,
    justifyContent: 'space-between',
  },
  platformsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  runPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  runPauseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  minimizedHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minimizedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitleCol: {
    flex: 1,
  },
  scheduledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  scheduledPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  numBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  minimizedTitleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  minimizedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedBody: {
    padding: 14,
    borderTopWidth: 1,
  },
  fullCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  scheduleInfoText: {
    fontSize: 11,
  },
  notFoundBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  backBtn: {
    padding: 10,
  },
  loopStatusCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 20,
  },
  loopStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  loopStatusTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loopStatusTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  mediaDonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98118',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  mediaDoneText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  loopInfoMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    marginBottom: 12,
  },
  loopMetricCell: {
    alignItems: 'center',
  },
  loopMetricVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  loopMetricLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  loopActionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nextLoopMainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    gap: 6,
  },
  nextLoopMainBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  addMediaLoopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  addMediaLoopBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
