import { create } from 'zustand';
import { Campaign, Post, PostStatus, SocialPlatform } from '../db/types';
import { getDatabase } from '../db/database';
import { generateLoopPosts } from '../services/loopContainerEngine';
import { saveMultipleMediaToHiddenFolder } from '../utils/localMediaStorage';

interface CampaignState {
  campaigns: Campaign[];
  posts: Post[];
  isLoading: boolean;
  searchQuery: string;
  selectedTag: string | null;
  selectedStatus: PostStatus | 'all';
  
  // Actions
  loadData: () => Promise<void>;
  addCampaign: (campaignOrTitle: Campaign | string, category?: string, color?: string, description?: string) => Promise<Campaign>;
  updateCampaign: (id: string | Campaign, updates?: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  toggleCampaignPause: (id: string) => Promise<void>;
  
  addPost: (post: any) => Promise<Post>;
  addPostsBatch: (posts: Post[]) => Promise<void>;
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  duplicatePost: (id: string) => Promise<Post | null>;
  movePost: (postId: string, targetCampaignId: string | null) => Promise<void>;
  reorderPosts: (reorderedPosts: Post[]) => void;
  
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedStatus: (status: PostStatus | 'all') => void;
  
  checkMissedPosts: () => Promise<void>;
  triggerNextLoop: (containerId: string, options?: { endType: 'media' | 'date'; endDate?: string; endTime?: string }) => Promise<void>;
  addMediaToLoopPool: (containerId: string, newUris: string[]) => Promise<void>;
  clearScheduledPostsForCampaign: (campaignId: string) => Promise<void>;
  smartDeleteLoopPosts: (containerId: string, postIds: string[]) => Promise<{ deleted: number; reclaimed: number }>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  posts: [],
  isLoading: true,
  searchQuery: '',
  selectedTag: null,
  selectedStatus: 'all',

  loadData: async () => {
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const rawCampaigns = (await db.getAllAsync('SELECT * FROM campaigns ORDER BY createdAt DESC;')) as any[];
      const rawPosts = (await db.getAllAsync('SELECT * FROM posts ORDER BY datetime(scheduledAt) ASC;')) as any[];

      const campaigns: Campaign[] = rawCampaigns.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description || '',
        category: c.category || 'General',
        color: c.color || '#4F46E5',
        icon: c.icon || 'folder',
        thumbnailUri: c.thumbnailUri,
        platforms: c.platforms ? (typeof c.platforms === 'string' ? JSON.parse(c.platforms) : c.platforms) : ['facebook', 'instagram'],
        smartSchedulingEnabled: c.smartSchedulingEnabled !== undefined ? Boolean(c.smartSchedulingEnabled) : true,
        intervalMinutes: c.intervalMinutes || 60,
        startDate: c.startDate || new Date().toISOString(),
        startTime: c.startTime || '09:00',
        hasEndDateLimit: Boolean(c.hasEndDateLimit),
        endDate: c.endDate,
        endTime: c.endTime || '23:59',
        isPaused: Boolean(c.isPaused),
        createdAt: c.createdAt || new Date().toISOString(),
        isLoopContainer: Boolean(c.isLoopContainer),
        autoNextRound: c.autoNextRound !== undefined ? Boolean(c.autoNextRound) : true,
        mediaPerPost: c.mediaPerPost || 1,
        loopDescriptions: c.loopDescriptions ? (typeof c.loopDescriptions === 'string' ? JSON.parse(c.loopDescriptions) : c.loopDescriptions) : [],
        loopMediaPool: c.loopMediaPool ? (typeof c.loopMediaPool === 'string' ? JSON.parse(c.loopMediaPool) : c.loopMediaPool) : [],
        usedMediaUris: c.usedMediaUris ? (typeof c.usedMediaUris === 'string' ? JSON.parse(c.usedMediaUris) : c.usedMediaUris) : [],
        currentLoopRound: c.currentLoopRound || 1,
        isLoopCompleted: Boolean(c.isLoopCompleted),
        skipTimeRanges: c.skipTimeRanges ? (typeof c.skipTimeRanges === 'string' ? JSON.parse(c.skipTimeRanges) : c.skipTimeRanges) : [],
        enableFirstComment: Boolean(c.enableFirstComment),
        firstComment: c.firstComment || '',
        startMediaUri: c.startMediaUri || null,
        startMediaOriginalUri: c.startMediaOriginalUri || null,
        endMediaUri: c.endMediaUri || null,
        endMediaOriginalUri: c.endMediaOriginalUri || null,
      }));

      const posts: Post[] = rawPosts.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        caption: p.caption,
        firstComment: p.firstComment || '',
        images: JSON.parse(p.images || '[]'),
        videos: JSON.parse(p.videos || '[]'),
        platforms: JSON.parse(p.platforms || '[]') as SocialPlatform[],
        scheduledAt: p.scheduledAt,
        status: p.status as PostStatus,
        notes: p.notes || '',
        failureReason: p.failureReason || null,
        uploadProgress: p.uploadProgress || 0,
        tags: JSON.parse(p.tags || '[]'),
        hashtags: JSON.parse(p.hashtags || '[]'),
        mentions: JSON.parse(p.mentions || '[]'),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        facebookPostId: p.facebookPostId || null,
      }));

      // Exclude legacy mock seed campaigns so ONLY user-created containers exist
      const userCampaigns = campaigns.filter((c) => !['camp-1', 'camp-2', 'camp-3', 'camp-4', 'camp-5'].includes(c.id));
      const userPosts = posts.filter((p) => !['camp-1', 'camp-2', 'camp-3', 'camp-4', 'camp-5'].includes(p.campaignId || ''));

      // Clean up legacy seed records from DB asynchronously
      for (const defaultId of ['camp-1', 'camp-2', 'camp-3', 'camp-4', 'camp-5']) {
        try {
          await db.runAsync('DELETE FROM campaigns WHERE id = ?;', [defaultId]);
          await db.runAsync('DELETE FROM posts WHERE campaignId = ?;', [defaultId]);
        } catch (e) {}
      }

      set({ campaigns: userCampaigns, posts: userPosts, isLoading: false });
      await get().checkMissedPosts();
    } catch (error) {
      console.warn('Loading campaign data fallback:', error);
      set({ isLoading: false });
    }
  },

  addCampaign: async (campaignOrTitle, category = 'General', color = '#4F46E5', description = '') => {
    let newCampaign: Campaign;
    if (typeof campaignOrTitle === 'object') {
      newCampaign = campaignOrTitle;
    } else {
      newCampaign = {
        id: `camp-${Date.now()}`,
        title: campaignOrTitle,
        description,
        category,
        color,
        icon: 'folder',
        platforms: ['facebook', 'instagram'],
        smartSchedulingEnabled: true,
        intervalMinutes: 60,
        startDate: new Date().toISOString(),
        startTime: '09:00',
        isPaused: false,
        createdAt: new Date().toISOString(),
      };
    }

    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO campaigns (id, title, description, category, color, icon, thumbnailUri, platforms, smartSchedulingEnabled, intervalMinutes, startDate, startTime, hasEndDateLimit, endDate, endTime, isPaused, createdAt, isLoopContainer, mediaPerPost, loopDescriptions, loopMediaPool, usedMediaUris, currentLoopRound, isLoopCompleted, enableFirstComment, firstComment, startMediaUri, startMediaOriginalUri, endMediaUri, endMediaOriginalUri)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          newCampaign.id,
          newCampaign.title,
          newCampaign.description,
          newCampaign.category,
          newCampaign.color,
          newCampaign.icon || 'folder',
          newCampaign.thumbnailUri || null,
          JSON.stringify(newCampaign.platforms || ['facebook', 'instagram']),
          newCampaign.smartSchedulingEnabled ? 1 : 0,
          newCampaign.intervalMinutes || 60,
          newCampaign.startDate,
          newCampaign.startTime,
          newCampaign.hasEndDateLimit ? 1 : 0,
          newCampaign.endDate || null,
          newCampaign.endTime || '23:59',
          newCampaign.isPaused ? 1 : 0,
          newCampaign.createdAt,
          newCampaign.isLoopContainer ? 1 : 0,
          newCampaign.mediaPerPost || 1,
          JSON.stringify(newCampaign.loopDescriptions || []),
          JSON.stringify(newCampaign.loopMediaPool || []),
          JSON.stringify(newCampaign.usedMediaUris || []),
          newCampaign.currentLoopRound || 1,
          newCampaign.isLoopCompleted ? 1 : 0,
          newCampaign.enableFirstComment ? 1 : 0,
          newCampaign.firstComment || null,
          newCampaign.startMediaUri || null,
          newCampaign.startMediaOriginalUri || null,
          newCampaign.endMediaUri || null,
          newCampaign.endMediaOriginalUri || null,
        ]
      );
    } catch (e) {
      console.warn('DB Insert fallback for campaign:', e);
    }

    set((state) => ({ campaigns: [newCampaign, ...state.campaigns.filter(c => c.id !== newCampaign.id)] }));
    return newCampaign;
  },

  updateCampaign: async (idOrObj, updates) => {
    let targetId: string;
    let newUpdates: Partial<Campaign>;

    if (typeof idOrObj === 'object') {
      targetId = idOrObj.id;
      newUpdates = idOrObj;
    } else {
      targetId = idOrObj;
      newUpdates = updates || {};
    }

    const current = get().campaigns.find((c) => c.id === targetId);
    if (!current && typeof idOrObj !== 'object') return;
    const updated = { ...current, ...newUpdates } as Campaign;

    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE campaigns SET title = ?, description = ?, category = ?, color = ?, icon = ?, thumbnailUri = ?, platforms = ?, smartSchedulingEnabled = ?, intervalMinutes = ?, startDate = ?, startTime = ?, hasEndDateLimit = ?, endDate = ?, endTime = ?, isPaused = ?, isLoopContainer = ?, mediaPerPost = ?, loopDescriptions = ?, loopMediaPool = ?, usedMediaUris = ?, currentLoopRound = ?, isLoopCompleted = ?, enableFirstComment = ?, firstComment = ?, startMediaUri = ?, startMediaOriginalUri = ?, endMediaUri = ?, endMediaOriginalUri = ? WHERE id = ?;`,
        [
          updated.title,
          updated.description,
          updated.category,
          updated.color,
          updated.icon || 'folder',
          updated.thumbnailUri || null,
          JSON.stringify(updated.platforms || ['facebook', 'instagram']),
          updated.smartSchedulingEnabled ? 1 : 0,
          updated.intervalMinutes || 60,
          updated.startDate,
          updated.startTime,
          updated.hasEndDateLimit ? 1 : 0,
          updated.endDate || null,
          updated.endTime || '23:59',
          updated.isPaused ? 1 : 0,
          updated.isLoopContainer ? 1 : 0,
          updated.mediaPerPost || 1,
          JSON.stringify(updated.loopDescriptions || []),
          JSON.stringify(updated.loopMediaPool || []),
          JSON.stringify(updated.usedMediaUris || []),
          updated.currentLoopRound || 1,
          updated.isLoopCompleted ? 1 : 0,
          updated.enableFirstComment ? 1 : 0,
          updated.firstComment || null,
          updated.startMediaUri || null,
          updated.startMediaOriginalUri || null,
          updated.endMediaUri || null,
          updated.endMediaOriginalUri || null,
          targetId,
        ]
      );
    } catch (e) {
      console.warn('DB update campaign fallback:', e);
    }

    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === targetId ? updated : c)),
    }));
  },

  toggleCampaignPause: async (id: string) => {
    const target = get().campaigns.find((c) => c.id === id);
    if (!target) return;
    const isPaused = !target.isPaused;
    await get().updateCampaign(id, { isPaused });

    const currentPosts = get().posts;
    const nowISO = new Date().toISOString();

    if (isPaused) {
      // Smart Force Pause: Update any scheduled, waiting, or uploading posts for this container to 'paused'
      const updatedPosts = currentPosts.map((p) => {
        if (p.campaignId === id && (p.status === 'scheduled' || p.status === 'waiting' || p.status === 'uploading')) {
          return { ...p, status: 'paused' as PostStatus, uploadProgress: 0, updatedAt: nowISO };
        }
        return p;
      });

      set({ posts: updatedPosts });

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE posts SET status = 'paused', uploadProgress = 0, updatedAt = ? WHERE campaignId = ? AND status IN ('scheduled', 'waiting', 'uploading');`,
          [nowISO, id]
        );
      } catch (e) {
        console.warn('DB pause posts fallback:', e);
      }
    } else {
      // Smart Resume: Restore any 'paused' posts for this container back to 'scheduled'
      const updatedPosts = currentPosts.map((p) => {
        if (p.campaignId === id && p.status === 'paused') {
          return { ...p, status: 'scheduled' as PostStatus, updatedAt: nowISO };
        }
        return p;
      });

      set({ posts: updatedPosts });

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE posts SET status = 'scheduled', updatedAt = ? WHERE campaignId = ? AND status = 'paused';`,
          [nowISO, id]
        );
      } catch (e) {
        console.warn('DB resume posts fallback:', e);
      }
    }
  },

  deleteCampaign: async (id) => {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM posts WHERE campaignId = ?;`, [id]);
      await db.runAsync(`DELETE FROM campaigns WHERE id = ?;`, [id]);
    } catch (e) {
      console.warn('DB delete campaign fallback:', e);
    }

    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
      posts: state.posts.filter((p) => p.campaignId !== id),
    }));
  },

  addPost: async (postData) => {
    const newPost: Post = {
      id: postData.id || `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      campaignId: postData.campaignId || null,
      caption: postData.caption || '',
      firstComment: postData.firstComment || '',
      images: postData.images || [],
      videos: postData.videos || [],
      platforms: postData.platforms || ['facebook', 'instagram'],
      scheduledAt: postData.scheduledAt || new Date().toISOString(),
      status: postData.status || 'scheduled',
      notes: postData.notes || '',
      failureReason: postData.failureReason || null,
      uploadProgress: postData.uploadProgress || 0,
      tags: postData.tags || [],
      hashtags: postData.hashtags || [],
      mentions: postData.mentions || [],
      createdAt: postData.createdAt || new Date().toISOString(),
      updatedAt: postData.updatedAt || new Date().toISOString(),
    };

    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO posts (id, campaignId, caption, firstComment, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, facebookPostId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          newPost.id,
          newPost.campaignId,
          newPost.caption,
          newPost.firstComment || null,
          JSON.stringify(newPost.images),
          JSON.stringify(newPost.videos),
          JSON.stringify(newPost.platforms),
          newPost.scheduledAt,
          newPost.status,
          newPost.notes,
          newPost.failureReason,
          newPost.uploadProgress,
          JSON.stringify(newPost.tags),
          newPost.facebookPostId || null,
          newPost.createdAt,
          newPost.updatedAt,
        ]
      );
    } catch (e) {
      console.warn('DB insert post fallback:', e);
    }

    set((state) => ({ posts: [...state.posts.filter(p => p.id !== newPost.id), newPost] }));
    return newPost;
  },

  addPostsBatch: async (newPosts: Post[]) => {
    if (!newPosts || newPosts.length === 0) return;
    try {
      const db = await getDatabase();
      for (const p of newPosts) {
        await db.runAsync(
          `INSERT INTO posts (id, campaignId, caption, firstComment, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, facebookPostId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            p.id,
            p.campaignId,
            p.caption,
            p.firstComment || null,
            JSON.stringify(p.images || []),
            JSON.stringify(p.videos || []),
            JSON.stringify(p.platforms || []),
            p.scheduledAt,
            p.status || 'scheduled',
            p.notes || '',
            p.failureReason || null,
            p.uploadProgress || 0,
            JSON.stringify(p.tags || []),
            p.facebookPostId || null,
            p.createdAt || new Date().toISOString(),
            p.updatedAt || new Date().toISOString(),
          ]
        );
      }
    } catch (e) {
      console.warn('DB insert post batch fallback:', e);
    }

    set((state) => {
      const newIds = new Set(newPosts.map((p) => p.id));
      return { posts: [...state.posts.filter((p) => !newIds.has(p.id)), ...newPosts] };
    });
  },

  updatePost: async (id, updates) => {
    const current = get().posts.find((p) => p.id === id);
    if (!current) return;
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };

    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE posts SET campaignId = ?, caption = ?, firstComment = ?, images = ?, videos = ?, platforms = ?, scheduledAt = ?, status = ?, notes = ?, failureReason = ?, uploadProgress = ?, tags = ?, facebookPostId = ?, updatedAt = ? WHERE id = ?;`,
        [
          updated.campaignId,
          updated.caption,
          updated.firstComment || null,
          JSON.stringify(updated.images),
          JSON.stringify(updated.videos),
          JSON.stringify(updated.platforms),
          updated.scheduledAt,
          updated.status,
          updated.notes,
          updated.failureReason,
          updated.uploadProgress,
          JSON.stringify(updated.tags),
          updated.facebookPostId || null,
          updated.updatedAt,
          id,
        ]
      );
    } catch (e) {
      console.warn('DB update post fallback:', e);
    }

    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deletePost: async (id) => {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM posts WHERE id = ?;`, [id]);
    } catch (e) {
      console.warn('DB delete post fallback:', e);
    }

    set((state) => ({
      posts: state.posts.filter((p) => p.id !== id),
    }));
  },

  clearScheduledPostsForCampaign: async (campaignId: string) => {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM posts WHERE campaignId = ? AND (status = 'scheduled' OR status = 'waiting');`, [campaignId]);
    } catch (e) {
      console.warn('DB clear scheduled posts fallback:', e);
    }

    set((state) => ({
      posts: state.posts.filter((p) => !(p.campaignId === campaignId && (p.status === 'scheduled' || p.status === 'waiting'))),
    }));
  },

  // Smart loop deletion: safely removes selected posts and reclaims
  // their media URIs back from usedMediaUris so the loop can reuse them.
  smartDeleteLoopPosts: async (containerId: string, postIds: string[]) => {
    const state = get();
    const container = state.campaigns.find((c) => c.id === containerId);
    if (!container) return { deleted: 0, reclaimed: 0 };

    const postsToDelete = state.posts.filter((p) => postIds.includes(p.id));
    if (postsToDelete.length === 0) return { deleted: 0, reclaimed: 0 };

    const deletedIds = postsToDelete.map((p) => p.id);

    // Collect all media URIs used by these posts so we can return them to available pool
    const reclaimedUris = new Set<string>();
    for (const post of postsToDelete) {
      for (const uri of (post.images || [])) {
        reclaimedUris.add(uri);
      }
    }

    // Remove from DB
    try {
      const db = await getDatabase();
      const placeholders = deletedIds.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM posts WHERE id IN (${placeholders});`, deletedIds);
    } catch (e) {
      console.warn('[smartDeleteLoopPosts] DB delete fallback:', e);
    }

    // Delete from Meta Graph API if we have access token & facebookPostId
    try {
      const { useSocialAccountsStore } = require('./useSocialAccountsStore');
      const { deleteMetaScheduledPost } = require('../services/facebookPublisher');
      const fbAcc = useSocialAccountsStore.getState().getAccount('facebook');
      if (fbAcc?.accessToken) {
        for (const post of postsToDelete) {
          const targetFbId = post.facebookPostId || post.id;
          await deleteMetaScheduledPost(fbAcc.accessToken, targetFbId, fbAcc.pageId || 'me');
        }
      }
    } catch (apiErr) {
      console.warn('[smartDeleteLoopPosts] Failed to delete from Meta Graph API:', apiErr);
    }

    // Update in-memory posts
    set((st) => ({
      posts: st.posts.filter((p) => !deletedIds.includes(p.id)),
    }));

    // Reclaim media URIs from the container's usedMediaUris
    // so they are eligible to be picked again in future loop rounds
    if (container.isLoopContainer && reclaimedUris.size > 0) {
      const currentUsed: string[] = container.usedMediaUris || [];
      const updatedUsed = currentUsed.filter((uri) => !reclaimedUris.has(uri));
      const loopPool = container.loopMediaPool || [];
      const remainingUnused = loopPool.filter((uri) => !updatedUsed.includes(uri)).length;
      const mediaPerPost = Math.max(1, container.mediaPerPost || 1);
      const nowHasMedia = remainingUnused >= mediaPerPost;

      await get().updateCampaign(containerId, {
        usedMediaUris: updatedUsed,
        // Reopen loop if it was previously marked completed and we just freed media
        isLoopCompleted: nowHasMedia ? false : container.isLoopCompleted,
      });
    }

    return { deleted: deletedIds.length, reclaimed: reclaimedUris.size };
  },

  duplicatePost: async (id) => {
    const source = get().posts.find((p) => p.id === id);
    if (!source) return null;
    const { id: _, createdAt: __, updatedAt: ___, ...rest } = source;
    return await get().addPost({
      ...rest,
      caption: `${source.caption} (Copy)`,
    });
  },

  movePost: async (postId, targetCampaignId) => {
    await get().updatePost(postId, { campaignId: targetCampaignId });
  },

  reorderPosts: (reorderedPosts) => {
    set({ posts: reorderedPosts });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedTag: (selectedTag) => set({ selectedTag }),
  setSelectedStatus: (selectedStatus) => set({ selectedStatus }),

  checkMissedPosts: async () => {
    const now = new Date();
    const currentPosts = get().posts;
    const campaigns = get().campaigns;
    const pausedCampaignIds = new Set(campaigns.filter((c) => c.isPaused).map((c) => c.id));
    let hasChanges = false;

    const updated = currentPosts.map((post) => {
      // Skip posts belonging to paused containers!
      if (post.campaignId && pausedCampaignIds.has(post.campaignId)) {
        return post;
      }
      if (post.status === 'scheduled' || post.status === 'waiting') {
        const schedDate = new Date(post.scheduledAt);
        if (schedDate < now) {
          hasChanges = true;
          return { ...post, status: 'missed' as PostStatus, updatedAt: now.toISOString() };
        }
      }
      return post;
    });

    if (hasChanges) {
      set({ posts: updated });
    }
  },

  triggerNextLoop: async (containerId: string, options?: { endType: 'media' | 'date'; endDate?: string; endTime?: string }) => {
    const container = get().campaigns.find((c) => c.id === containerId);
    if (!container || !container.isLoopContainer) return;

    // Check if the loop was fully completed (all media consumed) in the previous round
    const wasCompleted = container.isLoopCompleted || (container.usedMediaUris || []).length >= (container.loopMediaPool || []).length;
    
    // Only increment the round number if we finished the previous one
    const newRound = wasCompleted ? (container.currentLoopRound || 1) + 1 : (container.currentLoopRound || 1);
    
    // Carry over already used media if we haven't finished the pool yet (Option 1 behavior)
    const initialUsedMedia = wasCompleted ? [] : (container.usedMediaUris || []);

    const todayISO = new Date().toISOString().split('T')[0];
    const startTime = container.startTime || '09:00';

    const useDateCutoff = options?.endType === 'date';
    const targetEndDate = useDateCutoff ? options?.endDate : undefined;
    const targetEndTime = useDateCutoff ? (options?.endTime || '23:59') : undefined;

    const result = generateLoopPosts({
      container: { 
        ...container, 
        currentLoopRound: newRound,
        hasEndDateLimit: useDateCutoff,
        endDate: targetEndDate,
        endTime: targetEndTime
      },
      loopDescriptions: container.loopDescriptions || [],
      loopMediaPool: container.loopMediaPool || [],
      usedMediaUris: initialUsedMedia, // Continue from previous used ones!
      mediaPerPost: container.mediaPerPost || 1,
      startDate: todayISO,
      startTime: startTime,
      endDate: targetEndDate,
      endTime: targetEndTime,
      intervalMinutes: container.intervalMinutes || 60,
      platforms: container.platforms || ['facebook', 'instagram'],
    });

    const updatedContainer: Campaign = {
      ...container,
      usedMediaUris: result.updatedUsedMediaUris,
      currentLoopRound: newRound,
      isLoopCompleted: result.isLoopCompleted,
      startDate: todayISO,
      hasEndDateLimit: useDateCutoff,
      endDate: targetEndDate,
      endTime: targetEndTime,
    };

    await get().updateCampaign(updatedContainer);

    for (const post of result.newPosts) {
      await get().addPost(post);
    }
  },

  addMediaToLoopPool: async (containerId: string, newUris: string[]) => {
    const container = get().campaigns.find((c) => c.id === containerId);
    if (!container || !newUris || newUris.length === 0) return;

    // Ensure all newly added media are saved to the persistent app hidden folder
    const persistentUris = await saveMultipleMediaToHiddenFolder(newUris);
    const currentPool = container.loopMediaPool || [];
    const updatedPool = [...currentPool, ...persistentUris];
    const unusedCount = updatedPool.length - (container.usedMediaUris || []).length;
    const isLoopCompleted = unusedCount < (container.mediaPerPost || 1);

    await get().updateCampaign(containerId, {
      loopMediaPool: updatedPool,
      isLoopCompleted,
    });
  },
}));
