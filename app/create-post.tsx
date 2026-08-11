import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useCampaignStore } from '../src/stores/useCampaignStore';
import { SocialPlatform } from '../src/db/types';
import { X, ImagePlus, Calendar, Clock, Sparkles, Check, Facebook, Instagram, Video, Tag, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export default function CreatePostScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, addPost } = useCampaignStore();
  const router = useRouter();

  const [caption, setCaption] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaigns.length > 0 ? campaigns[0].id : null
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram', 'tiktok']);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['SocialSched']);

  // Date and Time selection state
  const tomorrow = new Date(Date.now() + 86400000);
  const [scheduledDate, setScheduledDate] = useState<string>(tomorrow.toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState<string>('14:30');

  const checkScheduledTimeValid = (): { valid: boolean; error?: string } => {
    const dateObj = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (isNaN(dateObj.getTime())) {
      return { valid: false, error: 'Invalid Date/Time format. Use YYYY-MM-DD and HH:MM' };
    }
    const diffMinutes = (dateObj.getTime() - Date.now()) / 60000;
    if (diffMinutes < 10) {
      return {
        valid: false,
        error: diffMinutes <= 0 ? '⏰ Time is in the past!' : '⏰ Time must be at least 10 minutes in the future.',
      };
    }
    return { valid: true };
  };

  const timeValidation = checkScheduledTimeValid();

  const togglePlatform = (p: SocialPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((item) => item !== p));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const uris = result.assets.map((a) => a.uri);
        setAttachedImages([...attachedImages, ...uris]);
      }
    } catch (e) {
      console.warn('Image picker error fallback:', e);
      // Sample mock image fallback if user cancels or permission issue
      setAttachedImages([
        ...attachedImages,
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
      ]);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSavePost = async (isDraft: boolean = false) => {
    if (!caption.trim() && attachedImages.length === 0) {
      alert('Please enter a caption or attach an image.');
      return;
    }

    const dateObj = new Date(`${scheduledDate}T${scheduledTime}:00`);

    await addPost({
      campaignId: selectedCampaignId,
      caption: caption.trim(),
      images: attachedImages,
      videos: [],
      platforms: selectedPlatforms,
      scheduledAt: dateObj.toISOString(),
      status: isDraft ? 'draft' : 'scheduled',
      notes: notes.trim(),
      failureReason: null,
      tags,
    });

    handleSafeBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleSafeBack} style={styles.closeBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Create Post</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => handleSavePost(true)}>
          <Text style={[styles.draftText, { color: colors.primary }]}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        {/* Caption Area */}
        <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            placeholder="Write your social post caption..."
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={4}
            style={[styles.captionInput, { color: colors.textPrimary }]}
          />

          <View style={styles.inputFooter}>
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{caption.length} chars</Text>
          </View>
        </View>

        {/* Platform Selection Chips */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Target Platforms</Text>
        <View style={styles.platformRow}>
          {[
            { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
            { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
            { id: 'tiktok', label: 'TikTok', icon: Video, color: '#00F2FE' },
          ].map(({ id, label, icon: Icon, color }) => {
            const isSelected = selectedPlatforms.includes(id as SocialPlatform);
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                onPress={() => togglePlatform(id as SocialPlatform)}
                style={[
                  styles.platformChip,
                  {
                    backgroundColor: isSelected ? `${color}25` : colors.surface,
                    borderColor: isSelected ? color : colors.border,
                  },
                ]}
              >
                <Icon size={16} color={isSelected ? color : colors.textSecondary} />
                <Text style={[styles.platText, { color: isSelected ? color : colors.textSecondary }]}>
                  {label}
                </Text>
                {isSelected && <Check size={14} color={color} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Campaign Dropdown Selector */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Campaign Folder</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campaignRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedCampaignId(null)}
            style={[
              styles.campChip,
              {
                backgroundColor: selectedCampaignId === null ? colors.primaryContainer : colors.surface,
                borderColor: selectedCampaignId === null ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.campChipText, { color: selectedCampaignId === null ? colors.primary : colors.textSecondary }]}>
              No Campaign
            </Text>
          </TouchableOpacity>

          {campaigns.map((c) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.8}
              onPress={() => setSelectedCampaignId(c.id)}
              style={[
                styles.campChip,
                {
                  backgroundColor: selectedCampaignId === c.id ? `${c.color}25` : colors.surface,
                  borderColor: selectedCampaignId === c.id ? c.color : colors.border,
                },
              ]}
            >
              <View style={[styles.colorDot, { backgroundColor: c.color }]} />
              <Text style={[styles.campChipText, { color: selectedCampaignId === c.id ? c.color : colors.textPrimary }]}>
                {c.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Media Attachments */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Media Attachments</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickImage}
            style={[styles.attachBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            <ImagePlus size={22} color={colors.primary} />
            <Text style={[styles.attachText, { color: colors.primary }]}>Add Image</Text>
          </TouchableOpacity>

          {attachedImages.map((uri, idx) => (
            <View key={idx} style={styles.previewContainer}>
              <Image source={{ uri }} style={styles.previewImg} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))}
                style={styles.removeMediaBtn}
              >
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Date & Time Selector */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Schedule Time</Text>
        <View style={styles.dateTimeRow}>
          <View
            style={[
              styles.dateTimeInput,
              {
                backgroundColor: !timeValidation.valid ? '#FEF2F2' : colors.surface,
                borderColor: !timeValidation.valid ? '#EF4444' : colors.border,
                borderWidth: !timeValidation.valid ? 2 : 1,
              },
            ]}
          >
            <Calendar size={18} color={!timeValidation.valid ? '#EF4444' : colors.primary} />
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={scheduledDate}
              onChangeText={setScheduledDate}
              style={[styles.dateText, { color: !timeValidation.valid ? '#EF4444' : colors.textPrimary }]}
            />
          </View>

          <View
            style={[
              styles.dateTimeInput,
              {
                backgroundColor: !timeValidation.valid ? '#FEF2F2' : colors.surface,
                borderColor: !timeValidation.valid ? '#EF4444' : colors.border,
                borderWidth: !timeValidation.valid ? 2 : 1,
              },
            ]}
          >
            <Clock size={18} color={!timeValidation.valid ? '#EF4444' : colors.primary} />
            <TextInput
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              value={scheduledTime}
              onChangeText={setScheduledTime}
              style={[styles.dateText, { color: !timeValidation.valid ? '#EF4444' : colors.textPrimary }]}
            />
          </View>
        </View>

        {!timeValidation.valid && (
          <View style={styles.errorAlertBox}>
            <AlertCircle size={14} color="#EF4444" />
            <Text style={styles.errorAlertText}>{timeValidation.error}</Text>
          </View>
        )}

        {/* Tags */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Tags</Text>
        <View style={[styles.tagInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Tag size={16} color={colors.textSecondary} />
          <TextInput
            placeholder="Add tag and tap Add..."
            placeholderTextColor={colors.textMuted}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={handleAddTag}
            style={[styles.tagInputField, { color: colors.textPrimary }]}
          />
          <TouchableOpacity activeOpacity={0.8} onPress={handleAddTag} style={styles.tagAddBtn}>
            <Text style={[styles.tagAddText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tagsContainer}>
          {tags.map((t) => (
            <View key={t} style={[styles.tagChip, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.tagText, { color: colors.textPrimary }]}>#{t}</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setTags(tags.filter((item) => item !== t))}>
                <X size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Private Notes */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Private Notes (Optional)</Text>
        <TextInput
          placeholder="Internal notes for this post..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        />

        {/* Action Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (!timeValidation.valid) {
              alert(`⚠️ Cannot Schedule Post:\n\n${timeValidation.error}`);
              return;
            }
            handleSavePost(false);
          }}
          style={[
            styles.scheduleBtn,
            { backgroundColor: timeValidation.valid ? colors.primary : '#EF4444' },
          ]}
        >
          {timeValidation.valid ? <Sparkles size={18} color="#FFFFFF" /> : <AlertCircle size={18} color="#FFFFFF" />}
          <Text style={styles.scheduleBtnText}>
            {timeValidation.valid ? 'Schedule Post' : 'Fix Time (Min 10 mins in future)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  draftText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formContent: {
    padding: 20,
    paddingBottom: 60,
    gap: 12,
  },
  inputBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  captionInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 90,
  },
  inputFooter: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
  },
  platformChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  platText: {
    fontSize: 12,
    fontWeight: '700',
  },
  campaignRow: {
    gap: 8,
  },
  campChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  campChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaRow: {
    gap: 10,
  },
  attachBox: {
    width: 90,
    height: 90,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  attachText: {
    fontSize: 11,
    fontWeight: '700',
  },
  previewContainer: {
    position: 'relative',
  },
  previewImg: {
    width: 90,
    height: 90,
    borderRadius: 16,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    flex: 1,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 0,
    backgroundColor: 'transparent',
    // @ts-ignore
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  tagInputField: {
    flex: 1,
    height: 44,
    fontSize: 13,
    marginLeft: 8,
  },
  tagAddBtn: {
    paddingHorizontal: 8,
  },
  tagAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
    marginTop: 10,
  },
  scheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
