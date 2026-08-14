import { create } from 'zustand';
import { SocialPlatform } from '../db/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedFacebookPage {
  id: string;
  name: string;
  accessToken: string;
  avatarUrl?: string;
  linkedAt: string;
  isLastUsed?: boolean;
}

export interface LinkedAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string;
  pageId?: string;
  isConnected: boolean;
  linkedAt: string;
}

interface SocialAccountsState {
  accounts: LinkedAccount[];
  savedFacebookPages: SavedFacebookPage[];
  lastUsedPageId: string | null;
  isLoading: boolean;

  // Actions
  linkAccount: (account: Omit<LinkedAccount, 'id' | 'linkedAt'>) => void;
  unlinkAccount: (platform: SocialPlatform) => void;
  getAccount: (platform: SocialPlatform) => LinkedAccount | undefined;
  saveFacebookPage: (page: Omit<SavedFacebookPage, 'linkedAt'>) => Promise<void>;
  removeSavedFacebookPage: (pageId: string) => Promise<void>;
  switchFacebookPage: (pageId: string) => Promise<void>;
  loadSavedAccounts: () => Promise<void>;
}

const STORAGE_KEY_SAVED_PAGES = 'smartflow_saved_fb_pages';
const STORAGE_KEY_LAST_USED_PAGE_ID = 'smartflow_last_used_fb_page_id';

const DEFAULT_ACCOUNTS: LinkedAccount[] = [
  {
    id: 'acc-fb-1',
    platform: 'facebook',
    username: '@FacebookPage',
    displayName: 'Facebook Page',
    isConnected: false,
    linkedAt: new Date().toISOString(),
  },
  {
    id: 'acc-ig-1',
    platform: 'instagram',
    username: '@InstagramAccount',
    displayName: 'Instagram Account',
    isConnected: false,
    linkedAt: new Date().toISOString(),
  },
  {
    id: 'acc-tk-1',
    platform: 'tiktok',
    username: '@TikTokAccount',
    displayName: 'TikTok Account',
    isConnected: false,
    linkedAt: new Date().toISOString(),
  },
  {
    id: 'acc-x-1',
    platform: 'x',
    username: '@XAccount',
    displayName: 'X Account',
    isConnected: false,
    linkedAt: new Date().toISOString(),
  },
];

export const useSocialAccountsStore = create<SocialAccountsState>((set, get) => ({
  accounts: DEFAULT_ACCOUNTS,
  savedFacebookPages: [],
  lastUsedPageId: null,
  isLoading: false,

  linkAccount: (newAcc) => {
    const id = `acc-${newAcc.platform}-${Date.now()}`;
    const fullAccount: LinkedAccount = {
      ...newAcc,
      id,
      linkedAt: new Date().toISOString(),
      isConnected: true,
    };

    set((state) => ({
      accounts: [
        ...state.accounts.filter((a) => a.platform !== newAcc.platform),
        fullAccount,
      ],
    }));
  },

  unlinkAccount: (platform) => {
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.platform === platform ? { ...a, isConnected: false, accessToken: undefined } : a
      ),
    }));
  },

  getAccount: (platform) => {
    return get().accounts.find((a) => a.platform === platform && a.isConnected);
  },

  saveFacebookPage: async (newPage) => {
    const currentList = get().savedFacebookPages;
    const exists = currentList.some((p) => p.id === newPage.id);

    const updatedList = exists
      ? currentList.map((p) =>
          p.id === newPage.id
            ? { ...p, ...newPage, isLastUsed: true, linkedAt: new Date().toISOString() }
            : { ...p, isLastUsed: false }
        )
      : [
          ...currentList.map((p) => ({ ...p, isLastUsed: false })),
          { ...newPage, isLastUsed: true, linkedAt: new Date().toISOString() },
        ];

    set({ savedFacebookPages: updatedList, lastUsedPageId: newPage.id });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_SAVED_PAGES, JSON.stringify(updatedList));
      await AsyncStorage.setItem(STORAGE_KEY_LAST_USED_PAGE_ID, newPage.id);
    } catch (e) {
      console.warn('Failed to persist saved Facebook pages:', e);
    }
  },

  removeSavedFacebookPage: async (pageId) => {
    const updatedList = get().savedFacebookPages.filter((p) => p.id !== pageId);
    let newLastUsedId = get().lastUsedPageId;

    if (newLastUsedId === pageId) {
      newLastUsedId = updatedList.length > 0 ? updatedList[0].id : null;
      if (newLastUsedId) {
        const target = updatedList.find((p) => p.id === newLastUsedId);
        if (target) target.isLastUsed = true;
      }
    }

    set({ savedFacebookPages: updatedList, lastUsedPageId: newLastUsedId });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_SAVED_PAGES, JSON.stringify(updatedList));
      if (newLastUsedId) {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_USED_PAGE_ID, newLastUsedId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY_LAST_USED_PAGE_ID);
      }
    } catch (e) {
      console.warn('Failed to remove saved Facebook page:', e);
    }
  },

  switchFacebookPage: async (pageId) => {
    const currentList = get().savedFacebookPages;
    const targetPage = currentList.find((p) => p.id === pageId);
    if (!targetPage) return;

    const updatedList = currentList.map((p) => ({
      ...p,
      isLastUsed: p.id === pageId,
    }));

    set({ savedFacebookPages: updatedList, lastUsedPageId: pageId });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_SAVED_PAGES, JSON.stringify(updatedList));
      await AsyncStorage.setItem(STORAGE_KEY_LAST_USED_PAGE_ID, pageId);
    } catch (e) {
      console.warn('Failed to save last used Facebook page:', e);
    }

    // Connect target page immediately
    get().linkAccount({
      platform: 'facebook',
      username: `@${targetPage.name.replace(/\s+/g, '')}`,
      displayName: targetPage.name,
      avatarUrl: targetPage.avatarUrl,
      accessToken: targetPage.accessToken,
      pageId: targetPage.id,
      isConnected: true,
    });
  },

  loadSavedAccounts: async () => {
    try {
      const storedListStr = await AsyncStorage.getItem(STORAGE_KEY_SAVED_PAGES);
      const storedLastUsedId = await AsyncStorage.getItem(STORAGE_KEY_LAST_USED_PAGE_ID);

      if (storedListStr) {
        const parsedList: SavedFacebookPage[] = JSON.parse(storedListStr);
        const activeId = storedLastUsedId || (parsedList.length > 0 ? parsedList[0].id : null);

        const updatedList = parsedList.map((p) => ({
          ...p,
          isLastUsed: p.id === activeId,
        }));

        set({ savedFacebookPages: updatedList, lastUsedPageId: activeId });

        // Auto-pick & connect the last used Facebook page on refresh!
        if (activeId) {
          const autoPage = updatedList.find((p) => p.id === activeId);
          if (autoPage) {
            get().linkAccount({
              platform: 'facebook',
              username: `@${autoPage.name.replace(/\s+/g, '')}`,
              displayName: autoPage.name,
              avatarUrl: autoPage.avatarUrl,
              accessToken: autoPage.accessToken,
              pageId: autoPage.id,
              isConnected: true,
            });
            console.log(`⚡ Auto-connected Last Used Facebook Page: "${autoPage.name}" (${autoPage.id})`);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved accounts from storage:', e);
    }
  },
}));
