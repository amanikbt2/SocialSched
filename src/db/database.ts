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
  const countRes = await database.getFirstAsync('SELECT COUNT(*) as count FROM campaigns;');
  if (countRes && countRes.count > 0) return;

  const now = new Date();
  const initialCampaigns: Campaign[] = [
    {
      id: 'camp-1',
      title: 'Funny Memes & Trends',
      description: 'Daily viral memes, developer jokes, and trending tech culture.',
      category: 'Funny Memes',
      color: '#EC4899',
      icon: 'smile',
      platforms: ['facebook', 'instagram'],
      smartSchedulingEnabled: true,
      intervalMinutes: 60,
      startDate: now.toISOString(),
      startTime: '09:00',
      isPaused: false,
      createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
    },
    {
      id: 'camp-2',
      title: 'Daily Inspiration & Quotes',
      description: 'Morning motivation, mindsets, and productivity tips.',
      category: 'Daily Quotes',
      color: '#8B5CF6',
      icon: 'quote',
      platforms: ['facebook', 'instagram'],
      smartSchedulingEnabled: true,
      intervalMinutes: 60,
      startDate: now.toISOString(),
      startTime: '09:00',
      isPaused: false,
      createdAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
    },
    {
      id: 'camp-3',
      title: 'Q3 Product & Business Ads',
      description: 'Feature announcements, customer stories, and promotions.',
      category: 'Business Ads',
      color: '#3B82F6',
      icon: 'briefcase',
      platforms: ['facebook', 'x'],
      smartSchedulingEnabled: true,
      intervalMinutes: 120,
      startDate: now.toISOString(),
      startTime: '09:00',
      isPaused: false,
      createdAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
    {
      id: 'camp-4',
      title: 'Wanderlust Travel Vlog',
      description: 'Photos, travel reels, and city guides from around the world.',
      category: 'Travel',
      color: '#10B981',
      icon: 'compass',
      platforms: ['instagram', 'tiktok'],
      smartSchedulingEnabled: true,
      intervalMinutes: 60,
      startDate: now.toISOString(),
      startTime: '09:00',
      isPaused: false,
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
    },
    {
      id: 'camp-5',
      title: 'Match Highlights & Football',
      description: 'Premier League updates, tactics breakdown, and match clips.',
      category: 'Football',
      color: '#F59E0B',
      icon: 'activity',
      platforms: ['facebook', 'tiktok'],
      smartSchedulingEnabled: true,
      intervalMinutes: 30,
      startDate: now.toISOString(),
      startTime: '09:00',
      isPaused: false,
      createdAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
    },
  ];

  for (const c of initialCampaigns) {
    await database.runAsync(
      `INSERT INTO campaigns (id, title, description, category, color, icon, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [c.id, c.title, c.description, c.category, c.color, c.icon || 'folder', c.createdAt]
    );
  }

  const scheduledTime1 = new Date(now.getTime() + 1000 * 60 * 30).toISOString();
  const scheduledTime2 = new Date(now.getTime() + 1000 * 60 * 180).toISOString();
  const scheduledTime3 = new Date(now.getTime() + 1000 * 60 * 600).toISOString();
  const pastTimeMissed = new Date(now.getTime() - 1000 * 60 * 120).toISOString();

  const initialPosts = [
    {
      id: 'post-1',
      campaignId: 'camp-1',
      caption: 'When your code works on the first try but you have no idea why... 😅💻 #developer #programming #memes',
      images: ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80'],
      videos: [],
      platforms: ['instagram', 'tiktok'],
      scheduledAt: scheduledTime1,
      status: 'scheduled',
      notes: 'Make sure to engage with comments within the first 15 minutes of posting.',
      failureReason: null,
      uploadProgress: 0,
      tags: ['Funny', 'Tech', 'Memes'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'post-2',
      campaignId: 'camp-2',
      caption: '"Simplicity is the soul of efficiency." - Austin Freeman 🌿 Focus on what truly matters today.',
      images: ['https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80'],
      videos: [],
      platforms: ['facebook', 'instagram'],
      scheduledAt: scheduledTime2,
      status: 'scheduled',
      notes: 'Cross-post to LinkedIn manually if engagement is high.',
      failureReason: null,
      uploadProgress: 0,
      tags: ['Quotes', 'Productivity'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'post-3',
      campaignId: 'camp-3',
      caption: 'Meet SyncFlow: The smoothest offline-first social media scheduler. ⚡ Try it today for free!',
      images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80'],
      videos: [],
      platforms: ['facebook', 'instagram', 'tiktok'],
      scheduledAt: scheduledTime3,
      status: 'waiting',
      notes: 'Includes promo discount link in bio.',
      failureReason: null,
      uploadProgress: 0,
      tags: ['Business', 'ProductLaunch'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'post-4',
      campaignId: 'camp-4',
      caption: 'Sunset views over the Amalfi coast 🌅 Nothing beats this scenery!',
      images: ['https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&q=80'],
      videos: [],
      platforms: ['instagram'],
      scheduledAt: pastTimeMissed,
      status: 'missed',
      notes: 'Missed due to offline status during scheduled window.',
      failureReason: 'Scheduled time passed while phone was offline.',
      uploadProgress: 0,
      tags: ['Travel', 'Amalfi'],
      createdAt: pastTimeMissed,
      updatedAt: pastTimeMissed,
    },
  ];

  for (const p of initialPosts) {
    await database.runAsync(
      `INSERT INTO posts (id, campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        p.id,
        p.campaignId,
        p.caption,
        JSON.stringify(p.images),
        JSON.stringify(p.videos),
        JSON.stringify(p.platforms),
        p.scheduledAt,
        p.status,
        p.notes,
        p.failureReason,
        p.uploadProgress,
        JSON.stringify(p.tags),
        p.createdAt,
        p.updatedAt,
      ]
    );
  }
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
