import React, { useState, useCallback, useRef, useEffect } from 'react';
declare const window: any;
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
  FlatList,
  Dimensions,
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
  Info,
  Calendar,
  Image as ImageIcon,
  Plus,
} from 'lucide-react-native';
import { AddContainerModal } from '../../src/components/container/AddContainerModal';
import Svg, { Circle } from 'react-native-svg';

const DELETABLE_STATUSES = ['scheduled', 'waiting', 'failed', 'missed'];

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
  
  // Media Pool Grid Modal states
  const [mediaPoolModalVisible, setMediaPoolModalVisible] = useState(false);
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [mediaPoolTab, setMediaPoolTab] = useState<'all' | 'fresh' | 'used'>('all');
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // Captions Manager modal states
  const [captionsModalVisible, setCaptionsModalVisible] = useState(false);
  const [isCaptionsMultiSelect, setIsCaptionsMultiSelect] = useState(false);
  const [selectedCaptionIndices, setSelectedCaptionIndices] = useState<number[]>([]);
  const [expandedCaptionIndices, setExpandedCaptionIndices] = useState<number[]>([]);
  const [newCaptionText, setNewCaptionText] = useState('');
  const [isAddingCaption, setIsAddingCaption] = useState(false);
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

  // Add caption handler (supports bulk paste - 1 per line)
  const handleAddCaptions = async () => {
    if (!newCaptionText.trim()) return;
    const lines = newCaptionText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length === 0) return;

    const currentDescs = container.loopDescriptions || [];
    const updatedDescs = [...currentDescs, ...lines];
    await updatePost(container.id, { loopDescriptions: updatedDescs } as any); // Update via store/DB
    setNewCaptionText('');
    setIsAddingCaption(false);
  };

  // Delete selected captions handler
  const handleDeleteCaptions = async () => {
    const currentDescs = container.loopDescriptions || [];
    if (selectedCaptionIndices.length === 0) return;
    const updatedDescs = currentDescs.filter((_, idx) => !selectedCaptionIndices.includes(idx));
    await updatePost(container.id, { loopDescriptions: updatedDescs } as any); // Update via store/DB
    setSelectedCaptionIndices([]);
    setIsCaptionsMultiSelect(false);
  };

  const toggleSelectAllCaptions = () => {
    const currentDescs = container.loopDescriptions || [];
    if (selectedCaptionIndices.length === currentDescs.length) {
      setSelectedCaptionIndices([]);
    } else {
      setSelectedCaptionIndices(currentDescs.map((_, idx) => idx));
    }
  };

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
            onPress={() => setInfoModalVisible(true)}
            style={[styles.infoHeaderBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            <Info size={15} color={colors.primary} />
          </TouchableOpacity>

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
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMediaPoolModalVisible(true)}
                style={styles.loopMetricCell}
              >
                <Text style={[styles.loopMetricVal, { color: colors.primary }]}>
                  {container.loopMediaPool?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary, textDecorationLine: 'underline' }]}>Media Pool</Text>
              </TouchableOpacity>
              <View style={styles.loopMetricCell}>
                <Text style={[styles.loopMetricVal, { color: colors.textPrimary }]}>
                  {container.usedMediaUris?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary }]}>Used Media</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setIsCaptionsMultiSelect(false);
                  setSelectedCaptionIndices([]);
                  setExpandedCaptionIndices([]);
                  setIsAddingCaption(false);
                  setCaptionsModalVisible(true);
                }}
                style={styles.loopMetricCell}
              >
                <Text style={[styles.loopMetricVal, { color: colors.textPrimary }]}>
                  {container.loopDescriptions?.length || 0}
                </Text>
                <Text style={[styles.loopMetricLabel, { color: colors.textSecondary, textDecorationLine: 'underline' }]}>Captions</Text>
              </TouchableOpacity>
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
                        <Text style={[styles.scheduledPillText, { color: '#EF4444', fontWeight: '800' }]}>{'Internet / Upload Issue'}</Text>
                      </View>
                    ) : isPastOrPublished ? (
                      <View style={[styles.scheduledPill, { backgroundColor: '#10B98118', borderColor: '#10B981', borderWidth: 1 }]}>
                        <CheckCircle2 size={11} color="#10B981" />
                        <Text style={[styles.scheduledPillText, { color: '#10B981', fontWeight: '800' }]}>{'Published \u2714'}</Text>
                      </View>
                    ) : (
                      <View style={[styles.scheduledPill, { backgroundColor: colors.primaryContainer }]}>
                        <Clock size={10} color={colors.primary} />
                        <Text style={[styles.scheduledPillText, { color: colors.primary }]}>{formattedSchedule}</Text>
                        <Globe size={10} color={colors.success} />
                      </View>
                    )}
                    <Text style={[styles.minimizedTitleText, { color: colors.textPrimary }]}>{getFirst5Words(post.caption)}</Text>
                  </View>
                </View>
                <View style={styles.minimizedRight}>
                  {post.images && post.images.length > 0 && (
                    <Text style={[styles.mediaBadgeText, { color: colors.textSecondary }]}>
                      {'\ud83d\udcf7 ' + post.images.length}
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
                    {'\u26a0\ufe0f ' + (post.failureReason || 'Post failed due to network / internet connectivity')}
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
                    <Text style={styles.retryBtnText}>{'Retry Upload'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Expanded Real Post Preview */}
              {isExpanded && (
                <View style={[styles.expandedBody, { borderTopColor: colors.border }]}>
                  <Text style={[styles.fullCaption, { color: colors.textPrimary }]}>{post.caption}</Text>
                  {/* Hashtags & Mentions Pills */}
                  {(() => {
                    const postHashtags = post.hashtags && post.hashtags.length > 0 ? post.hashtags : extractHashtags(post.caption);
                    const postMentions = post.mentions && post.mentions.length > 0 ? post.mentions : extractMentions(post.caption);
                    if (postHashtags.length === 0 && postMentions.length === 0) return null;
                    return (
                      <View style={styles.tagsRow}>
                        {postHashtags.map((tag) => (
                          <View key={tag} style={[styles.tagPill, { backgroundColor: colors.primaryContainer }]}>
                            <Tag size={10} color={colors.primary} />
                            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                        {postMentions.map((men) => (
                          <View key={men} style={[styles.tagPill, { backgroundColor: '#3B82F618', borderColor: '#3B82F640', borderWidth: 1 }]}>
                            <AtSign size={10} color="#3B82F6" />
                            <Text style={[styles.tagText, { color: '#3B82F6', fontWeight: '800' }]}>{men}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                  {/* First Comment Box */}
                  {!!post.firstComment && post.firstComment.trim() !== '' && (() => {
                    const commentHashtags = extractHashtags(post.firstComment);
                    const commentMentions = extractMentions(post.firstComment);
                    return (
                      <View style={{ backgroundColor: colors.primaryContainer + '20', borderColor: colors.primary + '50', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6, marginBottom: 4 }}>
                          <MessageSquare size={12} color={colors.primary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>{'FIRST COMMENT'}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 16, marginBottom: (commentHashtags.length > 0 || commentMentions.length > 0) ? 8 : 0 }}>{post.firstComment}</Text>
                        
                        {(commentHashtags.length > 0 || commentMentions.length > 0) && (
                          <View style={[styles.tagsRow, { marginTop: 4, marginBottom: 0 }]}>
                            {commentHashtags.map((tag) => (
                              <View key={tag} style={[styles.tagPill, { backgroundColor: colors.primaryContainer }]}>
                                <Tag size={10} color={colors.primary} />
                                <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                              </View>
                            ))}
                            {commentMentions.map((men) => (
                              <View key={men} style={[styles.tagPill, { backgroundColor: '#3B82F618', borderColor: '#3B82F640', borderWidth: 1 }]}>
                                <AtSign size={10} color="#3B82F6" />
                                <Text style={[styles.tagText, { color: '#3B82F6', fontWeight: '800' }]}>{men}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                  {/* Facebook Multi-Image Grid View */}
                  {post.images && post.images.length > 0 && (
                    <FacebookMediaGrid images={post.images} />
                  )}
                  {/* Scheduled Time info & Delete button */}
                  <View style={styles.scheduleInfoRow}>
                    <View style={styles.scheduleInfoLeft}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={[styles.scheduleInfoText, { color: colors.textSecondary }]}>
                        {'Scheduled for ' + new Date(post.scheduledAt).toLocaleString()}
                      </Text>
                    </View>
                    {(!container?.isLoopContainer || DELETABLE_STATUSES.includes(post.status)) && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleDeleteSinglePost(post)}
                        style={[styles.expandedDeleteBtn, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }]}
                      >
                        <Trash2 size={12} color="#EF4444" />
                        <Text style={[styles.expandedDeleteBtnText, { color: '#EF4444' }]}>{'Delete'}</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
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

                  <View style={{ flexDirection: 'row', columnGap: 12 }}>
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

      {/* Media Pool Grid Modal */}
      <Modal
        visible={mediaPoolModalVisible}
        animationType="slide"
        onRequestClose={() => setMediaPoolModalVisible(false)}
      >
        <View style={[styles.fullScreenModalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.fullScreenModalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Layers size={20} color={colors.primary} />
              <Text style={[styles.fullScreenModalTitle, { color: colors.textPrimary }]}>
                {'Media Pool (' + (container.loopMediaPool?.length || 0) + ')'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setMediaPoolModalVisible(false)}
              style={styles.closeBtn}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tabs Row */}
          {(() => {
            const pool = container.loopMediaPool || [];
            const usedSet = new Set(container.usedMediaUris || []);
            const freshCount = pool.filter(u => !usedSet.has(u)).length;
            const usedCount = pool.filter(u => usedSet.has(u)).length;
            const tabs: { key: 'all' | 'fresh' | 'used'; label: string; count: number; color: string }[] = [
              { key: 'all',   label: 'All',          count: pool.length, color: colors.primary },
              { key: 'fresh', label: 'Fresh Media',  count: freshCount,  color: '#8B5CF6' },
              { key: 'used',  label: 'Used Media',   count: usedCount,   color: '#10B981' },
            ];
            return (
              <View style={[styles.mediaPoolTabRow, { borderBottomColor: colors.border }]}>
                {tabs.map(tab => {
                  const isActive = mediaPoolTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      activeOpacity={0.8}
                      onPress={() => setMediaPoolTab(tab.key)}
                      style={[
                        styles.mediaPoolTab,
                        isActive && { borderBottomColor: tab.color, borderBottomWidth: 2.5 },
                      ]}
                    >
                      <Text style={[
                        styles.mediaPoolTabLabel,
                        { color: isActive ? tab.color : colors.textSecondary },
                      ]}>
                        {tab.label}
                      </Text>
                      <View style={[
                        styles.mediaPoolTabBadge,
                        { backgroundColor: isActive ? tab.color : colors.surfaceVariant },
                      ]}>
                        <Text style={[
                          styles.mediaPoolTabBadgeText,
                          { color: isActive ? '#FFFFFF' : colors.textMuted },
                        ]}>
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}

          {/* Fixed Bookend Media Row - Shows Start & End media prominently if uploaded */}
          {(!!container.startMediaUri || !!container.endMediaUri) && (
            <View style={[styles.modalBookendsRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.bookendsLabel, { color: colors.textSecondary }]}>FIXED BOOKEND MEDIA</Text>
              <View style={{ flexDirection: 'row', columnGap: 16 }}>
                {!!container.startMediaUri && (
                  <View style={styles.bookendMediaItem}>
                    <Image source={{ uri: container.startMediaUri }} style={styles.bookendThumb} />
                    <View style={[styles.bookendBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.bookendBadgeText}>START</Text>
                    </View>
                  </View>
                )}
                {!!container.endMediaUri && (
                  <View style={styles.bookendMediaItem}>
                    <Image source={{ uri: container.endMediaUri }} style={styles.bookendThumb} />
                    <View style={[styles.bookendBadge, { backgroundColor: '#EF4444' }]}>
                      <Text style={styles.bookendBadgeText}>END</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Grid Content */}
          {(() => {
            const pool = container.loopMediaPool || [];
            const usedSet = new Set(container.usedMediaUris || []);
            const filteredPool =
              mediaPoolTab === 'fresh' ? pool.filter(u => !usedSet.has(u)) :
              mediaPoolTab === 'used'  ? pool.filter(u => usedSet.has(u)) :
              pool;

            if (filteredPool.length === 0) {
              return (
                <View style={styles.emptyGridState}>
                  <View style={{ marginBottom: 12 }}>
                    <Layers size={48} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.emptyGridText, { color: colors.textSecondary }]}>
                    {mediaPoolTab === 'fresh'
                      ? 'No fresh media remaining.'
                      : mediaPoolTab === 'used'
                      ? 'No used media yet.'
                      : 'No media files in this loop pool.'}
                  </Text>
                </View>
              );
            }

            return (
              <FlatList
                data={filteredPool}
                keyExtractor={(item, index) => `${item}-${index}`}
                numColumns={3}
                contentContainerStyle={styles.gridContentContainer}
                renderItem={({ item: uri }) => {
                  const isUsed = usedSet.has(uri);
                  const isVideo =
                    uri.toLowerCase().endsWith('.mp4') ||
                    uri.toLowerCase().endsWith('.mov') ||
                    uri.toLowerCase().endsWith('.mkv') ||
                    uri.toLowerCase().endsWith('.webm');
                  return (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setSelectedMediaUri(uri)}
                      style={[
                        styles.gridMediaCell,
                        {
                          borderColor: isUsed ? '#10B981' : '#8B5CF6',
                          borderWidth: 1.5,
                        },
                      ]}
                    >
                      <Image source={{ uri }} style={styles.gridMediaImage} resizeMode="cover" />
                      {isVideo && (
                        <View style={styles.videoOverlayBadge}>
                          <Play size={12} color="#FFFFFF" fill="#FFFFFF" />
                        </View>
                      )}
                      <View style={[
                        styles.usedStatusBadge,
                        { backgroundColor: isUsed ? '#10B981' : '#8B5CF6' },
                      ]}>
                        {isUsed
                          ? <CheckCircle2 size={11} color="#FFFFFF" fill="#10B981" />
                          : <Sparkles size={11} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Full-Screen Single Media Preview Modal */}
      <Modal
        visible={!!selectedMediaUri}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMediaUri(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            activeOpacity={1} 
            onPress={() => setSelectedMediaUri(null)} 
          />
          <View style={styles.previewContainer}>
            {!!selectedMediaUri && (
              <Image 
                source={{ uri: selectedMediaUri }} 
                style={styles.previewImage} 
                resizeMode="contain" 
              />
            )}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setSelectedMediaUri(null)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Container Info Summary Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.infoModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setInfoModalVisible(false)}
          />
          <View style={[styles.infoModalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.infoModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Info size={18} color={colors.primary} />
                <Text style={[styles.infoModalTitle, { color: colors.textPrimary, marginLeft: 8 }]}>{'Container Details'}</Text>
              </View>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Name'}</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{container.title}</Text>
              </View>

              {/* Type */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Type'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {container.isLoopContainer ? (
                    <>
                      <Repeat size={12} color="#8B5CF6" />
                      <Text style={[styles.infoValue, { color: '#8B5CF6', marginLeft: 4 }]}>{'Loop Container'}</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} color={colors.primary} />
                      <Text style={[styles.infoValue, { color: colors.primary, marginLeft: 4 }]}>{'Standard Container'}</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Status */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Status'}</Text>
                <View style={[styles.infoStatusPill, { backgroundColor: statusInfo.badgeColor + '20' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: statusInfo.badgeColor }}>{statusInfo.label}</Text>
                </View>
              </View>

              {/* Platforms */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Platforms'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {(container.platforms || []).map((plat) => (
                    <PlatformBadge key={plat} platform={plat} showLabel />
                  ))}
                </View>
              </View>

              {/* Schedule */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Schedule Start'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Calendar size={12} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.textPrimary, marginLeft: 4 }]}>
                    {container.startDate || 'N/A'}{' '}{container.startTime || ''}
                  </Text>
                </View>
              </View>

              {/* End date */}
              {!!container.hasEndDateLimit && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Schedule End'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={12} color="#EF4444" />
                    <Text style={[styles.infoValue, { color: colors.textPrimary, marginLeft: 4 }]}>
                      {container.endDate || 'N/A'}{' '}{container.endTime || ''}
                    </Text>
                  </View>
                </View>
              )}

              {/* Interval */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Posting Interval'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={12} color={colors.primary} />
                  <Text style={[styles.infoValue, { color: colors.textPrimary, marginLeft: 4 }]}>
                    {'Every '}{container.intervalMinutes || 60}{' minutes'}
                  </Text>
                </View>
              </View>

              {/* Total Posts */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Total Posts'}</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{String(containerPosts.length)}</Text>
              </View>

              {/* Scheduled vs Published */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Published'}</Text>
                <Text style={[styles.infoValue, { color: '#10B981' }]}>
                  {String(containerPosts.filter(p => p.status === 'published' || Date.parse(p.scheduledAt) <= Date.now()).length)}{' / '}{String(containerPosts.length)}
                </Text>
              </View>

              {/* Loop-specific details */}
              {!!container.isLoopContainer && (
                <>
                  <View style={[styles.infoSectionDivider, { borderColor: colors.border }]} />
                  <Text style={[styles.infoSectionTitle, { color: '#8B5CF6' }]}>{'Loop Container Details'}</Text>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Current Round'}</Text>
                    <Text style={[styles.infoValue, { color: '#8B5CF6', fontWeight: '900' }]}>{'#'}{String(container.currentLoopRound || 1)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Media Per Post'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ImageIcon size={12} color={colors.primary} />
                      <Text style={[styles.infoValue, { color: colors.textPrimary, marginLeft: 4 }]}>{String(container.mediaPerPost || 1)}{' image(s)'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Media Pool'}</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{String(container.loopMediaPool?.length || 0)}{' files'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Used Media'}</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{String(container.usedMediaUris?.length || 0)}{' / '}{String(container.loopMediaPool?.length || 0)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Captions Pool'}</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{String(container.loopDescriptions?.length || 0)}{' captions'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Loop Completed'}</Text>
                    <Text style={[styles.infoValue, { color: container.isLoopCompleted ? '#10B981' : colors.textMuted }]}>
                      {container.isLoopCompleted ? 'Yes - Media Done' : 'No - Still Running'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Auto Next Round'}</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                      {container.autoNextRound !== false ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>

                  {/* Start & End Media */}
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Start Media'}</Text>
                    <Text style={[styles.infoValue, { color: container.startMediaUri ? '#10B981' : colors.textMuted }]}>
                      {container.startMediaUri ? 'Set (Intro/Cover)' : 'Not set'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'End Media'}</Text>
                    <Text style={[styles.infoValue, { color: container.endMediaUri ? '#10B981' : colors.textMuted }]}>
                      {container.endMediaUri ? 'Set (Outro/CTA)' : 'Not set'}
                    </Text>
                  </View>
                </>
              )}

              {/* First Comment */}
              {!!container.enableFirstComment && (
                <>
                  <View style={[styles.infoSectionDivider, { borderColor: colors.border }]} />
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'First Comment'}</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={2}>
                      {container.firstComment || 'Enabled but empty'}
                    </Text>
                  </View>
                </>
              )}

              {/* Skip Time Ranges */}
              {(container.skipTimeRanges?.length ?? 0) > 0 && (
                <>
                  <View style={[styles.infoSectionDivider, { borderColor: colors.border }]} />
                  <Text style={[styles.infoSectionTitle, { color: colors.warning }]}>{'Skip Time Windows'}</Text>
                  {container.skipTimeRanges!.map((skip, idx) => (
                    <View key={skip.id || String(idx)} style={[styles.infoSkipRow, { backgroundColor: colors.warningContainer, borderColor: colors.warning + '40' }]}>
                      <Clock size={11} color={colors.warning} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, marginLeft: 6 }}>
                        {skip.startTime}{' - '}{skip.endTime}
                        {!!skip.label && <Text style={{ fontWeight: '400', color: colors.textSecondary }}>{' ('}{skip.label}{')'}</Text>}
                      </Text>
                      {!!skip.isRecurring && (
                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.warning, marginLeft: 6 }}>{'DAILY'}</Text>
                      )}
                    </View>
                  ))}
                </>
              )}

              {/* Created at */}
              <View style={[styles.infoSectionDivider, { borderColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{'Created'}</Text>
                <Text style={[styles.infoValue, { color: colors.textMuted, fontSize: 11 }]}>
                  {new Date(container.createdAt).toLocaleString()}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Captions Manager Modal */}
      <Modal
        visible={captionsModalVisible}
        animationType="slide"
        onRequestClose={() => setCaptionsModalVisible(false)}
      >
        <View style={[styles.fullScreenModalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.fullScreenModalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MessageSquare size={20} color="#8B5CF6" />
              <Text style={[styles.fullScreenModalTitle, { color: colors.textPrimary, marginLeft: 8 }]}>
                {'Captions Pool (' + (container.loopDescriptions?.length || 0) + ')'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
              {/* Add Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsAddingCaption(!isAddingCaption)}
                style={[styles.miniHeaderActionBtn, { backgroundColor: isAddingCaption ? colors.primaryContainer : colors.surfaceVariant }]}
              >
                <Plus size={16} color={isAddingCaption ? colors.primary : colors.textPrimary} />
              </TouchableOpacity>

              {/* Trash/Delete Mode Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setIsCaptionsMultiSelect(!isCaptionsMultiSelect);
                  setSelectedCaptionIndices([]);
                }}
                style={[
                  styles.miniHeaderActionBtn,
                  {
                    backgroundColor: isCaptionsMultiSelect ? '#EF444420' : colors.surfaceVariant,
                    borderColor: isCaptionsMultiSelect ? '#EF4444' : 'transparent',
                    borderWidth: isCaptionsMultiSelect ? 1 : 0,
                  },
                ]}
              >
                <Trash2 size={15} color={isCaptionsMultiSelect ? '#EF4444' : colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCaptionsModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Caption Form Area */}
          {isAddingCaption && (
            <View style={[styles.inlineAddCaptionContainer, { backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>
                ADD CAPTIONS (supports bulk paste - 1 per line)
              </Text>
              <TextInput
                style={[styles.inlineAddInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Enter caption text (or paste multiple lines)..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={newCaptionText}
                onChangeText={setNewCaptionText}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', columnGap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setIsAddingCaption(false);
                    setNewCaptionText('');
                  }}
                  style={[styles.smallActionBtn, { backgroundColor: colors.surface }]}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddCaptions}
                  style={[styles.smallActionBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Multi-Select Action Bar */}
          {isCaptionsMultiSelect && (
            <View style={[styles.captionMultiActionBar, { backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={toggleSelectAllCaptions}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {selectedCaptionIndices.length === (container.loopDescriptions?.length || 0) ? (
                  <CheckSquare size={20} color={colors.primary} />
                ) : (
                  <Square size={20} color={colors.textSecondary} />
                )}
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginLeft: 8 }}>
                  {'Select All (' + selectedCaptionIndices.length + ')'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDeleteCaptions}
                disabled={selectedCaptionIndices.length === 0}
                style={[
                  styles.captionDeleteBatchBtn,
                  { backgroundColor: selectedCaptionIndices.length > 0 ? '#EF4444' : colors.textMuted },
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                  {'DELETE SELECTED'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Caption List */}
          {(!container.loopDescriptions || container.loopDescriptions.length === 0) ? (
            <View style={styles.emptyGridState}>
              <MessageSquare size={48} color={colors.textMuted} />
              <Text style={[styles.emptyGridText, { color: colors.textSecondary, marginTop: 12 }]}>
                No captions in pool. Click the plus icon to add.
              </Text>
            </View>
          ) : (
            <FlatList
              data={container.loopDescriptions}
              keyExtractor={(_, index) => String(index)}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: captionText, index }) => {
                const isSelected = selectedCaptionIndices.includes(index);
                const isExpanded = expandedCaptionIndices.includes(index);
                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (isCaptionsMultiSelect) {
                        if (isSelected) {
                          setSelectedCaptionIndices(selectedCaptionIndices.filter(i => i !== index));
                        } else {
                          setSelectedCaptionIndices([...selectedCaptionIndices, index]);
                        }
                      } else {
                        if (isExpanded) {
                          setExpandedCaptionIndices(expandedCaptionIndices.filter(i => i !== index));
                        } else {
                          setExpandedCaptionIndices([...expandedCaptionIndices, index]);
                        }
                      }
                    }}
                    style={[
                      styles.captionCard,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer + '20' : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Checkbox (only in multiselect) */}
                      {isCaptionsMultiSelect && (
                        <View style={{ marginRight: 10 }}>
                          {isSelected ? (
                            <CheckSquare size={18} color={colors.primary} />
                          ) : (
                            <Square size={18} color={colors.textSecondary} />
                          )}
                        </View>
                      )}

                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, marginRight: 8 }}>
                        {'#' + (index + 1)}
                      </Text>

                      <Text
                        numberOfLines={isExpanded ? undefined : 1}
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 12,
                          color: colors.textPrimary,
                          lineHeight: 16,
                          flex: 1,
                        }}
                      >
                        {captionText}
                      </Text>

                      {/* Expand Chevron (only in normal mode) */}
                      {!isCaptionsMultiSelect && (
                        <View style={{ marginLeft: 8 }}>
                          {isExpanded ? (
                            <ChevronUp size={16} color={colors.textMuted} />
                          ) : (
                            <ChevronDown size={16} color={colors.textMuted} />
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
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
  fullScreenModalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  fullScreenModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  gridContentContainer: {
    padding: 8,
    paddingBottom: 40,
  },
  gridMediaCell: {
    width: '31.3%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  gridMediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  usedStatusBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  mediaPoolTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    height: 48,
    alignItems: 'stretch',
  },
  mediaPoolTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  mediaPoolTabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaPoolTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
  },
  mediaPoolTabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyGridState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyGridText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '92%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: -50,
    right: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 6,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoModalCard: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 36,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '60%',
  },
  infoStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  infoSectionDivider: {
    borderTopWidth: 1,
    marginVertical: 10,
  },
  infoSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  infoSkipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  modalBookendsRow: {
    padding: 16,
    borderBottomWidth: 1,
  },
  bookendsLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bookendMediaItem: {
    position: 'relative',
    width: 70,
    height: 70,
  },
  bookendThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  bookendBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bookendBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  miniHeaderActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddCaptionContainer: {
    padding: 14,
    borderBottomWidth: 1,
  },
  inlineAddInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  smallActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  captionMultiActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  captionDeleteBatchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  captionCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
});
