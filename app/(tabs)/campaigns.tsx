import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { FAB } from '../../src/components/common/FAB';
import { AnimatedSheet } from '../../src/components/common/AnimatedSheet';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { Plus, Search, FolderPlus, Sparkles, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function CampaignsScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, addCampaign } = useCampaignStore();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);

  // New Campaign Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newColor, setNewColor] = useState('#6366F1');
  const [newDesc, setNewDesc] = useState('');

  const colorOptions = ['#6366F1', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  const filteredCampaigns = campaigns.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCampaign = async () => {
    if (!newTitle.trim()) return;
    const created = await addCampaign(newTitle.trim(), newCategory, newColor, newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowAddSheet(false);
    router.push(`/campaign/${created.id}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Campaigns" subtitle="Organize and auto-distribute post groups" />

      <View style={styles.topBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search campaigns or categories..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowAddSheet(true)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
        {filteredCampaigns.map((camp) => {
          const campaignPosts = posts.filter((p) => p.campaignId === camp.id);
          const scheduledCount = campaignPosts.filter((p) => p.status === 'scheduled' || p.status === 'waiting').length;

          return (
            <TouchableOpacity
              key={camp.id}
              activeOpacity={0.85}
              onPress={() => router.push(`/campaign/${camp.id}`)}
            >
              <Card style={[styles.campaignCard, { borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.colorBadge, { backgroundColor: camp.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.categoryTag, { color: camp.color }]}>{camp.category.toUpperCase()}</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{camp.title}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>

                {camp.description ? (
                  <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {camp.description}
                  </Text>
                ) : null}

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.statPill}>
                    <Text style={[styles.statNum, { color: colors.textPrimary }]}>{campaignPosts.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}> Total Posts</Text>
                  </View>

                  <View style={styles.statPill}>
                    <Text style={[styles.statNum, { color: colors.primary }]}>{scheduledCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}> Queued</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/magic-distribute/${camp.id}`);
                    }}
                    style={[styles.magicBtn, { backgroundColor: colors.primaryContainer }]}
                  >
                    <Sparkles size={14} color={colors.primary} />
                    <Text style={[styles.magicText, { color: colors.primary }]}>✨ Distribute</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Create Campaign Bottom Sheet Modal */}
      <AnimatedSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Create Campaign"
        subtitle="Group posts for batch scheduling and distribution"
      >
        <View style={styles.formContainer}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Campaign Title</Text>
          <TextInput
            placeholder="e.g. Funny Memes, Business Ads, Daily Quotes"
            placeholderTextColor={colors.textMuted}
            value={newTitle}
            onChangeText={setNewTitle}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <TextInput
            placeholder="e.g. Memes, Quotes, Travel, Football"
            placeholderTextColor={colors.textMuted}
            value={newCategory}
            onChangeText={setNewCategory}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Description (Optional)</Text>
          <TextInput
            placeholder="Brief overview of campaign goals..."
            placeholderTextColor={colors.textMuted}
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
            numberOfLines={2}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border, height: 60 }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Accent Color</Text>
          <View style={styles.colorRow}>
            {colorOptions.map((hex) => (
              <TouchableOpacity
                key={hex}
                activeOpacity={0.8}
                onPress={() => setNewColor(hex)}
                style={[
                  styles.colorCircle,
                  { backgroundColor: hex },
                  newColor === hex && { borderWidth: 3, borderColor: '#FFFFFF' },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreateCampaign}
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.submitBtnText}>Create Campaign</Text>
          </TouchableOpacity>
        </View>
      </AnimatedSheet>

      <FAB label="Create Post" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    height: 44,
    fontSize: 13,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollList: {
    padding: 20,
    gap: 14,
    paddingBottom: 100,
  },
  campaignCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorBadge: {
    width: 14,
    height: 40,
    borderRadius: 7,
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  desc: {
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  magicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  magicText: {
    fontSize: 11,
    fontWeight: '800',
  },
  formContainer: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  submitBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
