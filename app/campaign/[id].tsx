import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Animated,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  smartNormalizeDate,
  smartNormalizeTime,
} from '../../src/utils/dateTimeHelper';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useSocialAccountsStore } from '../../src/stores/useSocialAccountsStore';
import { useQueueStore } from '../../src/stores/useQueueStore';
import { TopReloadProgressBar } from '../../src/components/common/TopReloadProgressBar';
import { triggerInstantPublish } from '../../src/services/queueEngine';
import { getContainerStatusInfo } from '../../src/utils/containerStatusHelper';
import { deleteMetaScheduledPost } from '../../src/services/facebookPublisher';
import { Post } from '../../src/db/types';
import { extractHashtags, extractMentions } from '../../src/utils/tagSuggestionService';
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
  Clock,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Tag,
  AtSign,
  Globe,
  Repeat,
  Upload,
  CheckSquare,
  Square,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react-native';
import { AddContainerModal } from '../../src/components/container/AddContainerModal';
import Svg, { Circle } from 'react-native-svg';

// Custom circular progress component
interface UploadProgressCircleProps {
  progress: number;
}

const UploadProgressCircle: React.FC<UploadProgressCircleProps> = ({ progress }) => {
  const size = 20;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Option 1: "orange for a while" preparing phase when progress is 0 or very small
  const isPreparing = progress === 0 || progress <= 5;
  const strokeDashoffset = isPreparing 
    ? circumference * 0.45 // 55% circular arc for preparation spinner
    : circumference - (progress / 100) * circumference;

  const strokeColor = isPreparing ? '#F59E0B' : '#10B981'; // Orange for preparing, Green for actual progress

  // Spin animation loop
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isPreparing) {
      // Fast continuous spin during preparing orange phase
      anim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      anim.start();
    } else {
      // Slower gradual rotation during green upload phase, or simple fixed rotation
      anim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      anim.start();
    }

    return () => {
      if (anim) anim.stop();
    };
  }, [isPreparing, spinValue]);

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isPreparing ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Active progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
      {!isPreparing && (
        <Text style={{ fontSize: 7, fontWeight: '900', color: '#10B981', position: 'absolute' }}>
          {progress}
        </Text>
      )}
    </View>
  );
};

