import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { Badge } from '../../src/components/common/Badge';
import { PlatformBadge } from '../../src/components/common/PlatformBadge';
import { ArrowLeft, Save, Copy, Trash2, Calendar, Clock, Tag, FileText, MessageSquare } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { MentionPicker } from '../../src/components/common/MentionPicker';
import { useSocialAccountsStore } from '../../src/stores/useSocialAccountsStore';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeStore((state) => state.colors);
  const { posts, campaigns, updatePost, duplicatePost, deletePost } = useCampaignStore();
  const activePage = useSocialAccountsStore((state) => state.activePage);
  const router = useRouter();

  const post = posts.find((p) => p.id === id);

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textPrimary, padding: 40 }}>Post not found.</Text>
      </View>
    );
  }

  const campaign = campaigns.find((c) => c.id === post.campaignId);

  const [caption, setCaption] = useState(post.caption);
  const [firstComment, setFirstComment] = useState(post.firstComment || '');
  const [notes, setNotes] = useState(post.notes);
  const [scheduledAt, setScheduledAt] = useState(post.scheduledAt);

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSave = async () => {
    await updatePost(post.id, {
      caption,
      firstComment,
      notes,
      scheduledAt,
    });
    handleSafeBack();
  };

  const handleDuplicate = async () => {
    await duplicatePost(post.id);
    handleSafeBack();
  };

  const handleDelete = async () => {
    await deletePost(post.id);
    handleSafeBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleSafeBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Post Inspector</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={handleSave}>
          <Save size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status and Meta Header */}
        <View style={styles.metaRow}>
          <View style={styles.platGroup}>
            {post.platforms.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </View>
          <Badge status={post.status} />
        </View>

        {/* Campaign Indicator */}
        {campaign ? (
          <View style={[styles.campBanner, { backgroundColor: `${campaign.color}15`, borderColor: campaign.color }]}>
            <View style={[styles.dot, { backgroundColor: campaign.color }]} />
            <Text style={[styles.campName, { color: campaign.color }]}>Campaign: {campaign.title}</Text>
          </View>
        ) : null}

        {/* Attached Media */}
        {post.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
            {post.images.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={styles.mediaThumb} />
            ))}
          </ScrollView>
        )}

        {/* Caption */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Caption</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          numberOfLines={5}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />
        <MentionPicker
          text={caption}
          onSelectMention={setCaption}
          accessToken={activePage?.accessToken}
          colors={colors}
        />

        {/* First Comment */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>First Comment</Text>
        <TextInput
          placeholder="No first comment..."
          placeholderTextColor={colors.textMuted}
          value={firstComment}
          onChangeText={setFirstComment}
          multiline
          numberOfLines={3}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />
        <MentionPicker
          text={firstComment}
          onSelectMention={setFirstComment}
          accessToken={activePage?.accessToken}
          colors={colors}
        />

        {/* Scheduled Time */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Scheduled Time</Text>
        <View style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Calendar size={18} color={colors.primary} />
          <Text style={[styles.timeText, { color: colors.textPrimary }]}>
            {format(new Date(scheduledAt), 'EEEE, MMMM dd, yyyy @ h:mm a')}
          </Text>
        </View>

        {/* Tags */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Tags</Text>
        <View style={styles.tagGroup}>
          {post.tags.map((t) => (
            <View key={t} style={[styles.tagPill, { backgroundColor: colors.surfaceVariant }]}>
              <Tag size={12} color={colors.textSecondary} />
              <Text style={[styles.tagText, { color: colors.textPrimary }]}>#{t}</Text>
            </View>
          ))}
        </View>

        {/* Private Notes */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Private Notes</Text>
        <TextInput
          placeholder="No private notes..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />

        {/* Action Controls */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleDuplicate}
            style={[styles.actionBtn, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
          >
            <Copy size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Duplicate Post</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleDelete}
            style={[styles.actionBtn, { backgroundColor: colors.dangerContainer, borderColor: colors.danger }]}
          >
            <Trash2 size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 60,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  platGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  campBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  campName: {
    fontSize: 12,
    fontWeight: '800',
  },
  mediaRow: {
    gap: 10,
  },
  mediaThumb: {
    width: 140,
    height: 140,
    borderRadius: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
