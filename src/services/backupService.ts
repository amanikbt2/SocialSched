import { getDatabase } from '../db/database';
import { Campaign, Post, MediaItem } from '../db/types';

export interface SmartflowBackup {
  version: string;
  exportedAt: string;
  campaigns: Campaign[];
  posts: Post[];
  media: MediaItem[];
}

export async function exportAppDataJSON(): Promise<string> {
  const db = await getDatabase();
  const rawCampaigns = (await db.getAllAsync('SELECT * FROM campaigns;')) as any[];
  const rawPosts = (await db.getAllAsync('SELECT * FROM posts;')) as any[];
  const rawMedia = (await db.getAllAsync('SELECT * FROM media;')) as any[];

  const backup: SmartflowBackup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    campaigns: rawCampaigns.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description || '',
      category: c.category || 'General',
      color: c.color || '#4F46E5',
      icon: c.icon || 'folder',
      platforms: c.platforms ? (typeof c.platforms === 'string' ? JSON.parse(c.platforms) : c.platforms) : ['facebook', 'instagram'],
      smartSchedulingEnabled: Boolean(c.smartSchedulingEnabled),
      intervalMinutes: c.intervalMinutes || 60,
      startDate: c.startDate || new Date().toISOString(),
      startTime: c.startTime || '09:00',
      hasEndDateLimit: Boolean(c.hasEndDateLimit),
      endDate: c.endDate,
      endTime: c.endTime || '23:59',
      isPaused: Boolean(c.isPaused),
      createdAt: c.createdAt || new Date().toISOString(),
      isLoopContainer: Boolean(c.isLoopContainer),
      mediaPerPost: c.mediaPerPost || 1,
      loopDescriptions: c.loopDescriptions ? (typeof c.loopDescriptions === 'string' ? JSON.parse(c.loopDescriptions) : c.loopDescriptions) : [],
      loopMediaPool: c.loopMediaPool ? (typeof c.loopMediaPool === 'string' ? JSON.parse(c.loopMediaPool) : c.loopMediaPool) : [],
      usedMediaUris: c.usedMediaUris ? (typeof c.usedMediaUris === 'string' ? JSON.parse(c.usedMediaUris) : c.usedMediaUris) : [],
      currentLoopRound: c.currentLoopRound || 1,
      isLoopCompleted: Boolean(c.isLoopCompleted),
    })),
    posts: rawPosts.map((p) => ({
      id: p.id,
      campaignId: p.campaignId,
      caption: p.caption,
      images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : p.images || [],
      videos: typeof p.videos === 'string' ? JSON.parse(p.videos || '[]') : p.videos || [],
      platforms: typeof p.platforms === 'string' ? JSON.parse(p.platforms || '[]') : p.platforms || [],
      scheduledAt: p.scheduledAt,
      status: p.status,
      notes: p.notes || '',
      failureReason: p.failureReason || null,
      uploadProgress: p.uploadProgress || 0,
      tags: typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : p.tags || [],
      hashtags: typeof p.hashtags === 'string' ? JSON.parse(p.hashtags || '[]') : p.hashtags || [],
      mentions: typeof p.mentions === 'string' ? JSON.parse(p.mentions || '[]') : p.mentions || [],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    media: rawMedia.map((m) => ({
      id: m.id,
      uri: m.uri,
      type: m.type,
      name: m.name,
      folder: m.folder,
      isFavorite: Boolean(m.isFavorite),
      size: m.size,
      createdAt: m.createdAt,
    })),
  };

  return JSON.stringify(backup, null, 2);
}

export async function importAppDataJSON(jsonString: string): Promise<boolean> {
  try {
    const backup: SmartflowBackup = JSON.parse(jsonString);
    if (!backup.campaigns || !backup.posts) {
      throw new Error('Invalid Smartflow backup schema.');
    }

    const db = await getDatabase();

    for (const c of backup.campaigns) {
      await db.runAsync(
        `INSERT OR REPLACE INTO campaigns (id, title, description, category, color, icon, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [c.id, c.title, c.description || '', c.category, c.color, c.icon || 'folder', c.createdAt]
      );
    }

    for (const p of backup.posts) {
      await db.runAsync(
        `INSERT OR REPLACE INTO posts (id, campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, createdAt, updatedAt)
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
          p.notes || '',
          p.failureReason || null,
          p.uploadProgress || 0,
          JSON.stringify(p.tags || []),
          p.createdAt,
          p.updatedAt,
        ]
      );
    }

    return true;
  } catch (error) {
    console.error('Import failed:', error);
    return false;
  }
}
