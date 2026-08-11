import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Container, Post } from '../../db/types';
import { useThemeStore } from '../../stores/useThemeStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { PlatformBadge } from '../common/PlatformBadge';
import { Play, Pause, Edit3, Trash2, ChevronDown, ChevronUp, Sparkles, Repeat } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ContainerCardProps {
  container: Container;
  posts: Post[];
  onTogglePause?: (id: string) => void;
  onEdit?: (container: Container) => void;
  onDelete?: (id: string) => void;
}

export const ContainerCard: React.FC<ContainerCardProps> = ({
  container,
  posts,
  onTogglePause,
  onEdit,
  onDelete,
}) => {
  const colors = useThemeStore((state) => state.colors);
  const triggerNextLoop = useCampaignStore((state) => state.triggerNextLoop);
  const router = useRouter();

  const [actionsExpanded, setActionsExpanded] = useState(false);

  const containerPosts = posts.filter((p) => p.campaignId === container.id);
  const totalCount = containerPosts.length;
  const scheduledCount = containerPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'waiting'
  ).length;
  const publishedCount = containerPosts.filter((p) => p.status === 'published').length;

  const defaultThumbnail =
    container.thumbnailUri ||
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60';

  const progressPercent = totalCount > 0 ? (publishedCount / totalCount) * 100 : 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Container Thumbnail Header with Title at Top */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/campaign/${container.id}` as any)}
        style={styles.thumbnailContainer}
      >
        <Image source={{ uri: defaultThumbnail }} style={styles.thumbnailImage} resizeMode="cover" />
        <View style={styles.thumbnailOverlay}>
          {/* Running / Paused Status Indicator */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: container.isPaused ? colors.warning : colors.success },
            ]}
          >
            {container.isPaused ? (
              <Pause size={9} color="#FFFFFF" />
            ) : (
              <Play size={9} color="#FFFFFF" />
            )}
            <Text style={styles.statusText}>
              {container.isPaused ? 'PAUSED' : 'RUNNING'}
            </Text>
          </View>

          {/* Platform Badges */}
          <View style={styles.platformsRow}>
            {(container.platforms || ['facebook', 'instagram']).map((plat) => (
              <PlatformBadge key={plat} platform={plat} showLabel={false} />
            ))}
          </View>
        </View>
      </TouchableOpacity>

      {/* Card Content Header: Title Truncated cleanly */}
      <View style={styles.body}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/campaign/${container.id}` as any)}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {container.title}
          </Text>
        </TouchableOpacity>

        {/* Smart / Loop Tag */}
        <View style={styles.smartTagRow}>
          <View
            style={[
              styles.smartTag,
              {
                backgroundColor: container.isLoopContainer
                  ? '#8B5CF620'
                  : colors.primaryContainer,
              },
            ]}
          >
            {container.isLoopContainer ? (
              <Repeat size={9} color="#8B5CF6" />
            ) : (
              <Sparkles size={9} color={colors.primary} />
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.smartTagText,
                { color: container.isLoopContainer ? '#8B5CF6' : colors.primary },
              ]}
            >
              {container.isLoopContainer
                ? `Media current round: ${container.currentLoopRound || 1}`
                : container.smartSchedulingEnabled
                ? `${container.intervalMinutes || 60}m Interval`
                : 'Custom Time'}
            </Text>
          </View>
        </View>

        {/* Media Done Banner & Next Loop Button */}
        {container.isLoopContainer && container.isLoopCompleted && (
          <View style={styles.loopCompletedBox}>
            <Text style={styles.mediaDoneText}>✓ Media done</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => triggerNextLoop(container.id)}
              style={styles.nextLoopBtn}
            >
              <Repeat size={10} color="#FFFFFF" />
              <Text style={styles.nextLoopBtnText}>Next Loop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Green Progress Bar & Post Counter at Bottom + Expander Arrow */}
        <View style={styles.progressBottomRow}>
          <View style={styles.progressLeft}>
            <View style={styles.progressTextRow}>
              <Text style={[styles.postCountText, { color: colors.textPrimary }]}>
                {scheduledCount}/{totalCount} Scheduled
              </Text>
              <Text style={[styles.uploadedText, { color: colors.success }]}>
                {publishedCount} Done
              </Text>
            </View>

            {/* Progress Bar (Yellow when Paused, Green when Running) */}
            <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: container.isPaused ? colors.warning : colors.success,
                    width: `${progressPercent}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Expander Arrow Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActionsExpanded(!actionsExpanded)}
            style={[styles.expandArrowBtn, { backgroundColor: colors.surfaceVariant }]}
          >
            {actionsExpanded ? (
              <ChevronUp size={16} color={colors.textPrimary} />
            ) : (
              <ChevronDown size={16} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Expanded Icon-Only Action Bar (Pause, Edit, Delete icons only) */}
        {actionsExpanded && (
          <View style={[styles.expandedActionsRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onTogglePause && onTogglePause(container.id)}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: container.isPaused
                    ? colors.successContainer
                    : colors.warningContainer,
                },
              ]}
            >
              {container.isPaused ? (
                <Play size={14} color={colors.success} />
              ) : (
                <Pause size={14} color={colors.warning} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onEdit && onEdit(container)}
              style={[styles.iconActionBtn, { backgroundColor: colors.surfaceVariant }]}
            >
              <Edit3 size={14} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onDelete && onDelete(container.id)}
              style={[styles.iconActionBtn, { backgroundColor: colors.dangerContainer }]}
            >
              <Trash2 size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  thumbnailContainer: {
    height: 95,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  platformsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  body: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  smartTagRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  smartTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 3,
  },
  smartTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  progressBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLeft: {
    flex: 1,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  postCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  uploadedText: {
    fontSize: 9,
    fontWeight: '800',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  expandArrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopCompletedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10B98118',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 8,
  },
  mediaDoneText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  nextLoopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  nextLoopBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
