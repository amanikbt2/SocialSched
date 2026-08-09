import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { FAB } from '../../src/components/common/FAB';
import { PlatformBadge } from '../../src/components/common/PlatformBadge';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useQueueStore } from '../../src/stores/useQueueStore';
import { Calendar, Layers, AlertCircle, CheckCircle2, Clock, Sparkles, Database, Wifi, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, isToday } from 'date-fns';

export default function HomeScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts } = useCampaignStore();
  const { networkStatus, engineState } = useQueueStore();
  const router = useRouter();

  const todayPosts = posts.filter((p) => isToday(new Date(p.scheduledAt)));
  const upcomingPosts = posts
    .filter((p) => p.status === 'scheduled' || p.status === 'waiting')
    .slice(0, 3);
  const failedCount = posts.filter((p) => p.status === 'failed' || p.status === 'missed').length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const scheduledCount = posts.filter((p) => p.status === 'scheduled' || p.status === 'waiting').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header subtitle="Offline-First Personal Scheduler" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Stats Banner */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Clock size={20} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{scheduledCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Scheduled</Text>
          </Card>

          <Card style={styles.statCard}>
            <CheckCircle2 size={20} color={colors.success} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{publishedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Published</Text>
          </Card>

          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/missed-failed')} style={{ flex: 1 }}>
            <Card style={[styles.statCard, failedCount > 0 && { borderColor: colors.danger }]}>
              <AlertCircle size={20} color={failedCount > 0 ? colors.danger : colors.textMuted} />
              <Text style={[styles.statNum, { color: failedCount > 0 ? colors.danger : colors.textPrimary }]}>
                {failedCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Needs Action</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Failed Posts Callout Banner if any */}
        {failedCount > 0 && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/missed-failed')}>
            <Card style={[styles.failedBanner, { backgroundColor: colors.dangerContainer, borderColor: colors.danger }]}>
              <View style={styles.bannerRow}>
                <AlertCircle size={22} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: colors.danger }]}>
                    {failedCount} Missed / Failed Posts
                  </Text>
                  <Text style={[styles.bannerSub, { color: colors.textPrimary }]}>
                    Tap to review failure reasons and batch retry.
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* System Health / Status Card */}
        <Card style={styles.healthCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>System Health & Storage</Text>
          <View style={styles.healthGrid}>
            <View style={styles.healthItem}>
              <Wifi size={16} color={networkStatus === 'online' ? colors.success : colors.danger} />
              <Text style={[styles.healthText, { color: colors.textSecondary }]}>
                Net: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{networkStatus}</Text>
              </Text>
            </View>

            <View style={styles.healthItem}>
              <Activity size={16} color={colors.primary} />
              <Text style={[styles.healthText, { color: colors.textSecondary }]}>
                Sync: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{engineState}</Text>
              </Text>
            </View>

            <View style={styles.healthItem}>
              <Database size={16} color={colors.secondary} />
              <Text style={[styles.healthText, { color: colors.textSecondary }]}>
                Storage: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Local SQLite</Text>
              </Text>
            </View>
          </View>
        </Card>

        {/* Recent Campaigns Carousel */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Campaigns</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/campaigns')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>View All ({campaigns.length})</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
          {campaigns.map((c) => {
            const count = posts.filter((p) => p.campaignId === c.id).length;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/campaign/${c.id}`)}
              >
                <Card style={[styles.campaignCard, { borderColor: c.color }]}>
                  <View style={[styles.categoryPill, { backgroundColor: `${c.color}25` }]}>
                    <Text style={[styles.categoryText, { color: c.color }]}>{c.category}</Text>
                  </View>
                  <Text style={[styles.campTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text style={[styles.campCount, { color: colors.textSecondary }]}>{count} Posts</Text>
                  <View style={styles.distributeRow}>
                    <Sparkles size={14} color={colors.primary} />
                    <Text style={[styles.distributeText, { color: colors.primary }]}>Magic Distribute</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Today's Schedule */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Today's Schedule</Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
            {todayPosts.length} posts scheduled today
          </Text>
        </View>

        {todayPosts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No posts scheduled for today</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Use the + button or Magic Distribute to populate your queue.
            </Text>
          </Card>
        ) : (
          todayPosts.map((post) => (
            <TouchableOpacity key={post.id} activeOpacity={0.85} onPress={() => router.push(`/post-detail/${post.id}`)}>
              <Card style={styles.postCard}>
                <View style={styles.postTop}>
                  <View style={styles.platRow}>
                    {post.platforms.map((plat) => (
                      <PlatformBadge key={plat} platform={plat} showLabel={false} />
                    ))}
                  </View>
                  <Badge status={post.status} />
                </View>

                <Text style={[styles.postCaption, { color: colors.textPrimary }]} numberOfLines={2}>
                  {post.caption}
                </Text>

                <Text style={[styles.postTime, { color: colors.primary }]}>
                  {format(new Date(post.scheduledAt), 'h:mm a')}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Upcoming Queue Overview */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming Posts</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/queue')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>Full Queue</Text>
          </TouchableOpacity>
        </View>

        {upcomingPosts.map((post) => (
          <TouchableOpacity key={post.id} activeOpacity={0.85} onPress={() => router.push(`/post-detail/${post.id}`)}>
            <Card style={styles.postCard}>
              <View style={styles.postTop}>
                <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                  {format(new Date(post.scheduledAt), 'MMM dd, h:mm a')}
                </Text>
                <Badge status={post.status} />
              </View>

              <Text style={[styles.postCaption, { color: colors.textPrimary }]} numberOfLines={2}>
                {post.caption}
              </Text>
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    alignItems: 'flex-start',
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  failedBanner: {
    marginBottom: 16,
    padding: 14,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  bannerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  healthCard: {
    marginBottom: 20,
    padding: 14,
  },
  healthGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthText: {
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtitleText: {
    fontSize: 12,
  },
  carouselContainer: {
    gap: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  campaignCard: {
    width: 170,
    padding: 14,
    borderRadius: 20,
    borderWidth: 2,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
  },
  campTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  campCount: {
    fontSize: 11,
    marginBottom: 10,
  },
  distributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distributeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  postCard: {
    marginBottom: 10,
    padding: 14,
  },
  postTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  platRow: {
    flexDirection: 'row',
    gap: 6,
  },
  postCaption: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  postTime: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
});
