export type PostStatus = 'draft' | 'scheduled' | 'waiting' | 'uploading' | 'published' | 'failed' | 'paused' | 'missed';
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  icon?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  campaignId: string | null;
  caption: string;
  images: string[];
  videos: string[];
  platforms: SocialPlatform[];
  scheduledAt: string;
  status: PostStatus;
  notes: string;
  failureReason: string | null;
  uploadProgress: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'gif';
  name: string;
  folder: string;
  isFavorite: boolean;
  size: number; // in bytes
  createdAt: string;
}

export interface QueueItem {
  id: string;
  postId: string;
  status: PostStatus;
  progress: number;
  errorLog?: string;
  queuedAt: string;
  updatedAt: string;
}

export interface MagicDistributeConfig {
  campaignId: string;
  startDate: string; // ISO string
  startTime: string; // "09:00"
  intervalMinutes: number; // e.g. 15, 30, 45, 60, 120, 1440
  allowRandomVariance: boolean; // e.g. 45-70 mins
  varianceMin: number;
  varianceMax: number;
  blackoutStart: string; // e.g. "00:00"
  blackoutEnd: string;   // e.g. "06:00"
  selectedDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  skipWeekends: boolean;
  maxPostsPerDay: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  simulatedNetwork: 'online' | 'offline' | 'flaky';
  autoRetryFailed: boolean;
  maxRetries: number;
  notificationsEnabled: boolean;
  backgroundSyncInterval: number; // in minutes
}
