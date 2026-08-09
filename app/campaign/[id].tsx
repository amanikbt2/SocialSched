import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { PlatformBadge } from '../../src/components/common/PlatformBadge';
import { ArrowLeft, Sparkles, Plus, Search, Trash2, Copy, GripVertical } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, duplicatePost, deletePost, deleteCampaign } = useCampaignStore();
  const router = useRouter();

  const [search, setSearch] = useState('');

  const campaign = campaigns.find((c) => c.id === id);
  const campaignPosts = posts.filter((p) => p.campaignId === id);

  if (!campaign) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textPrimary, padding: 40 }}>Campaign not found.</Text>
      </View>
    );
  }

  const filteredPosts = campaignPosts.filter((p) =>
    p.caption.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteCampaign = async () => {
    await deleteCampaign(campaign.id);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {campaign.title}
        </Text>
        <TouchableOpacity activeOpacity={0.8} onPress={handleDeleteCampaign}>
          <Trash2 size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Campaign Info Card */}
        <Card style={[styles.infoCard, { borderColor: campaign.color }]}>
          <View style={styles.infoTop}>
            <View style={[styles.categoryPill, { backgroundColor: `${campaign.color}25` }]}>
              <Text style={[styles.categoryText, { color: campaign.color }]}>{campaign.category}</Text>
            </View>
            <Text style={[styles.postCountText, { color: colors.textSecondary }]}>
              {campaignPosts.length} Posts Total
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{campaign.title}</Text>
          {campaign.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{campaign.description}</Text>
          ) : null}

          {/* Large ✨ Magic Distribute Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/magic-distribute/${campaign.id}`)}
            style={[styles.distributeBtn, { backgroundColor: colors.primary }]}
          >
            <Sparkles size={20} color="#FFFFFF" />
            <Text style={styles.distributeBtnText}>✨ Magic Distribute Schedule</Text>
          </TouchableOpacity>
        </Card>

        {/* Posts Filter & Add Bar */}
        <View style={styles.filterRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder="Search posts in campaign..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/create-post')}
            style={[styles.addBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            <Plus size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No posts in this campaign</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Create posts or use Magic Distribute to populate your queue.
            </Text>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <TouchableOpacity key={post.id} activeOpacity={0.85} onPress={() => router.push(`/post-detail/${post.id}`)}>
              <Card style={styles.postCard}>
                <View style={styles.postTop}>
                  <View style={styles.leftMeta}>
                    <GripVertical size={16} color={colors.textMuted} />
                    <View style={styles.platRow}>
                      {post.platforms.map((plat) => (
                        <PlatformBadge key={plat} platform={plat} showLabel={false} />
                      ))}
                    </View>
                  </View>
                  <Badge status={post.status} />
                </View>

                <Text style={[styles.postCaption, { color: colors.textPrimary }]} numberOfLines={2}>
                  {post.caption}
                </Text>

                <View style={[styles.postFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                    {format(new Date(post.scheduledAt), 'MMM dd, h:mm a')}
                  </Text>

                  <View style={styles.actionGroup}>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => duplicatePost(post.id)}>
                      <Copy size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => deletePost(post.id)}>
                      <Trash2 size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  infoCard: {
    padding: 18,
    borderWidth: 2,
  },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
  },
  postCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  desc: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  distributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 16,
  },
  distributeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    padding: 14,
  },
  postTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  postTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
  },
});
