import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Modal, Alert } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { FAB } from '../../src/components/common/FAB';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useMediaStore } from '../../src/stores/useMediaStore';
import { useMediaCollectionStore, MediaCollection } from '../../src/stores/useMediaCollectionStore';
import { ImagePlus, Search, Star, Trash2, Folder, Film, Plus, X, Layers, Sparkles, CheckCircle2, Repeat, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickLocalMedia } from '../../src/utils/mediaPicker';

export default function LibraryScreen() {
  const colors = useThemeStore((state) => state.colors);

  // Existing Media Store
  const { items, folders, selectedFolder, searchQuery, setSelectedFolder, setSearchQuery, addMediaItem, toggleFavorite, deleteMediaItem, loadMedia } = useMediaStore();

  // Collections Store
  const { collections, loadCollections, createCollection, deleteCollection } = useMediaCollectionStore();

  const [activeSection, setActiveSection] = useState<'items' | 'collections'>('items');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Create Collection State
  const [colName, setColName] = useState('');
  const [colMediaPool, setColMediaPool] = useState<string[]>([]);
  const [colStartMedia, setColStartMedia] = useState<string | undefined>(undefined);
  const [colEndMedia, setColEndMedia] = useState<string | undefined>(undefined);
  const [pastedUrl, setPastedUrl] = useState('');

  useEffect(() => {
    loadMedia();
    loadCollections();
  }, []);

  const handleBulkPickCollectionMedia = async () => {
    try {
      const picked = await pickLocalMedia();
      if (picked && picked.length > 0) {
        setColMediaPool((prev) => [...prev, ...picked]);
      }
    } catch (e) {
      console.warn('Bulk pick error:', e);
    }
  };

  const handleAppendPastedUrl = () => {
    if (!pastedUrl.trim()) return;
    setColMediaPool((prev) => [...prev, pastedUrl.trim()]);
    setPastedUrl('');
  };

  const handleRemoveMediaFromPool = (index: number) => {
    const target = colMediaPool[index];
    setColMediaPool((prev) => prev.filter((_, idx) => idx !== index));
    if (colStartMedia === target) setColStartMedia(undefined);
    if (colEndMedia === target) setColEndMedia(undefined);
  };

  const handleCreateCollectionSubmit = async () => {
    if (!colName.trim()) {
      Alert.alert('Validation Error', 'Please enter a collection name.');
      return;
    }
    if (colMediaPool.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one media item to the collection.');
      return;
    }
    await createCollection(colName.trim(), colMediaPool, colStartMedia, colEndMedia);

    // Reset Form
    setColName('');
    setColMediaPool([]);
    setColStartMedia(undefined);
    setColEndMedia(undefined);
    setCreateModalVisible(false);
    Alert.alert('Success', `Collection "${colName}" created successfully!`);
  };

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
      <Header title="Media Manager" subtitle="Manage individual assets or grouped collections" />

      {/* Sub-tab Bar */}
      <View style={[styles.subTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveSection('items')}
          style={[styles.subTab, activeSection === 'items' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.subTabLabel, { color: activeSection === 'items' ? colors.primary : colors.textSecondary }]}>
            Library Items
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveSection('collections')}
          style={[styles.subTab, activeSection === 'collections' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.subTabLabel, { color: activeSection === 'collections' ? colors.primary : colors.textSecondary }]}>
            Collections
          </Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'collections' ? (
        <ScrollView contentContainerStyle={styles.collectionsScroll} showsVerticalScrollIndicator={false}>
          {collections.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Layers size={32} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No collections yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Group photos and videos together under a named collection to quickly reuse them in Loop Containers.
              </Text>
            </Card>
          ) : (
            collections.map((col) => (
              <View
                key={col.id}
                style={[styles.collectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.collectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Layers size={18} color={colors.primary} />
                    <Text style={[styles.collectionCardTitle, { color: colors.textPrimary }]}>{col.name}</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      Alert.alert(
                        'Delete Collection',
                        `Are you sure you want to delete the collection "${col.name}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteCollection(col.id) }
                        ]
                      );
                    }}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.collectionStatsText, { color: colors.textSecondary }]}>
                  📂 {col.mediaUris.length} media items
                </Text>

                {/* Previews */}
                {(col.startMediaUri || col.endMediaUri) && (
                  <View style={styles.previewsRow}>
                    {col.startMediaUri && (
                      <View style={styles.previewCell}>
                        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Start Cover</Text>
                        <Image source={{ uri: col.startMediaUri }} style={styles.previewThumb} />
                      </View>
                    )}
                    {col.endMediaUri && (
                      <View style={styles.previewCell}>
                        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>End Outro</Text>
                        <Image source={{ uri: col.endMediaUri }} style={styles.previewThumb} />
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
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
          <View style={styles.gridContainer}>
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
          </View>
        </ScrollView>
      )}

      {activeSection === 'collections' ? (
        <FAB label="Create Collection" onPress={() => setCreateModalVisible(true)} />
      ) : (
        <FAB label="Upload Media" onPress={handlePickMedia} />
      )}

      {/* Create Collection Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <ScrollView style={[styles.modalScroll, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Collection</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Collection Name */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>COLLECTION NAME</Text>
            <TextInput
              placeholder="e.g. memes, quotes, reels"
              placeholderTextColor={colors.textMuted}
              value={colName}
              onChangeText={setColName}
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            />

            {/* Media Upload Buttons */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 20 }]}>ADD PHOTO/VIDEO ITEMS</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleBulkPickCollectionMedia}
                style={[styles.pickBtn, { backgroundColor: colors.primary }]}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Bulk Pick Files</Text>
              </TouchableOpacity>
            </View>

            {/* URL input */}
            <View style={[styles.urlRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                placeholder="Or paste photo/video URL..."
                placeholderTextColor={colors.textMuted}
                value={pastedUrl}
                onChangeText={setPastedUrl}
                style={{ flex: 1, color: colors.textPrimary, paddingVertical: 8, paddingHorizontal: 12 }}
              />
              <TouchableOpacity
                onPress={handleAppendPastedUrl}
                style={[styles.addUrlBtn, { backgroundColor: colors.primaryContainer }]}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>+ Add URL</Text>
              </TouchableOpacity>
            </View>

            {/* Current Media Pool Grid */}
            {colMediaPool.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  ADDED ITEMS ({colMediaPool.length})
                </Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
                  {colMediaPool.map((uri, idx) => {
                    const isStart = colStartMedia === uri;
                    const isEnd = colEndMedia === uri;
                    return (
                      <View key={idx} style={[styles.horizontalThumbContainer, { borderColor: isStart ? colors.primary : isEnd ? colors.success : colors.border }]}>
                        <Image source={{ uri }} style={styles.horizontalThumb} />
                        <TouchableOpacity
                          onPress={() => handleRemoveMediaFromPool(idx)}
                          style={styles.removeBadge}
                        >
                          <X size={10} color="#FFFFFF" />
                        </TouchableOpacity>
                        
                        {/* Selector Badges */}
                        <View style={styles.badgeRow}>
                          <TouchableOpacity
                            onPress={() => setColStartMedia(isStart ? undefined : uri)}
                            style={[styles.badgeBtn, { backgroundColor: isStart ? colors.primary : 'rgba(0,0,0,0.6)' }]}
                          >
                            <Text style={styles.badgeBtnText}>Start</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setColEndMedia(isEnd ? undefined : uri)}
                            style={[styles.badgeBtn, { backgroundColor: isEnd ? colors.success : 'rgba(0,0,0,0.6)' }]}
                          >
                            <Text style={styles.badgeBtnText}>End</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleCreateCollectionSubmit}
              style={[styles.submitColBtn, { backgroundColor: colors.success, marginTop: 30 }]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Create Collection</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subTabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  collectionsScroll: {
    padding: 20,
    paddingBottom: 100,
  },
  collectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  collectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  collectionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  collectionStatsText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  previewsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  previewCell: {
    alignItems: 'flex-start',
    gap: 4,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 13,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addUrlBtn: {
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
  },
  horizontalThumbContainer: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  horizontalThumb: {
    width: '100%',
    height: '100%',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239,68,68,0.9)',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeBtnText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  submitColBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
