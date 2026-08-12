import { create } from 'zustand';
import { MediaItem } from '../db/types';
import { getDatabase } from '../db/database';

interface MediaState {
  items: MediaItem[];
  folders: string[];
  selectedFolder: string | 'all';
  searchQuery: string;
  isLoading: boolean;

  loadMedia: () => Promise<void>;
  addMediaItem: (item: Omit<MediaItem, 'id' | 'createdAt'>) => Promise<MediaItem>;
  toggleFavorite: (id: string) => Promise<void>;
  deleteMediaItem: (id: string) => Promise<void>;
  setSelectedFolder: (folder: string | 'all') => void;
  setSearchQuery: (query: string) => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],
  folders: ['All', 'Memes', 'Quotes', 'Business', 'Travel', 'Football'],
  selectedFolder: 'all',
  searchQuery: '',
  isLoading: true,

  loadMedia: async () => {
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const raw = (await db.getAllAsync('SELECT * FROM media ORDER BY createdAt DESC;')) as any[];
      const items: MediaItem[] = raw.map((m) => ({
        id: m.id,
        uri: m.uri,
        type: m.type,
        name: m.name,
        folder: m.folder,
        isFavorite: Boolean(m.isFavorite),
        size: m.size,
        createdAt: m.createdAt,
      }));

      // Extract unique folders
      const uniqueFolders = Array.from(new Set(['All', ...items.map((i) => i.folder)]));

      set({ items, folders: uniqueFolders, isLoading: false });
    } catch (e) {
      console.error('Failed to load media:', e);
      set({ isLoading: false });
    }
  },

  addMediaItem: async (itemData) => {
    const db = await getDatabase();
    const newItem: MediaItem = {
      ...itemData,
      id: `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO media (id, uri, type, name, folder, isFavorite, size, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [newItem.id, newItem.uri, newItem.type, newItem.name, newItem.folder, newItem.isFavorite ? 1 : 0, newItem.size, newItem.createdAt]
    );

    set((state) => ({
      items: [newItem, ...state.items],
      folders: Array.from(new Set([...state.folders, newItem.folder])),
    }));

    return newItem;
  },

  toggleFavorite: async (id) => {
    const db = await getDatabase();
    const current = get().items.find((i) => i.id === id);
    if (!current) return;

    const newFav = !current.isFavorite;
    await db.runAsync(`UPDATE media SET isFavorite = ? WHERE id = ?;`, [newFav ? 1 : 0, id]);

    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, isFavorite: newFav } : i)),
    }));
  },

  deleteMediaItem: async (id) => {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM media WHERE id = ?;`, [id]);
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
