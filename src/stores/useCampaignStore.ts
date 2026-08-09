import { create } from 'zustand';
import { Campaign, Post, PostStatus, SocialPlatform } from '../db/types';
import { getDatabase } from '../db/database';

interface CampaignState {
  campaigns: Campaign[];
  posts: Post[];
  isLoading: boolean;
  searchQuery: string;
  selectedTag: string | null;
  selectedStatus: PostStatus | 'all';
  
  // Actions
  loadData: () => Promise<void>;
  addCampaign: (title: string, category: string, color: string, description?: string) => Promise<Campaign>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  
  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'uploadProgress'>) => Promise<Post>;
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  duplicatePost: (id: string) => Promise<Post | null>;
  movePost: (postId: string, targetCampaignId: string | null) => Promise<void>;
  reorderPosts: (reorderedPosts: Post[]) => void;
  
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedStatus: (status: PostStatus | 'all') => void;
  
  checkMissedPosts: () => Promise<void>;
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
      const rawCampaigns = await db.getAllAsync<any>('SELECT * FROM campaigns ORDER BY createdAt DESC;');
      const rawPosts = await db.getAllAsync<any>('SELECT * FROM posts ORDER BY datetime(scheduledAt) ASC;');

      const campaigns: Campaign[] = rawCampaigns.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description || '',
        category: c.category,
        color: c.color,
        icon: c.icon || 'folder',
        createdAt: c.createdAt,
      }));

      const posts: Post[] = rawPosts.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        caption: p.caption,
        images: JSON.parse(p.images || '[]'),
        videos: JSON.parse(p.videos || '[]'),
        platforms: JSON.parse(p.platforms || '[]') as SocialPlatform[],
        scheduledAt: p.scheduledAt,
        status: p.status as PostStatus,
        notes: p.notes || '',
        failureReason: p.failureReason || null,
        uploadProgress: p.uploadProgress || 0,
        tags: JSON.parse(p.tags || '[]'),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      set({ campaigns, posts, isLoading: false });
      await get().checkMissedPosts();
    } catch (error) {
      console.error('Error loading campaign data:', error);
      set({ isLoading: false });
    }
  },

  addCampaign: async (title, category, color, description = '') => {
    const db = await getDatabase();
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      title,
      description,
      category,
      color,
      icon: 'folder',
      createdAt: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO campaigns (id, title, description, category, color, icon, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [newCampaign.id, newCampaign.title, newCampaign.description, newCampaign.category, newCampaign.color, newCampaign.icon!, newCampaign.createdAt]
    );

    set((state) => ({ campaigns: [newCampaign, ...state.campaigns] }));
    return newCampaign;
  },

  updateCampaign: async (id, updates) => {
    const db = await getDatabase();
    const current = get().campaigns.find((c) => c.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };

    await db.runAsync(
      `UPDATE campaigns SET title = ?, description = ?, category = ?, color = ? WHERE id = ?;`,
      [updated.title, updated.description, updated.category, updated.color, id]
    );

    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCampaign: async (id) => {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM campaigns WHERE id = ?;`, [id]);
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
      posts: state.posts.map((p) => (p.campaignId === id ? { ...p, campaignId: null } : p)),
    }));
  },

  addPost: async (postData) => {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const newPost: Post = {
      ...postData,
      id: `post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      uploadProgress: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO posts (id, campaignId, caption, images, videos, platforms, scheduledAt, status, notes, failureReason, uploadProgress, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        newPost.id,
        newPost.campaignId,
        newPost.caption,
        JSON.stringify(newPost.images),
        JSON.stringify(newPost.videos),
        JSON.stringify(newPost.platforms),
        newPost.scheduledAt,
        newPost.status,
        newPost.notes,
        newPost.failureReason,
        newPost.uploadProgress,
        JSON.stringify(newPost.tags),
        newPost.createdAt,
        newPost.updatedAt,
      ]
    );

    set((state) => ({ posts: [...state.posts, newPost] }));
    return newPost;
  },

  updatePost: async (id, updates) => {
    const db = await getDatabase();
    const current = get().posts.find((p) => p.id === id);
    if (!current) return;

    const updated: Post = { ...current, ...updates, updatedAt: new Date().toISOString() };

    await db.runAsync(
      `UPDATE posts SET campaignId = ?, caption = ?, images = ?, videos = ?, platforms = ?, scheduledAt = ?, status = ?, notes = ?, failureReason = ?, uploadProgress = ?, tags = ?, updatedAt = ?
       WHERE id = ?;`,
      [
        updated.campaignId,
        updated.caption,
        JSON.stringify(updated.images),
        JSON.stringify(updated.videos),
        JSON.stringify(updated.platforms),
        updated.scheduledAt,
        updated.status,
        updated.notes,
        updated.failureReason,
        updated.uploadProgress,
        JSON.stringify(updated.tags),
        updated.updatedAt,
        id,
      ]
    );

    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deletePost: async (id) => {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM posts WHERE id = ?;`, [id]);
    set((state) => ({
      posts: state.posts.filter((p) => p.id !== id),
    }));
  },

  duplicatePost: async (id) => {
    const target = get().posts.find((p) => p.id === id);
    if (!target) return null;

    const duplicatedPostData = {
      campaignId: target.campaignId,
      caption: `${target.caption} (Copy)`,
      images: [...target.images],
      videos: [...target.videos],
      platforms: [...target.platforms],
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), // +1 day
      status: 'draft' as PostStatus,
      notes: target.notes,
      failureReason: null,
      tags: [...target.tags],
    };

    return await get().addPost(duplicatedPostData);
  },

  movePost: async (postId, targetCampaignId) => {
    await get().updatePost(postId, { campaignId: targetCampaignId });
  },

  reorderPosts: (reorderedPosts) => {
    set({ posts: reorderedPosts });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),

  checkMissedPosts: async () => {
    const now = new Date();
    const { posts, updatePost } = get();
    for (const post of posts) {
      if (
        (post.status === 'scheduled' || post.status === 'waiting') &&
        new Date(post.scheduledAt) < now
      ) {
        await updatePost(post.id, {
          status: 'missed',
          failureReason: 'Scheduled time passed while app was closed or offline.',
        });
      }
    }
  },
}));
