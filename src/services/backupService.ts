import { getDatabase } from '../db/database';
import { Campaign, Post, MediaItem } from '../db/types';

export interface SyncFlowBackup {
  version: string;
  exportedAt: string;
  campaigns: Campaign[];
  posts: Post[];
  media: MediaItem[];
}

export async function exportAppDataJSON(): Promise<string> {
  const db = await getDatabase();
  const rawCampaigns = await db.getAllAsync<any>('SELECT * FROM campaigns;');
  const rawPosts = await db.getAllAsync<any>('SELECT * FROM posts;');
  const rawMedia = await db.getAllAsync<any>('SELECT * FROM media;');

  const backup: SyncFlowBackup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    campaigns: rawCampaigns.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      color: c.color,
      icon: c.icon,
      createdAt: c.createdAt,
    })),
    posts: rawPosts.map((p) => ({
      id: p.id,
      campaignId: p.campaignId,
      caption: p.caption,
      images: JSON.parse(p.images || '[]'),
      videos: JSON.parse(p.videos || '[]'),
      platforms: JSON.parse(p.platforms || '[]'),
      scheduledAt: p.scheduledAt,
      status: p.status,
      notes: p.notes,
      failureReason: p.failureReason,
      uploadProgress: p.uploadProgress,
      tags: JSON.parse(p.tags || '[]'),
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
    const backup: SyncFlowBackup = JSON.parse(jsonString);
    if (!backup.campaigns || !backup.posts) {
      throw new Error('Invalid SyncFlow backup schema.');
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
