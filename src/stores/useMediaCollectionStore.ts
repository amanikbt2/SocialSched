import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveMultipleMediaToHiddenFolder, saveMediaToHiddenFolder } from '../utils/localMediaStorage';

export interface MediaCollection {
  id: string;
  name: string;
  type: 'media' | 'text';
  mediaUris?: string[];
  startMediaUri?: string;
  endMediaUri?: string;
  descriptions?: string[];
  createdAt: string;
}

interface MediaCollectionState {
  collections: MediaCollection[];
  isLoading: boolean;
  loadCollections: () => Promise<void>;
  createCollection: (
    name: string,
    type: 'media' | 'text',
    mediaUris?: string[],
    startMediaUri?: string,
    endMediaUri?: string,
    descriptions?: string[]
  ) => Promise<MediaCollection>;
  deleteCollection: (id: string) => Promise<void>;
  updateCollection: (updatedCollection: MediaCollection) => Promise<void>;
}

export const useMediaCollectionStore = create<MediaCollectionState>((set, get) => ({
  collections: [],
  isLoading: true,

  loadCollections: async () => {
    set({ isLoading: true });
    try {
      const raw = await AsyncStorage.getItem('smartflow_media_collections');
      const collections = raw ? JSON.parse(raw) : [];
      set({ collections, isLoading: false });
    } catch (e) {
      console.warn('Failed to load media collections:', e);
      set({ isLoading: false });
    }
  },

  createCollection: async (name, type, mediaUris = [], startMediaUri, endMediaUri, descriptions = []) => {
    let localMediaUris: string[] = [];
    let localStartUri = startMediaUri;
    let localEndUri = endMediaUri;

    // Only copy files to storage if we are saving a media collection
    if (type === 'media') {
      localMediaUris = await saveMultipleMediaToHiddenFolder(mediaUris);
      if (startMediaUri) {
        localStartUri = await saveMediaToHiddenFolder(startMediaUri);
      }
      if (endMediaUri) {
        localEndUri = await saveMediaToHiddenFolder(endMediaUri);
      }
    }

    const newCollection: MediaCollection = {
      id: `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      type,
      mediaUris: type === 'media' ? localMediaUris : undefined,
      startMediaUri: type === 'media' ? localStartUri : undefined,
      endMediaUri: type === 'media' ? localEndUri : undefined,
      descriptions: type === 'text' ? descriptions : undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [newCollection, ...get().collections];
    try {
      await AsyncStorage.setItem('smartflow_media_collections', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save media collection:', e);
    }

    set({ collections: updated });
    return newCollection;
  },

  deleteCollection: async (id) => {
    const updated = get().collections.filter((col) => col.id !== id);
    try {
      await AsyncStorage.setItem('smartflow_media_collections', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save media collections after deletion:', e);
    }
    set({ collections: updated });
  },

  updateCollection: async (updatedCollection) => {
    const updated = get().collections.map((col) => col.id === updatedCollection.id ? updatedCollection : col);
    try {
      await AsyncStorage.setItem('smartflow_media_collections', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update collection:', e);
    }
    set({ collections: updated });
  },
}));
