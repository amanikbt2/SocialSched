import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NetworkStatus = 'online' | 'offline' | 'flaky';
export type QueueEngineState = 'idle' | 'processing' | 'paused';
export type PausedReason = 'user' | 'network' | null;

interface QueueStoreState {
  networkStatus: NetworkStatus;
  engineState: QueueEngineState;
  pausedReason: PausedReason;
  activePostId: string | null;
  activeProgress: number; // 0 - 100
  autoRetry: boolean;
  
  // Actions
  setNetworkStatus: (status: NetworkStatus) => Promise<void>;
  setEngineState: (state: QueueEngineState, reason?: PausedReason) => void;
  setActiveUpload: (postId: string | null, progress: number) => void;
  setAutoRetry: (enabled: boolean) => Promise<void>;
  loadQueueSettings: () => Promise<void>;
}

export const useQueueStore = create<QueueStoreState>((set) => ({
  networkStatus: 'online',
  engineState: 'idle',
  pausedReason: null,
  activePostId: null,
  activeProgress: 0,
  autoRetry: true,

  setNetworkStatus: async (status) => {
    await AsyncStorage.setItem('smartflow_network_status', status);
    set((state) => {
      const updates: Partial<QueueStoreState> = { networkStatus: status };
      if ((status === 'online' || status === 'flaky') && state.engineState === 'paused' && state.pausedReason === 'network') {
        console.log('📶 Internet connection restored. Auto-resuming queue engine...');
        updates.engineState = 'idle';
        updates.pausedReason = null;
      }
      return updates;
    });
  },

  setEngineState: (engineState, reason = null) => set((state) => ({ 
    engineState,
    pausedReason: engineState === 'paused' ? (reason || state.pausedReason) : null
  })),

  setActiveUpload: (activePostId, activeProgress) => set({ activePostId, activeProgress }),

  setAutoRetry: async (autoRetry) => {
    await AsyncStorage.setItem('smartflow_auto_retry', JSON.stringify(autoRetry));
    set({ autoRetry });
  },

  loadQueueSettings: async () => {
    try {
      const net = (await AsyncStorage.getItem('smartflow_network_status')) as NetworkStatus | null;
      const retry = await AsyncStorage.getItem('smartflow_auto_retry');
      set({
        networkStatus: net || 'online',
        autoRetry: retry ? JSON.parse(retry) : true,
      });
    } catch (e) {
      console.warn('Failed to load queue settings', e);
    }
  },
}));
