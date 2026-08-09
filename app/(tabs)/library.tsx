import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { FAB } from '../../src/components/common/FAB';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useMediaStore } from '../../src/stores/useMediaStore';
import { ImagePlus, Search, Star, Trash2, Folder, Film } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function LibraryScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { items, folders, selectedFolder, searchQuery, setSelectedFolder, setSearchQuery, addMediaItem, toggleFavorite, deleteMediaItem } = useMediaStore();

  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await addMediaItem({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `Media_${Date.now()}`,
          folder: selectedFolder === 'all' ? 'Imports' : selectedFolder,
          isFavorite: false,
          size: asset.fileSize || 1024 * 500,
        });
      }
    } catch (e) {
      console.warn('Image picker error fallback:', e);
    }
  };

  const filteredMedia = items.filter((item) => {
    const matchesFolder = selectedFolder === 'all' || item.folder === selectedFolder;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Media Library" subtitle="Stored media, albums & reusable assets" />

      {/* Top Search & Import Bar */}
      <View style={styles.topBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search media files..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePickMedia}
          style={[styles.importBtn, { backgroundColor: colors.primary }]}
        >
          <ImagePlus size={18} color="#FFFFFF" />
          <Text style={styles.importText}>Import</Text>
        </TouchableOpacity>
      </View>

      {/* Folders horizontal bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}>
        {folders.map((folder) => (
          <TouchableOpacity
            key={folder}
            activeOpacity={0.8}
            onPress={() => setSelectedFolder(folder === 'All' ? 'all' : folder)}
            style={[
              styles.folderChip,
              {
                backgroundColor:
                  (selectedFolder === 'all' && folder === 'All') || selectedFolder === folder
                    ? colors.primaryContainer
                    : colors.surface,
                borderColor:
                  (selectedFolder === 'all' && folder === 'All') || selectedFolder === folder
                    ? colors.primary
                    : colors.border,
              },
            ]}
          >
            <Folder
              size={14}
              color={
                (selectedFolder === 'all' && folder === 'All') || selectedFolder === folder
                  ? colors.primary
                  : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.folderText,
                {
                  color:
                    (selectedFolder === 'all' && folder === 'All') || selectedFolder === folder
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              {folder}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Media Grid */}
      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        {filteredMedia.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Folder size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No media items found</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Import photos or videos from your device to reuse across posts.
            </Text>
          </Card>
        ) : (
          <View style={styles.grid}>
            {filteredMedia.map((item) => (
              <View
                key={item.id}
                style={[styles.mediaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Image source={{ uri: item.uri }} style={styles.mediaImage} />

                {item.type === 'video' && (
                  <View style={styles.videoBadge}>
                    <Film size={12} color="#FFFFFF" />
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleFavorite(item.id)}
                  style={styles.favBtn}
                >
                  <Star size={14} color={item.isFavorite ? '#F59E0B' : '#FFFFFF'} fill={item.isFavorite ? '#F59E0B' : 'transparent'} />
                </TouchableOpacity>

                <View style={styles.mediaFooter}>
                  <Text style={[styles.mediaName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => deleteMediaItem(item.id)}>
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FAB label="Upload Media" onPress={handlePickMedia} />
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
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  importText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  folderRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  folderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 120,
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
    borderRadius: 6,
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 6,
    borderRadius: 12,
  },
  mediaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  mediaName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
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
