import { Platform } from 'react-native';
import { Campaign, Post, MediaItem } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

let dbInstance: any = null;

export async function getDatabase(): Promise<any> {
  if (dbInstance) return dbInstance;

  if (Platform.OS === 'web') {
    dbInstance = createWebDatabase();
    await seedWebInitialData(dbInstance);
  } else {
    const SQLite = require('expo-sqlite');
    dbInstance = await SQLite.openDatabaseAsync('syncflow.db');
    await initNativeTables(dbInstance);
  }

  return dbInstance;
}

// --- WEB STORAGE ADAPTER (Runs seamlessly in browser without C++ native SQLite errors) ---
function createWebDatabase() {
  const memoryStore: Record<string, any[]> = {
    campaigns: [],
    posts: [],
    media: [],
  };

  return {
    execAsync: async (sql: string) => {
      return true;
    },
    runAsync: async (sql: string, params: any[] = []) => {
      const sqlLower = sql.trim().toLowerCase();

      if (sqlLower.startsWith('insert into campaigns')) {
        const [id, title, description, category, color, icon, createdAt] = params;
        const exists = memoryStore.campaigns.find((c) => c.id === id);
        if (!exists) {
          memoryStore.campaigns.push({ id, title, description, category, color, icon, createdAt });
        }
        await AsyncStorage.setItem('syncflow_web_campaigns', JSON.stringify(memoryStore.campaigns));
      } else if (sqlLower.startsWith('insert into posts')) {
        const [id, campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, createdAt, updatedAt] = params;
        const exists = memoryStore.posts.find((p) => p.id === id);
        if (!exists) {
          memoryStore.posts.push({ id, campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, createdAt, updatedAt });
        }
        await AsyncStorage.setItem('syncflow_web_posts', JSON.stringify(memoryStore.posts));
      } else if (sqlLower.startsWith('insert into media')) {
        const [id, uri, type, name, folder, isFavorite, size, createdAt] = params;
        memoryStore.media.push({ id, uri, type, name, folder, isFavorite, size, createdAt });
        await AsyncStorage.setItem('syncflow_web_media', JSON.stringify(memoryStore.media));
      } else if (sqlLower.startsWith('update campaigns')) {
        const [title, description, category, color, id] = params;
        const target = memoryStore.campaigns.find((c) => c.id === id);
        if (target) {
          Object.assign(target, { title, description, category, color });
          await AsyncStorage.setItem('syncflow_web_campaigns', JSON.stringify(memoryStore.campaigns));
        }
      } else if (sqlLower.startsWith('update posts')) {
        const [campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, updatedAt, id] = params;
        const target = memoryStore.posts.find((p) => p.id === id);
        if (target) {
          Object.assign(target, { campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, updatedAt });
          await AsyncStorage.setItem('syncflow_web_posts', JSON.stringify(memoryStore.posts));
        }
      } else if (sqlLower.startsWith('delete from campaigns')) {
        const [id] = params;
        memoryStore.campaigns = memoryStore.campaigns.filter((c) => c.id !== id);
        await AsyncStorage.setItem('syncflow_web_campaigns', JSON.stringify(memoryStore.campaigns));
      } else if (sqlLower.startsWith('delete from posts')) {
        const [id] = params;
        memoryStore.posts = memoryStore.posts.filter((p) => p.id !== id);
        await AsyncStorage.setItem('syncflow_web_posts', JSON.stringify(memoryStore.posts));
      } else if (sqlLower.startsWith('delete from media')) {
        const [id] = params;
        memoryStore.media = memoryStore.media.filter((m) => m.id !== id);
        await AsyncStorage.setItem('syncflow_web_media', JSON.stringify(memoryStore.media));
      } else if (sqlLower.startsWith('update media')) {
        const [isFavorite, id] = params;
        const target = memoryStore.media.find((m) => m.id === id);
        if (target) {
          target.isFavorite = isFavorite;
          await AsyncStorage.setItem('syncflow_web_media', JSON.stringify(memoryStore.media));
        }
      }
      return { changes: 1 };
    },
    getAllAsync: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      const sqlLower = sql.trim().toLowerCase();
      if (sqlLower.includes('from campaigns')) {
        const saved = await AsyncStorage.getItem('syncflow_web_campaigns');
        if (saved) memoryStore.campaigns = JSON.parse(saved);
        return memoryStore.campaigns as any as T[];
      }
      if (sqlLower.includes('from posts')) {
        const stored = await AsyncStorage.getItem('syncflow_web_posts');
        if (stored) memoryStore.posts = JSON.parse(stored);
        return memoryStore.posts as any as T[];
      }
      if (sqlLower.includes('from media')) {
        const saved = await AsyncStorage.getItem('syncflow_web_media');
        if (saved) memoryStore.media = JSON.parse(saved);
        return memoryStore.media as any as T[];
      }
      return [];
    },
    getFirstAsync: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
      const sqlLower = sql.trim().toLowerCase();
      if (sqlLower.includes('count(*) as count from campaigns')) {
        const saved = await AsyncStorage.getItem('syncflow_web_campaigns');
        const list = saved ? JSON.parse(saved) : memoryStore.campaigns;
        return { count: list.length } as any as T;
      }
      return null;
    },
  };
}

async function seedWebInitialData(database: any) {
  // Database initializes completely empty - only containers created by the user will be stored.
  return;
}

async function initNativeTables(database: any) {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      campaignId TEXT,
      caption TEXT NOT NULL,
      images TEXT NOT NULL,
      videos TEXT NOT NULL,
      platforms TEXT NOT NULL,
      scheduledAt TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      failureReason TEXT,
      uploadProgress INTEGER DEFAULT 0,
      tags TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (campaignId) REFERENCES campaigns (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL,
      uri TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      folder TEXT NOT NULL,
      isFavorite INTEGER DEFAULT 0,
      size INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );
  `);

  const countRes = await database.getFirstAsync('SELECT COUNT(*) as count FROM campaigns;');
  if (countRes && countRes.count === 0) {
    await seedWebInitialData(database);
  }
}
