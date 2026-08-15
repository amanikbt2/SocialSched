import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MediaCollection {
  id: string;
  name: string;
  mediaUris: string[];
  startMediaUri?: string;
  endMediaUri?: string;
  createdAt: string;
}

interface MediaCollectionState {
  collections: MediaCollection[];
  isLoading: boolean;
  loadCollections: () => Promise<void>;
  createCollection: (
    name: string,
    mediaUris: string[],
    startMediaUri?: string,
    endMediaUri?: string
  ) => Promise<MediaCollection>;
  deleteCollection: (id: string) => Promise<void>;
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

  createCollection: async (name, mediaUris, startMediaUri, endMediaUri) => {
    const newCollection: MediaCollection = {
      id: `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      mediaUris,
      startMediaUri,
      endMediaUri,
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
}));
