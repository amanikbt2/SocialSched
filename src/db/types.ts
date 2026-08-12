export type PostStatus = 'draft' | 'scheduled' | 'waiting' | 'uploading' | 'published' | 'failed' | 'paused' | 'missed';
export type SocialPlatform = 'facebook' | 'instagram' | 'x' | 'tiktok';

export interface SkipTimeRange {
  id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  label?: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  icon?: string;
  thumbnailUri?: string;
  platforms: SocialPlatform[];
  smartSchedulingEnabled: boolean;
  intervalMinutes: number; // e.g. 60 for 1h
  startDate: string;
  startTime: string;
  hasEndDateLimit?: boolean;
  endDate?: string;
  endTime?: string;
  isPaused: boolean;
  createdAt: string;

  // Loop Container specific properties
  isLoopContainer?: boolean;
  autoNextRound?: boolean;
  mediaPerPost?: number;
  loopDescriptions?: string[];
  loopMediaPool?: string[];
  usedMediaUris?: string[];
  currentLoopRound?: number;
  isLoopCompleted?: boolean;
  skipTimeRanges?: SkipTimeRange[];
  enableFirstComment?: boolean;
  firstComment?: string;
}

// Alias Container to Campaign for exact domain alignment
export type Container = Campaign;

export interface Post {
  id: string;
  campaignId: string | null;
  caption: string;
  firstComment?: string;
  images: string[];
  videos: string[];
  platforms: SocialPlatform[];
  scheduledAt: string;
  status: PostStatus;
  notes: string;
  failureReason: string | null;
  uploadProgress: number;
  tags: string[];
  hashtags: string[];
  mentions: string[];
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
  size: number;
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
  startDate: string;
  startTime: string;
  intervalMinutes: number;
  allowRandomVariance: boolean;
  varianceMin: number;
  varianceMax: number;
  blackoutStart: string;
  blackoutEnd: string;
  selectedDays: number[];
  skipWeekends?: boolean;
  maxPostsPerDay?: number;
}
