import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Post } from '../../db/types';
import { useThemeStore } from '../../stores/useThemeStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { Badge } from '../common/Badge';
import { PlatformBadge } from '../common/PlatformBadge';
import { Play, Pause, RefreshCw, Trash2, Clock } from 'lucide-react-native';
import { format } from 'date-fns';

interface QueueProgressCardProps {
  post: Post;
  isActive?: boolean;
}

export const QueueProgressCard: React.FC<QueueProgressCardProps> = ({ post, isActive }) => {
  const colors = useThemeStore((state) => state.colors);
  const { updatePost, deletePost } = useCampaignStore();

  const handlePauseResume = () => {
    if (post.status === 'paused') {
      updatePost(post.id, { status: 'waiting', failureReason: null });
    } else {
      updatePost(post.id, { status: 'paused', failureReason: 'User manually paused queue.' });
    }
  };

  const handleRetry = () => {
    updatePost(post.id, { status: 'uploading', uploadProgress: 0, failureReason: null });
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? colors.primary : colors.border,
          shadowColor: colors.cardShadow,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.platformList}>
          {post.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} showLabel={false} />
          ))}
        </View>

        <Badge status={post.status} />
      </View>

      <View style={styles.contentRow}>
        {post.images.length > 0 ? (
          <Image source={{ uri: post.images[0] }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.placeholderThumb, { backgroundColor: colors.surfaceVariant }]}>
            <Clock size={20} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.textDetails}>
          <Text style={[styles.caption, { color: colors.textPrimary }]} numberOfLines={2}>
            {post.caption}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {format(new Date(post.scheduledAt), 'MMM dd, h:mm a')}
          </Text>
        </View>
      </View>

      {/* Upload Progress Bar */}
      {(post.status === 'uploading' || post.uploadProgress > 0) && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Uploading...</Text>
            <Text style={[styles.progressVal, { color: colors.primary }]}>{post.uploadProgress}%</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.primary,
                  width: `${post.uploadProgress}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Failure Reason Callout */}
      {post.failureReason && (
        <View style={[styles.errorBox, { backgroundColor: colors.dangerContainer }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{post.failureReason}</Text>
        </View>
      )}

      {/* Action Toolbar */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        {post.status === 'failed' || post.status === 'missed' ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleRetry} style={styles.actionBtn}>
            <RefreshCw size={14} color={colors.primary} />
            <Text style={[styles.btnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={handlePauseResume} style={styles.actionBtn}>
            {post.status === 'paused' ? (
              <>
                <Play size={14} color={colors.success} />
                <Text style={[styles.btnText, { color: colors.success }]}>Resume</Text>
              </>
            ) : (
              <>
                <Pause size={14} color={colors.warning} />
                <Text style={[styles.btnText, { color: colors.warning }]}>Pause</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity activeOpacity={0.8} onPress={() => deletePost(post.id)} style={styles.actionBtn}>
          <Trash2 size={14} color={colors.danger} />
          <Text style={[styles.btnText, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  platformList: {
    flexDirection: 'row',
    gap: 6,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  placeholderThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDetails: {
    flex: 1,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  timeText: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
  progressSection: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '700',
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
  errorBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
