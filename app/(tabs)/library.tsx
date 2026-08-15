import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Modal, Alert, Platform } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { FAB } from '../../src/components/common/FAB';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useMediaStore } from '../../src/stores/useMediaStore';
import { useMediaCollectionStore, MediaCollection } from '../../src/stores/useMediaCollectionStore';
import { ImagePlus, Search, Star, Trash2, Folder, Film, Plus, X, Layers, Sparkles, CheckCircle2, Repeat, Clock, FileText, Edit2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickLocalMedia } from '../../src/utils/mediaPicker';
import { saveMultipleMediaToHiddenFolder } from '../../src/utils/localMediaStorage';

const showAlert = (
  title: string,
  message: string,
  buttons?: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const confirmButton = buttons.find(
        (btn) => btn.style === 'destructive' || btn.text.toLowerCase() === 'delete' || btn.text.toLowerCase() === 'ok'
      );
      const hasCancel = buttons.some(
        (btn) => btn.style === 'cancel' || btn.text.toLowerCase() === 'cancel'
      );
      
      let confirmed = true;
      if (hasCancel) {
        confirmed = window.confirm(`${title}\n\n${message}`);
      } else {
        window.alert(`${title}\n\n${message}`);
      }

      if (confirmed && confirmButton && confirmButton.onPress) {
        confirmButton.onPress();
      } else if (!confirmed) {
        const cancelButton = buttons.find(
          (btn) => btn.style === 'cancel' || btn.text.toLowerCase() === 'cancel'
        );
        if (cancelButton && cancelButton.onPress) {
          cancelButton.onPress();
        }
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export default function LibraryScreen() {
  const colors = useThemeStore((state) => state.colors);

  // Existing Media Store
  const { items, folders, selectedFolder, searchQuery, setSelectedFolder, setSearchQuery, addMediaItem, toggleFavorite, deleteMediaItem, loadMedia } = useMediaStore();

  // Collections Store
  const { collections, loadCollections, createCollection, deleteCollection, updateCollection } = useMediaCollectionStore();

  const [activeSection, setActiveSection] = useState<'items' | 'collections'>('items');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Computed collection media for Library Items tab
  const mediaCollections = useMemo(() =>
    collections.filter(col => col.type === 'media'),
    [collections]
  );

  const allCollectionMedia = useMemo(() => {
    const mediaItems: { uri: string; collectionName: string; collectionId: string; isVideo: boolean }[] = [];
    for (const col of mediaCollections) {
      if (col.mediaUris && col.mediaUris.length > 0) {
        for (const uri of col.mediaUris) {
          const isVideo = /\.(mp4|mov|mkv|webm|avi)$/i.test(uri);
          mediaItems.push({ uri, collectionName: col.name, collectionId: col.id, isVideo });
        }
      }
    }
    return mediaItems;
  }, [mediaCollections]);

  const displayedCollectionMedia = useMemo(() => {
    let filtered = selectedCollectionId === 'all'
      ? allCollectionMedia
      : allCollectionMedia.filter(m => m.collectionId === selectedCollectionId);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.collectionName.toLowerCase().includes(q) || m.uri.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [selectedCollectionId, allCollectionMedia, searchQuery]);

  // View Collection Modal state
  const [viewCollectionModalVisible, setViewCollectionModalVisible] = useState(false);
  const [selectedViewCollection, setSelectedViewCollection] = useState<MediaCollection | null>(null);
  const [fullscreenPreviewUri, setFullscreenPreviewUri] = useState<string | null>(null);
  const [isEditingCol, setIsEditingCol] = useState(false);
  const [editColName, setEditColName] = useState('');
  const [editColTextRaw, setEditColTextRaw] = useState('');

  // Create Collection State
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<'media' | 'text'>('media');
  const [colTextRaw, setColTextRaw] = useState('');
  const [colMediaPool, setColMediaPool] = useState<string[]>([]);
  const [colStartMedia, setColStartMedia] = useState<string | undefined>(undefined);
  const [colEndMedia, setColEndMedia] = useState<string | undefined>(undefined);
  const [pastedUrl, setPastedUrl] = useState('');
  const [colNameError, setColNameError] = useState(false);
  const [colContentError, setColContentError] = useState(false);

  useEffect(() => {
    loadMedia();
    loadCollections();
  }, []);

  const handleBulkPickCollectionMedia = async () => {
    try {
      const picked = await pickLocalMedia();
      if (picked && picked.length > 0) {
        setColMediaPool((prev) => [...prev, ...picked]);
        setColContentError(false);
      }
    } catch (e) {
      console.warn('Bulk pick error:', e);
    }
  };

  const handleAppendPastedUrl = () => {
    if (!pastedUrl.trim()) return;
    setColMediaPool((prev) => [...prev, pastedUrl.trim()]);
    setColContentError(false);
    setPastedUrl('');
  };

  const handleRemoveMediaFromPool = (index: number) => {
    const target = colMediaPool[index];
    setColMediaPool((prev) => prev.filter((_, idx) => idx !== index));
    if (colStartMedia === target) setColStartMedia(undefined);
    if (colEndMedia === target) setColEndMedia(undefined);
  };

  const handleCreateCollectionSubmit = async () => {
    console.log('Starting handleCreateCollectionSubmit... Name:', colName, 'Type:', colType);
    let hasError = false;

    if (!colName || !colName.trim()) {
      setColNameError(true);
      hasError = true;
    } else {
      setColNameError(false);
    }

    if (colType === 'media') {
      if (colMediaPool.length === 0) {
        setColContentError(true);
        hasError = true;
      } else {
        setColContentError(false);
      }
    } else {
      if (!colTextRaw || colTextRaw.trim().length === 0) {
        setColContentError(true);
        hasError = true;
      } else {
        const lines = colTextRaw
          .split('<==>')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        if (lines.length === 0) {
          setColContentError(true);
          hasError = true;
        } else {
          setColContentError(false);
        }
      }
    }

    if (hasError) {
      console.log('Validation failed: nameError =', !colName || !colName.trim(), 'contentError =', hasError);
      return;
    }

    try {
      if (colType === 'media') {
        console.log('Creating media collection...');
        await createCollection(colName.trim(), 'media', colMediaPool, colStartMedia, colEndMedia, []);
      } else {
        const lines = colTextRaw
          .split('<==>')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        console.log('Creating text collection with lines:', lines);
        await createCollection(colName.trim(), 'text', [], undefined, undefined, lines);
      }

      console.log('Collection created successfully! Resetting form...');
      const createdName = colName.trim();
      // Reset Form
      setColName('');
      setColType('media');
      setColTextRaw('');
      setColMediaPool([]);
      setColStartMedia(undefined);
      setColEndMedia(undefined);
      setColNameError(false);
      setColContentError(false);
      setCreateModalVisible(false);
      showAlert('Success', `Collection "${createdName}" created successfully!`);
    } catch (error: any) {
      console.error('Error in handleCreateCollectionSubmit:', error);
      showAlert('Error', `Failed to create collection: ${error.message || error}`);
    }
  };

  const handleUpdateCollectionSubmit = async () => {
    try {
      if (!selectedViewCollection) return;
      if (!editColName.trim()) {
        showAlert('Validation Error', 'Please enter a collection name.');
        return;
      }

      const lines = editColTextRaw
        .split('<==>')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (lines.length === 0) {
        showAlert('Validation Error', 'Please enter at least one description in the text collection.');
        return;
      }

      const updated: MediaCollection = {
        ...selectedViewCollection,
        name: editColName.trim(),
        descriptions: lines,
      };

      await updateCollection(updated);
      setSelectedViewCollection(updated);
      setIsEditingCol(false);
      showAlert('Success', 'Collection updated successfully!');
    } catch (error: any) {
      console.error('Error updating collection:', error);
      showAlert('Error', `Failed to update collection: ${error.message || error}`);
    }
  };

  const handleAddCollectionMedia = async () => {
    if (!selectedViewCollection) return;
    try {
      const picked = await pickLocalMedia();
      if (picked && picked.length > 0) {
        const savedLocalUris = await saveMultipleMediaToHiddenFolder(picked);
        const updated: MediaCollection = {
          ...selectedViewCollection,
          mediaUris: [...(selectedViewCollection.mediaUris || []), ...savedLocalUris],
        };
        await updateCollection(updated);
        setSelectedViewCollection(updated);
        showAlert('Success', `${picked.length} item(s) added to collection.`);
      }
    } catch (e) {
      console.warn('Failed to add media to collection:', e);
      showAlert('Error', 'Failed to pick or save media items.');
    }
  };

  const handleRemoveCollectionMedia = async (uriToRemove: string) => {
    if (!selectedViewCollection) return;
    const updatedUris = (selectedViewCollection.mediaUris || []).filter(
      (uri) => uri !== uriToRemove
    );
    let updatedStart = selectedViewCollection.startMediaUri;
    let updatedEnd = selectedViewCollection.endMediaUri;
    if (selectedViewCollection.startMediaUri === uriToRemove) updatedStart = undefined;
    if (selectedViewCollection.endMediaUri === uriToRemove) updatedEnd = undefined;

    const updated: MediaCollection = {
      ...selectedViewCollection,
      mediaUris: updatedUris,
      startMediaUri: updatedStart,
      endMediaUri: updatedEnd,
    };

    await updateCollection(updated);
    setSelectedViewCollection(updated);
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
              <TouchableOpacity
                key={col.id}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedViewCollection(col);
                  setViewCollectionModalVisible(true);
                }}
                style={[styles.collectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.collectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                    {col.type === 'text' ? (
                      <FileText size={18} color={colors.primary} />
                    ) : (
                      <Layers size={18} color={colors.primary} />
                    )}
                    <Text style={[styles.collectionCardTitle, { color: colors.textPrimary }]}>{col.name}</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation && e.stopPropagation();
                      showAlert(
                        'Delete Collection',
                        `Are you sure you want to delete the collection "${col.name}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteCollection(col.id) }
                        ]
                      );
                    }}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                {col.type === 'text' ? (
                  <View>
                    <Text style={[styles.collectionStatsText, { color: colors.textSecondary }]}>
                      📝 {col.descriptions?.length || 0} description items
                    </Text>
                    <View style={{
                      marginTop: 8,
                      padding: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderStyle: 'dashed',
                      backgroundColor: colors.background,
                      gap: 4
                    }}>
                      {(col.descriptions || []).slice(0, 2).map((desc, i) => (
                        <Text
                          key={i}
                          numberOfLines={1}
                          style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' }}
                        >
                          {`#${i + 1}: ${desc}`}
                        </Text>
                      ))}
                      {(col.descriptions?.length || 0) > 2 && (
                        <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700', marginTop: 2 }}>
                          {`+ ${(col.descriptions?.length || 0) - 2} more...`}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={[styles.collectionStatsText, { color: colors.textSecondary }]}>
                      📂 {col.mediaUris?.length || 0} media items
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
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Top Search & Import Bar */}
          <View style={styles.topBar}>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                placeholder="Search media files..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
            </View>
          </View>

          {/* Collection Filter Cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionFilterRow}>
            {/* "All" Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedCollectionId('all')}
              style={[
                styles.collectionFilterCard,
                {
                  backgroundColor: selectedCollectionId === 'all' ? colors.primaryContainer : colors.surface,
                  borderColor: selectedCollectionId === 'all' ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={[styles.collectionFilterThumb, { backgroundColor: selectedCollectionId === 'all' ? `${colors.primary}18` : colors.background }]}>
                <Layers size={24} color={selectedCollectionId === 'all' ? colors.primary : colors.textMuted} />
              </View>
              <Text style={[styles.collectionFilterName, { color: selectedCollectionId === 'all' ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
                All
              </Text>
              <Text style={[styles.collectionFilterCount, { color: selectedCollectionId === 'all' ? colors.primary : colors.textMuted }]}>
                {allCollectionMedia.length} items
              </Text>
            </TouchableOpacity>

            {/* Each Media Collection */}
            {mediaCollections.map((col) => {
              const isSelected = selectedCollectionId === col.id;
              const firstUri = col.mediaUris && col.mediaUris.length > 0 ? col.mediaUris[0] : null;
              return (
                <TouchableOpacity
                  key={col.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedCollectionId(col.id)}
                  style={[
                    styles.collectionFilterCard,
                    {
                      backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {firstUri ? (
                    <Image source={{ uri: firstUri }} style={styles.collectionFilterThumb} />
                  ) : (
                    <View style={[styles.collectionFilterThumb, { backgroundColor: colors.background }]}>
                      <Folder size={22} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={[styles.collectionFilterName, { color: isSelected ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
                    {col.name}
                  </Text>
                  <Text style={[styles.collectionFilterCount, { color: isSelected ? colors.primary : colors.textMuted }]}>
                    {col.mediaUris?.length || 0} items
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Media Grid — from Collections */}
          <View style={styles.gridContainer}>
            {displayedCollectionMedia.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Folder size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No media items found</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {mediaCollections.length === 0
                    ? 'Create a media collection in the Collections tab to see media here.'
                    : 'No media in this collection matches your search.'}
                </Text>
              </Card>
            ) : (
              <View style={styles.grid}>
                {displayedCollectionMedia.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.collectionId}-${index}`}
                    activeOpacity={0.9}
                    onPress={() => setFullscreenPreviewUri(item.uri)}
                    style={[styles.mediaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="cover" />

                    {item.isVideo && (
                      <View style={styles.videoBadge}>
                        <Film size={12} color="#FFFFFF" />
                      </View>
                    )}

                    {selectedCollectionId === 'all' && (
                      <View style={styles.collectionBadge}>
                        <Text style={styles.collectionBadgeText} numberOfLines={1}>{item.collectionName}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {activeSection === 'collections' && (
        <FAB label="Create Collection" onPress={() => setCreateModalVisible(true)} />
      )}

      {/* Create Collection Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => { setCreateModalVisible(false); setColNameError(false); setColContentError(false); }}
      >
        <ScrollView style={[styles.modalScroll, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Collection</Text>
            <TouchableOpacity onPress={() => { setCreateModalVisible(false); setColNameError(false); setColContentError(false); }}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Collection Name */}
            <Text style={[styles.inputLabel, { color: colNameError ? colors.danger : colors.textSecondary }]}>
              COLLECTION NAME {colNameError && <Text style={{ color: colors.danger }}>* Required</Text>}
            </Text>
            <TextInput
              placeholder="e.g. memes, quotes, reels"
              placeholderTextColor={colors.textMuted}
              value={colName}
              onChangeText={(text) => {
                setColName(text);
                if (text.trim().length > 0) setColNameError(false);
              }}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderColor: colNameError ? colors.danger : colors.border,
                  borderWidth: colNameError ? 1.5 : 1
                }
              ]}
            />
                      {/* Collection Type Selector */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>COLLECTION TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setColType('media')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colType === 'media' ? colors.primary : colors.border,
                  backgroundColor: colType === 'media' ? colors.primaryContainer : colors.surface,
                }}
              >
                <Layers size={16} color={colType === 'media' ? colors.primary : colors.textSecondary} style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colType === 'media' ? colors.primary : colors.textSecondary }}>Media Collection</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setColType('text')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colType === 'text' ? colors.primary : colors.border,
                  backgroundColor: colType === 'text' ? colors.primaryContainer : colors.surface,
                }}
              >
                <FileText size={16} color={colType === 'text' ? colors.primary : colors.textSecondary} style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colType === 'text' ? colors.primary : colors.textSecondary }}>Text Collection</Text>
              </TouchableOpacity>
            </View>

            {colType === 'media' ? (
              <>
                {/* Media Upload Buttons */}
                <Text style={[styles.inputLabel, { color: colContentError ? colors.danger : colors.textSecondary, marginTop: 10 }]}>
                  ADD PHOTO/VIDEO ITEMS {colContentError && <Text style={{ color: colors.danger }}>* Please add at least 1 media item</Text>}
                </Text>
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
              </>
            ) : (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.inputLabel, { color: colContentError ? colors.danger : colors.textSecondary }]}>
                  DESCRIPTIONS LIST {colContentError && <Text style={{ color: colors.danger }}>* Required</Text>}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, lineHeight: 16 }}>
                  Paste a block of descriptions/captions, separating each with "&lt;==&gt;". They will be automatically split into individual list items.
                </Text>
                <TextInput
                  multiline
                  numberOfLines={10}
                  placeholder="Promo text #1...&#10;&lt;==&gt;&#10;Promo text #2...&#10;&lt;==&gt;&#10;Promo text #3..."
                  placeholderTextColor={colors.textMuted}
                  value={colTextRaw}
                  onChangeText={(text) => {
                    setColTextRaw(text);
                    if (text.trim().length > 0) setColContentError(false);
                  }}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      borderColor: colContentError ? colors.danger : colors.border,
                      borderWidth: colContentError ? 1.5 : 1,
                      height: 180,
                      textAlignVertical: 'top',
                      padding: 12,
                      fontSize: 13
                    }
                  ]}
                />
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

      {/* View Collection Details Modal (Grid view of media) */}
      <Modal
        visible={viewCollectionModalVisible && !!selectedViewCollection}
        animationType="slide"
        onRequestClose={() => {
          setViewCollectionModalVisible(false);
          setSelectedViewCollection(null);
          setIsEditingCol(false);
        }}
      >
        <View style={[styles.modalScroll, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {selectedViewCollection?.type === 'text' ? (
                <FileText size={20} color={colors.primary} />
              ) : (
                <Layers size={20} color={colors.primary} />
              )}
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginLeft: 8 }]}>
                {selectedViewCollection?.name || 'View Collection'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {selectedViewCollection?.type === 'text' && !isEditingCol && (
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingCol(true);
                    setEditColName(selectedViewCollection.name);
                    setEditColTextRaw(selectedViewCollection.descriptions?.join('\n<==>\n') || '');
                  }}
                  style={{ padding: 4 }}
                >
                  <Edit2 size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  setViewCollectionModalVisible(false);
                  setSelectedViewCollection(null);
                  setIsEditingCol(false);
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {isEditingCol ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EDIT COLLECTION NAME</Text>
              <TextInput
                placeholder="Collection name"
                placeholderTextColor={colors.textMuted}
                value={editColName}
                onChangeText={setEditColName}
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border, marginBottom: 16 }]}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EDIT DESCRIPTIONS LIST</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, lineHeight: 16 }}>
                {'Modify individual items or paste/add items separated by "<==>".'}
              </Text>
              <TextInput
                multiline
                numberOfLines={10}
                placeholder="Promo text #1...&#10;&lt;==&gt;&#10;Promo text #2..."
                placeholderTextColor={colors.textMuted}
                value={editColTextRaw}
                onChangeText={setEditColTextRaw}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    height: 250,
                    textAlignVertical: 'top',
                    padding: 12,
                    fontSize: 13
                  }
                ]}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity
                  onPress={handleUpdateCollectionSubmit}
                  style={{
                    flex: 1,
                    backgroundColor: colors.success,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Save Changes</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setIsEditingCol(false)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceVariant,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : selectedViewCollection && selectedViewCollection.type === 'text' ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
                {'COLLECTION ITEMS (' + (selectedViewCollection.descriptions?.length || 0) + ')'}
              </Text>
              {(selectedViewCollection.descriptions || []).map((desc, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <View style={{ backgroundColor: colors.primaryContainer, borderRadius: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>#{index + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 }}>{desc}</Text>
                </View>
              ))}
            </ScrollView>
          ) : selectedViewCollection ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              {/* Bookends Section */}
              {(!!selectedViewCollection?.startMediaUri || !!selectedViewCollection?.endMediaUri) && (
                <View style={[styles.modalBookendsRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.bookendsLabel, { color: colors.textSecondary }]}>FIXED BOOKEND MEDIA</Text>
                  <View style={{ flexDirection: 'row', columnGap: 16 }}>
                    {!!selectedViewCollection.startMediaUri && (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setFullscreenPreviewUri(selectedViewCollection.startMediaUri!)}
                        style={styles.bookendMediaItem}
                      >
                        <Image source={{ uri: selectedViewCollection.startMediaUri }} style={styles.bookendThumb} />
                        <View style={[styles.bookendBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.bookendBadgeText}>START</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {!!selectedViewCollection.endMediaUri && (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setFullscreenPreviewUri(selectedViewCollection.endMediaUri!)}
                        style={styles.bookendMediaItem}
                      >
                        <Image source={{ uri: selectedViewCollection.endMediaUri }} style={styles.bookendThumb} />
                        <View style={[styles.bookendBadge, { backgroundColor: '#EF4444' }]}>
                          <Text style={styles.bookendBadgeText}>END</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Grid of Collection Media */}
              <View style={{ padding: 16 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
                  {'COLLECTION ITEMS (' + (selectedViewCollection.mediaUris?.length || 0) + ')'}
                </Text>
                <View style={styles.collectionGrid}>
                  {/* Plus button inside the collection grid to add media */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleAddCollectionMedia}
                    style={[
                      styles.gridCell,
                      {
                        borderColor: colors.primary,
                        borderStyle: 'dashed',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: `${colors.primary}08`,
                      },
                    ]}
                  >
                    <Plus size={24} color={colors.primary} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 4 }}>Add Media</Text>
                  </TouchableOpacity>

                  {(selectedViewCollection.mediaUris || []).map((uri, index) => {
                    const isVideo =
                      uri.toLowerCase().endsWith('.mp4') ||
                      uri.toLowerCase().endsWith('.mov') ||
                      uri.toLowerCase().endsWith('.mkv') ||
                      uri.toLowerCase().endsWith('.webm');
                    return (
                      <View
                        key={`${uri}-${index}`}
                        style={[styles.gridCell, { borderColor: colors.border }]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setFullscreenPreviewUri(uri)}
                          style={{ width: '100%', height: '100%' }}
                        >
                          <Image source={{ uri }} style={styles.gridImage} resizeMode="cover" />
                          {isVideo && (
                            <View style={styles.videoGridBadge}>
                              <Film size={12} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Trash Button Overlay */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleRemoveCollectionMedia(uri)}
                          style={[
                            styles.removeGridMediaBtn,
                            { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
                          ]}
                        >
                          <Trash2 size={12} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* Full-Screen Media Preview Modal */}
      <Modal
        visible={!!fullscreenPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenPreviewUri(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setFullscreenPreviewUri(null)}
          />
          <View style={styles.previewContainer}>
            {!!fullscreenPreviewUri && (
              <Image
                source={{ uri: fullscreenPreviewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setFullscreenPreviewUri(null)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
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
  collectionFilterRow: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 12,
  },
  collectionFilterCard: {
    width: 94,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  collectionFilterThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionFilterName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  collectionFilterCount: {
    fontSize: 9,
    fontWeight: '600',
  },
  collectionBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  collectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  removeGridMediaBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalBookendsRow: {
    padding: 20,
    borderBottomWidth: 1,
  },
  bookendsLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bookendMediaItem: {
    position: 'relative',
    width: 70,
    height: 70,
  },
  bookendThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  bookendBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bookendBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCell: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoGridBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 3,
    borderRadius: 4,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '92%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: -50,
    right: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
