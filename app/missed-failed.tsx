import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useCampaignStore } from '../src/stores/useCampaignStore';
import { useQueueStore } from '../src/stores/useQueueStore';
import { Card } from '../src/components/common/Card';
import { Badge } from '../src/components/common/Badge';
import { PlatformBadge } from '../src/components/common/PlatformBadge';
import { ArrowLeft, RefreshCw, Trash2, Edit3, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';

export default function MissedFailedScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { posts, updatePost, deletePost } = useCampaignStore();
  const setEngineState = useQueueStore((state) => state.setEngineState);
  const router = useRouter();

  const problemPosts = posts.filter((p) => p.status === 'failed' || p.status === 'missed');

  const handleRetryAll = async () => {
    for (const post of problemPosts) {
      await updatePost(post.id, {
        status: 'waiting',
        uploadProgress: 0,
        failureReason: null,
      });
    }
    setEngineState('processing');
    router.back();
  };

  const handleRetrySingle = async (postId: string) => {
    await updatePost(postId, {
      status: 'waiting',
      uploadProgress: 0,
      failureReason: null,
    });
    setEngineState('processing');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Missed & Failed Posts</Text>
        {problemPosts.length > 0 ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleRetryAll}>
            <Text style={[styles.retryAllText, { color: colors.primary }]}>Retry All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {problemPosts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AlertCircle size={36} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Failed or Missed Posts!</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              All scheduled items are either queued or successfully published.
            </Text>
          </Card>
        ) : (
          problemPosts.map((post) => (
            <Card key={post.id} style={styles.postCard}>
              <View style={styles.cardHeader}>
                <View style={styles.platRow}>
                  {post.platforms.map((plat) => (
                    <PlatformBadge key={plat} platform={plat} showLabel={false} />
                  ))}
                </View>
                <Badge status={post.status} />
              </View>

              <Text style={[styles.caption, { color: colors.textPrimary }]} numberOfLines={2}>
                {post.caption}
              </Text>

              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                Was scheduled for: {format(new Date(post.scheduledAt), 'MMM dd, h:mm a')}
              </Text>

              {/* Failure Cause Breakdown */}
              <View style={[styles.reasonBox, { backgroundColor: colors.dangerContainer }]}>
                <Text style={[styles.reasonTitle, { color: colors.danger }]}>Failure Reason:</Text>
                <Text style={[styles.reasonText, { color: colors.danger }]}>
                  {post.failureReason || 'Scheduled window passed while device was offline.'}
                </Text>
              </View>

              {/* Action Toolbar */}
              <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleRetrySingle(post.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.primaryContainer }]}
                >
                  <RefreshCw size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Retry Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push(`/post-detail/${post.id}`)}
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceVariant }]}
                >
                  <Edit3 size={14} color={colors.textPrimary} />
                  <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => deletePost(post.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.dangerContainer }]}
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  retryAllText: {
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 60,
  },
  postCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  platRow: {
    flexDirection: 'row',
    gap: 6,
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  reasonBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
  },
  reasonTitle: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
