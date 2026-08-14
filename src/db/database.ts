import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let dbInstance: any = null;

export async function getDatabase(): Promise<any> {
  if (dbInstance) return dbInstance;

  if (Platform.OS === 'web') {
    dbInstance = await createWebDatabase();
  } else {
    const SQLite = require('expo-sqlite');
    dbInstance = await SQLite.openDatabaseAsync('smartflow.db');
    await initNativeTables(dbInstance);
  }

  return dbInstance;
}

// --- WEB STORAGE ADAPTER ---
// Uses AsyncStorage (browser localStorage) as the persistence layer.
// Supports all campaign/post/media fields via a generic row-based approach.

async function createWebDatabase() {
  // Load all stores from AsyncStorage once on init
  const load = async (key: string) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const save = async (key: string, data: any[]) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('WebDB save error:', e);
    }
  };

  const store: Record<string, any[]> = {
    campaigns: await load('smartflow_web_campaigns'),
    posts: await load('smartflow_web_posts'),
    media: await load('smartflow_web_media'),
  };

  const tableKey = (sql: string): string | null => {
    const m = sql.match(/(?:into|from|update|delete from)\s+(\w+)/i);
    return m ? m[1].toLowerCase() : null;
  };

  return {
    execAsync: async (_sql: string) => true,

    runAsync: async (sql: string, params: any[] = []) => {
      const sqlLower = sql.trim().toLowerCase();
      const table = tableKey(sqlLower);
      if (!table || !store[table]) return { changes: 0 };

      if (sqlLower.startsWith('insert into')) {
        // Parse column names from SQL: INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
        const colMatch = sql.match(/\(([^)]+)\)\s+values/i);
        if (colMatch) {
          const cols = colMatch[1].split(',').map((c) => c.trim());
          const row: Record<string, any> = {};
          cols.forEach((col, i) => {
            row[col] = params[i] !== undefined ? params[i] : null;
          });
          // Upsert: replace existing row with same id
          const existingIdx = store[table].findIndex((r) => r.id === row.id);
          if (existingIdx >= 0) {
            store[table][existingIdx] = row;
          } else {
            store[table].push(row);
          }
        }
        await save(`smartflow_web_${table}`, store[table]);

      } else if (sqlLower.startsWith('update')) {
        // Parse SET columns and WHERE id = ?
        // e.g. UPDATE campaigns SET col1 = ?, col2 = ? WHERE id = ?;
        const setMatch = sql.match(/set\s+(.+)\s+where\s+(\w+)\s*=\s*\?/i);
        if (setMatch) {
          const setPart = setMatch[1];
          const whereCol = setMatch[2].trim();
          const setCols = setPart.split(',').map((s) => s.match(/(\w+)\s*=\s*\?/i)?.[1]?.trim()).filter(Boolean) as string[];
          const whereValue = params[params.length - 1];
          const setValues = params.slice(0, setCols.length);

          const target = store[table].find((r) => r[whereCol] === whereValue);
          if (target) {
            setCols.forEach((col, i) => {
              target[col] = setValues[i] !== undefined ? setValues[i] : null;
            });
            await save(`smartflow_web_${table}`, store[table]);
          }
        }

      } else if (sqlLower.startsWith('delete from')) {
        const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
        if (whereMatch) {
          const col = whereMatch[1];
          const val = params[0];
          store[table] = store[table].filter((r) => r[col] !== val);
          await save(`smartflow_web_${table}`, store[table]);
        }
      }

      return { changes: 1 };
    },

    getAllAsync: async <T = any>(sql: string, _params: any[] = []): Promise<T[]> => {
      const table = tableKey(sql.trim().toLowerCase());
      if (!table || !store[table]) return [];
      // Reload from storage to ensure freshness
      try {
        const raw = await AsyncStorage.getItem(`smartflow_web_${table}`);
        if (raw) store[table] = JSON.parse(raw);
      } catch {}
      return store[table] as any as T[];
    },

    getFirstAsync: async <T = any>(sql: string, _params: any[] = []): Promise<T | null> => {
      const sqlLower = sql.trim().toLowerCase();
      if (sqlLower.includes('count(*) as count')) {
        const table = tableKey(sqlLower);
        if (table && store[table]) {
          return { count: store[table].length } as any as T;
        }
      }
      return null;
    },
  };
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
      thumbnailUri TEXT,
      platforms TEXT,
      smartSchedulingEnabled INTEGER DEFAULT 0,
      intervalMinutes INTEGER DEFAULT 60,
      startDate TEXT,
      startTime TEXT,
      hasEndDateLimit INTEGER DEFAULT 0,
      endDate TEXT,
      endTime TEXT,
      isPaused INTEGER DEFAULT 0,
      isLoopContainer INTEGER DEFAULT 0,
      autoNextRound INTEGER DEFAULT 1,
      mediaPerPost INTEGER DEFAULT 1,
      loopDescriptions TEXT,
      loopMediaPool TEXT,
      usedMediaUris TEXT,
      currentLoopRound INTEGER DEFAULT 1,
      isLoopCompleted INTEGER DEFAULT 0,
      skipTimeRanges TEXT,
      enableFirstComment INTEGER DEFAULT 0,
      firstComment TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      campaignId TEXT,
      caption TEXT NOT NULL,
      firstComment TEXT,
      images TEXT NOT NULL,
      videos TEXT NOT NULL,
      platforms TEXT NOT NULL,
      scheduledAt TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      failureReason TEXT,
      uploadProgress INTEGER DEFAULT 0,
      tags TEXT NOT NULL,
      facebookPostId TEXT,
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

  // Run safe ALTER TABLE migrations for new columns (won't fail if column exists)
  const migrations = [
    `ALTER TABLE campaigns ADD COLUMN thumbnailUri TEXT`,
    `ALTER TABLE campaigns ADD COLUMN platforms TEXT`,
    `ALTER TABLE campaigns ADD COLUMN smartSchedulingEnabled INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN intervalMinutes INTEGER DEFAULT 60`,
    `ALTER TABLE campaigns ADD COLUMN startDate TEXT`,
    `ALTER TABLE campaigns ADD COLUMN startTime TEXT`,
    `ALTER TABLE campaigns ADD COLUMN hasEndDateLimit INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN endDate TEXT`,
    `ALTER TABLE campaigns ADD COLUMN endTime TEXT`,
    `ALTER TABLE campaigns ADD COLUMN isPaused INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN isLoopContainer INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN autoNextRound INTEGER DEFAULT 1`,
    `ALTER TABLE campaigns ADD COLUMN mediaPerPost INTEGER DEFAULT 1`,
    `ALTER TABLE campaigns ADD COLUMN loopDescriptions TEXT`,
    `ALTER TABLE campaigns ADD COLUMN loopMediaPool TEXT`,
    `ALTER TABLE campaigns ADD COLUMN usedMediaUris TEXT`,
    `ALTER TABLE campaigns ADD COLUMN currentLoopRound INTEGER DEFAULT 1`,
    `ALTER TABLE campaigns ADD COLUMN isLoopCompleted INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN skipTimeRanges TEXT`,
    `ALTER TABLE campaigns ADD COLUMN enableFirstComment INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN firstComment TEXT`,
    `ALTER TABLE posts ADD COLUMN firstComment TEXT`,
    `ALTER TABLE posts ADD COLUMN facebookPostId TEXT`,
  ];

  for (const migration of migrations) {
    try {
      await database.execAsync(migration);
    } catch (_) {
      // Column already exists — safe to ignore
    }
  }
}