const DELETABLE_STATUSES = ['scheduled', 'waiting', 'failed', 'missed'];

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, toggleCampaignPause, triggerNextLoop, addMediaToLoopPool, loadData, deletePost, updatePost, smartDeleteLoopPosts } = useCampaignStore();
  const networkStatus = useQueueStore((state) => state.networkStatus);
  const activePostId = useQueueStore((state) => state.activePostId);

  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Multi-Select Checkboxes state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  // Next Loop Options Modal states
  const [nextLoopModalVisible, setNextLoopModalVisible] = useState(false);
  const [nextLoopEndType, setNextLoopEndType] = useState<'media' | 'date'>('media');
  const getTomorrowString = () => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  };
  const [nextLoopEndDate, setNextLoopEndDate] = useState(getTomorrowString());
  const [nextLoopEndTime, setNextLoopEndTime] = useState('23:59');

  // Force Re-queue: tracks which post IDs are currently being force-processed
  const [forcingPostIds, setForcingPostIds] = useState<string[]>([]);

  // Spin animation for uploading/forcing indicators
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleForceRequeue = useCallback(async (postId: string) => {
    if (forcingPostIds.includes(postId)) return;
    setForcingPostIds((prev) => [...prev, postId]);
    try {
      const result = await triggerInstantPublish(postId);
      if (!result.success && result.error) {
        Alert.alert('Queue Error', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setForcingPostIds((prev) => prev.filter((id) => id !== postId));
    }
  }, [forcingPostIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const container = campaigns.find((c) => c.id === id);
  const containerPosts = posts.filter((p) => p.campaignId === id);

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

  const toggleSelectPost = (postId: string) => {
    if (selectedPostIds.includes(postId)) {
      setSelectedPostIds(selectedPostIds.filter((pid) => pid !== postId));
    } else {
      setSelectedPostIds([...selectedPostIds, postId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPostIds.length === containerPosts.length) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(containerPosts.map((p) => p.id));
    }
  };

  const handleDeleteSinglePost = (post: Post) => {
    const isLoop = container?.isLoopContainer;
    const title = isLoop ? 'Remove Loop Post' : 'Delete Post';
    const loopNote = isLoop
      ? '\n\n✅ Its media will be freed back into the pool so the loop can reuse it.'
      : '\n\nThis will also cancel it on Meta servers.';
    const msg = `Remove this post?${loopNote}`;

    const performDelete = async () => {
      if (isLoop) {
        await smartDeleteLoopPosts(container!.id, [post.id]);
      } else {
        await deletePost(post.id);
        const fbAcc = useSocialAccountsStore.getState().getAccount('facebook');
        if (fbAcc?.accessToken) {
          const targetFbId = post.facebookPostId || post.id;
          await deleteMetaScheduledPost(fbAcc.accessToken, targetFbId, fbAcc.pageId || 'me');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${msg}`)) {
        performDelete();
      }
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: isLoop ? 'Remove & Reclaim Media' : 'Delete Post', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPostIds.length === 0) return;
    const isLoop = container?.isLoopContainer;
    const count = selectedPostIds.length;
    const title = isLoop ? 'Remove Loop Posts' : 'Delete Selected Posts';
    const msg = isLoop
      ? `Remove ${count} post(s)? Their media will be freed back into the pool so the loop can reuse them.`
      : `Are you sure you want to delete ${count} selected post(s)?`;

    const performBulkDelete = async () => {
      if (isLoop) {
        const result = await smartDeleteLoopPosts(container!.id, selectedPostIds);
        setSelectedPostIds([]);
        setIsMultiSelectMode(false);
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.alert(`Done: Removed ${result.deleted} post(s). ${result.reclaimed} media file(s) returned to pool.`);
        } else {
          Alert.alert('✅ Done', `Removed ${result.deleted} post(s). ${result.reclaimed} media file(s) returned to the pool.`);
        }
      } else {
        const fbAcc = useSocialAccountsStore.getState().getAccount('facebook');
        for (const pid of selectedPostIds) {
          const pObj = containerPosts.find((p) => p.id === pid);
          await deletePost(pid);
          if (fbAcc?.accessToken && pObj) {
            const targetFbId = pObj.facebookPostId || pObj.id;
            await deleteMetaScheduledPost(fbAcc.accessToken, targetFbId, fbAcc.pageId || 'me');
          }
        }
        setSelectedPostIds([]);
        setIsMultiSelectMode(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${msg}`)) {
        performBulkDelete();
      }
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performBulkDelete },
      ]);
    }
  };

  const scheduledCount = containerPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'waiting'
  ).length;

  const statusInfo = getContainerStatusInfo(container, posts, networkStatus, activePostId);

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
      <TopReloadProgressBar loading={refreshing} />
      {/* Top Navigation Bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleSafeBack} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {container.title}
        </Text>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedPostIds([]);
            }}
            style={[
              styles.headerTrashBtn,
              {
                backgroundColor: isMultiSelectMode ? '#EF444420' : colors.surfaceVariant,
                borderColor: isMultiSelectMode ? '#EF4444' : colors.border,
              },
            ]}
          >
            <Trash2 size={16} color={isMultiSelectMode ? '#EF4444' : colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setEditModalVisible(true)}
            style={[styles.editHeaderBtn, { backgroundColor: colors.primaryContainer }]}
          >
            <Edit3 size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Multi-Select Floating Action Bar */}
      {isMultiSelectMode && (() => {
        const deletableCount = containerPosts.filter((p) => DELETABLE_STATUSES.includes(p.status)).length;
        const totalCount = containerPosts.length;
        const allDeletableSelected = container.isLoopContainer
          ? containerPosts.filter((p) => DELETABLE_STATUSES.includes(p.status)).every((p) => selectedPostIds.includes(p.id)) && deletableCount > 0
          : selectedPostIds.length === totalCount && totalCount > 0;

        return (
          <View style={[styles.multiSelectActionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleSelectAll}
              style={styles.selectAllRow}
            >
              {allDeletableSelected ? (
                <CheckSquare size={18} color={colors.primary} />
              ) : (
                <Square size={18} color={colors.textSecondary} />
              )}
              <View>
                <Text style={[styles.selectAllText, { color: colors.textPrimary }]}>
                  {container.isLoopContainer ? 'Select Unpublished' : 'Select All'} ({selectedPostIds.length}/{container.isLoopContainer ? deletableCount : totalCount})
                </Text>
                {container.isLoopContainer && (
                  <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>
                    Published posts are protected
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDeleteSelected}
              disabled={selectedPostIds.length === 0}
              style={[
                styles.deleteBatchBtn,
                { backgroundColor: selectedPostIds.length > 0 ? '#EF4444' : colors.border },
              ]}
            >
              <Trash2 size={14} color="#FFFFFF" />
              <Text style={styles.deleteBatchBtnText}>
                {container.isLoopContainer ? 'Remove & Reclaim' : 'Delete'} ({selectedPostIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      <ScrollView
        style={{ flex: 1, opacity: refreshing ? 0.55 : 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1877F2']}
            tintColor="#1877F2"
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

            {/* Live Status Pill */}
            <View
              style={[
                styles.coverStatusBadge,
                { backgroundColor: statusInfo.badgeColor + 'CC' },
              ]}
            >
              {statusInfo.status === 'paused' && <Pause size={10} color="#FFFFFF" />}
              {statusInfo.status === 'calculating' && <Clock size={10} color="#FFFFFF" />}
              {statusInfo.status === 'scheduling' && <RefreshCw size={10} color="#FFFFFF" />}
              {statusInfo.status === 'waiting_network' && <WifiOff size={10} color="#FFFFFF" />}
              {statusInfo.status === 'finished' && <CheckCircle2 size={10} color="#FFFFFF" />}
              {statusInfo.status === 'failed' && <AlertCircle size={10} color="#FFFFFF" />}
              {statusInfo.status === 'idle' && <Play size={10} color="#FFFFFF" />}
              <Text style={styles.coverStatusText}>{statusInfo.label}</Text>
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
                onPress={() => {
                  // Set default end date to tomorrow or next week, pre-fill end date limit
                  setNextLoopEndDate(getTomorrowString());
                  setNextLoopEndType(container.hasEndDateLimit ? 'date' : 'media');
                  if (container.endDate) setNextLoopEndDate(container.endDate);
                  if (container.endTime) setNextLoopEndTime(container.endTime);
                  setNextLoopModalVisible(true);
                }}
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
          const isSelected = selectedPostIds.includes(post.id);
          const isFailedOrConnectionIssue = post.status === 'failed' || post.status === 'missed';
          const isPastOrPublished =
            !isFailedOrConnectionIssue && (post.status === 'published' || Date.parse(post.scheduledAt) <= Date.now());
          const isUploading = post.status === 'uploading' || post.id === activePostId;
          const isForcing = forcingPostIds.includes(post.id);
          const isActive = isUploading || isForcing;
          // A post is "stuck" if it's scheduled/waiting/paused but NOT currently active
          const isStuck =
            !isActive &&
            !isFailedOrConnectionIssue &&
            !isPastOrPublished &&
            (post.status === 'scheduled' || post.status === 'waiting' || post.status === 'paused');
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
                {
                  backgroundColor: isSelected ? colors.primaryContainer + '30' : colors.surface,
                  borderColor: isSelected
                    ? colors.primary
                    : isActive
                    ? colors.warning + 'AA'
                    : isFailedOrConnectionIssue
                    ? '#EF4444'
                    : colors.border,
                  borderWidth: isSelected || isFailedOrConnectionIssue || isActive ? 1.5 : 1,
                },
              ]}
            >
              {/* Minimized Header Row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (isMultiSelectMode) {
                    toggleSelectPost(post.id);
                  } else {
                    setExpandedPostId(isExpanded ? null : post.id);
                  }
                }}
                style={styles.minimizedHeader}
              >
                <View style={styles.minimizedLeft}>
                  {/* Multi-Select Checkbox */}
                  {isMultiSelectMode ? (
                    container?.isLoopContainer && !DELETABLE_STATUSES.includes(post.status) ? (
                      <View style={{ marginRight: 8, opacity: 0.6 }}>
                        <CheckCircle2 size={18} color={colors.success} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => toggleSelectPost(post.id)}
                        style={{ marginRight: 8 }}
                      >
                        {isSelected ? (
                          <CheckSquare size={20} color={colors.primary} />
                        ) : (
                          <Square size={20} color={colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    )
                  ) : (
                    <View style={[styles.numBadge, { backgroundColor: colors.primaryContainer }]}>
                      <Text style={[styles.numBadgeText, { color: colors.primary }]}>#{index + 1}</Text>
                    </View>
                  )}

                  <View style={styles.headerTitleCol}>
                    {/* Top/Left Scheduled Time Pill or Status Pill */}
                    {isFailedOrConnectionIssue ? (
                      <View style={[styles.scheduledPill, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }]}>
                        <AlertCircle size={11} color="#EF4444" />
                        <Text style={[styles.scheduledPillText, { color: '#EF4444', fontWeight: '800' }]}>
                          Internet / Upload Issue
                        </Text>
                      </View>
                    ) : isPastOrPublished ? (
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

                  {/* Force Re-queue button for stuck posts */}
                  {!isMultiSelectMode && isStuck && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation && e.stopPropagation();
                        handleForceRequeue(post.id);
                      }}
                      style={styles.forceQueueBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <RefreshCw size={13} color={colors.warning} />
                    </TouchableOpacity>
                  )}

                  {/* Spinning upload indicator */}
                  {isActive ? (
                    <UploadProgressCircle progress={post.uploadProgress || 0} />
                  ) : (
                    <>
                      {!isMultiSelectMode && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation && e.stopPropagation();
                            handleDeleteSinglePost(post);
                          }}
                          style={styles.postTrashIconBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={18} color={colors.textSecondary} />
                      ) : (
                        <ChevronDown size={18} color={colors.textSecondary} />
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Internet Upload Failure & Retry Button Row */}
              {isFailedOrConnectionIssue && (
                <View style={[styles.failureRetryBox, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
                  <Text style={styles.failureReasonText} numberOfLines={1}>
                    ⚠️ {post.failureReason || 'Post failed due to network / internet connectivity'}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={async () => {
                      const retryTime = new Date(Date.now() + 5 * 60000).toISOString();
                      await updatePost(post.id, {
                        status: 'scheduled',
                        scheduledAt: retryTime,
                        failureReason: null,
                      });
                      Alert.alert('Re-queued', 'Post has been reset and scheduled to retry in 5 minutes!');
                    }}
                    style={styles.retryBtn}
                  >
                    <RefreshCw size={12} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Retry Upload</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Expanded Real Post Preview */}
              {isExpanded && (
                <View style={[styles.expandedBody, { borderTopColor: colors.border }]}>
                  <Text style={[styles.fullCaption, { color: colors.textPrimary }]}>
                    {post.caption}
                  </Text>

                  {/* Hashtags & Mentions Pills */}
                  {(() => {
                    const postHashtags = post.hashtags && post.hashtags.length > 0 ? post.hashtags : extractHashtags(post.caption);
                    const postMentions = post.mentions && post.mentions.length > 0 ? post.mentions : extractMentions(post.caption);
                    if (postHashtags.length === 0 && postMentions.length === 0) return null;

                    return (
                      <View style={styles.tagsRow}>
                        {postHashtags.map((tag) => (
                          <View
                            key={tag}
                            style={[styles.tagPill, { backgroundColor: colors.primaryContainer }]}
                          >
                            <Tag size={10} color={colors.primary} />
                            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}

                        {postMentions.map((men) => (
                          <View
                            key={men}
                            style={[styles.tagPill, { backgroundColor: '#3B82F618', borderColor: '#3B82F640', borderWidth: 1 }]}
                          >
                            <AtSign size={10} color="#3B82F6" />
                            <Text style={[styles.tagText, { color: '#3B82F6', fontWeight: '800' }]}>{men}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}

                  {/* First Comment Box */}
                  {post.firstComment && post.firstComment.trim() !== '' && (
                    <View style={{ backgroundColor: colors.primaryContainer + '20', borderColor: colors.primary + '50', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <MessageSquare size={12} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>FIRST COMMENT</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 16 }}>{post.firstComment}</Text>
                    </View>
                  )}

                  {/* Facebook Multi-Image Grid View */}
                  {post.images && post.images.length > 0 && (
                    <FacebookMediaGrid images={post.images} />
                  )}

                  {/* Scheduled Time info & Delete button */}
                  <View style={styles.scheduleInfoRow}>
                    <View style={styles.scheduleInfoLeft}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={[styles.scheduleInfoText, { color: colors.textSecondary }]}>
                        Scheduled for {new Date(post.scheduledAt).toLocaleString()}
                      </Text>
                    </View>

                    {(!container?.isLoopContainer || DELETABLE_STATUSES.includes(post.status)) && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleDeleteSinglePost(post)}
                        style={[styles.expandedDeleteBtn, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }]}
                      >
                        <Trash2 size={12} color="#EF4444" />
                        <Text style={[styles.expandedDeleteBtnText, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
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

      {/* Next Loop Configuration Modal */}
      <Modal
        visible={nextLoopModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNextLoopModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, width: '92%', maxWidth: 440 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Repeat size={20} color="#10B981" />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Next Loop Round {(container.currentLoopRound || 1) + 1}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setNextLoopModalVisible(false)}
                style={{ padding: 4 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
                Configure how to terminate the scheduling for this upcoming loop round.
              </Text>

              {/* Option 1: End by Media Pool Completion */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setNextLoopEndType('media')}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: nextLoopEndType === 'media' ? '#10B98115' : colors.surfaceVariant,
                    borderColor: nextLoopEndType === 'media' ? '#10B981' : colors.border,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <View style={styles.optionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CheckSquare
                      size={18}
                      color={nextLoopEndType === 'media' ? '#10B981' : colors.textSecondary}
                    />
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      Complete Media Pool
                    </Text>
                  </View>
                  <Sparkles size={16} color="#10B981" />
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>
                  Schedule posts continuously until all media in the pool are utilized. Ignores date limitations.
                </Text>
              </TouchableOpacity>

              {/* Option 2: Hard Stop Date & Time */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setNextLoopEndType('date')}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: nextLoopEndType === 'date' ? '#10B98115' : colors.surfaceVariant,
                    borderColor: nextLoopEndType === 'date' ? '#10B981' : colors.border,
                    borderWidth: 1.5,
                    marginTop: 12,
                  },
                ]}
              >
                <View style={styles.optionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CheckSquare
                      size={18}
                      color={nextLoopEndType === 'date' ? '#10B981' : colors.textSecondary}
                    />
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      Hard Stop Date & Time
                    </Text>
                  </View>
                  <Clock size={16} color="#3B82F6" />
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>
                  Stop scheduling immediately when reaching a specified date and time, even if media items remain.
                </Text>
              </TouchableOpacity>

              {/* Date & Time fields if Hard Stop is chosen */}
              {nextLoopEndType === 'date' && (
                <View style={[styles.dateFormBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                    Define Hard Cutoff:
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {/* Date Input */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>
                        Stop Date (YYYY-MM-DD)
                      </Text>
                      <View style={[styles.modalInputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <TextInput
                          value={nextLoopEndDate}
                          onChangeText={setNextLoopEndDate}
                          onBlur={() => setNextLoopEndDate(smartNormalizeDate(nextLoopEndDate))}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                          style={{ color: colors.textPrimary, fontSize: 13, paddingVertical: 6 }}
                        />
                      </View>
                    </View>

                    {/* Time Input */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>
                        Stop Time (HH:MM)
                      </Text>
                      <View style={[styles.modalInputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <TextInput
                          value={nextLoopEndTime}
                          onChangeText={setNextLoopEndTime}
                          onBlur={() => setNextLoopEndTime(smartNormalizeTime(nextLoopEndTime))}
                          placeholder="23:59"
                          placeholderTextColor={colors.textMuted}
                          style={{ color: colors.textPrimary, fontSize: 13, paddingVertical: 6 }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Confirm Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setNextLoopModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  if (nextLoopEndType === 'date') {
                    const cleanD = smartNormalizeDate(nextLoopEndDate);
                    const cleanT = smartNormalizeTime(nextLoopEndTime);
                    const parsed = Date.parse(`${cleanD}T${cleanT}:00`);
                    if (isNaN(parsed)) {
                      Alert.alert('Invalid Date/Time', 'Please use YYYY-MM-DD and HH:MM format.');
                      return;
                    }
                    if (parsed <= Date.now()) {
                      Alert.alert('Past Date/Time', 'Cutoff date/time must be in the future.');
                      return;
                    }

                    setNextLoopModalVisible(false);
                    await triggerNextLoop(container.id, {
                      endType: 'date',
                      endDate: cleanD,
                      endTime: cleanT,
                    });
                  } else {
                    setNextLoopModalVisible(false);
                    await triggerNextLoop(container.id, {
                      endType: 'media',
                    });
                  }
                }}
                style={[styles.modalBtn, { backgroundColor: '#10B981' }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                  Generate Round {(container.currentLoopRound || 1) + 1}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  coverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  coverStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTrashBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiSelectActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  failureRetryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  failureReasonText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  postTrashIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EF444415',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  forceQueueBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F59E0B18',
    borderWidth: 1,
    borderColor: '#F59E0B55',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  scheduleInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  expandedDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  expandedDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateFormBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalInputBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
