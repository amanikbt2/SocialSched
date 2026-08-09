import { useCampaignStore } from '../stores/useCampaignStore';
import { useQueueStore } from '../stores/useQueueStore';
import { Post } from '../db/types';

let intervalId: NodeJS.Timeout | null = null;
let isProcessing = false;

export function startQueueEngine() {
  if (intervalId) return;
  intervalId = setInterval(processQueueTick, 1500); // Tick every 1.5 seconds
}

export function stopQueueEngine() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function processQueueTick() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const { networkStatus, engineState, setEngineState, setActiveUpload } = useQueueStore.getState();
    const { posts, updatePost, checkMissedPosts } = useCampaignStore.getState();

    if (engineState === 'paused') {
      isProcessing = false;
      return;
    }

    // 1. Check for missed posts
    await checkMissedPosts();

    // 2. Check if offline
    if (networkStatus === 'offline') {
      setEngineState('paused');
      const activeUploading = posts.find((p) => p.status === 'uploading');
      if (activeUploading) {
        // Save current upload progress, mark as paused
        await updatePost(activeUploading.id, {
          status: 'paused',
          failureReason: 'Internet connection lost. Upload paused.',
        });
        setActiveUpload(null, 0);
      }
      isProcessing = false;
      return;
    }

    // 3. Find post currently uploading or next waiting/scheduled post whose time has come
    const now = new Date();
    let currentUpload = posts.find((p) => p.status === 'uploading');

    if (!currentUpload) {
      // Find candidate to start
      const candidate = posts.find(
        (p) =>
          (p.status === 'scheduled' || p.status === 'waiting' || p.status === 'paused') &&
          new Date(p.scheduledAt) <= now
      );

      if (candidate) {
        currentUpload = candidate;
        await updatePost(candidate.id, {
          status: 'uploading',
          failureReason: null,
        });
      }
    }

    if (currentUpload) {
      setEngineState('processing');
      const currentProgress = currentUpload.uploadProgress || 0;

      // Handle Flaky Connection
      if (networkStatus === 'flaky' && Math.random() < 0.3) {
        // Simulate flaky drop
        await updatePost(currentUpload.id, {
          status: 'failed',
          failureReason: 'Upload timeout due to poor network stability (Flaky Mode).',
        });
        setActiveUpload(null, 0);
        setEngineState('idle');
        isProcessing = false;
        return;
      }

      // Increment progress (e.g. +20-35% per tick)
      const nextProgress = Math.min(100, currentProgress + Math.floor(Math.random() * 20) + 15);
      setActiveUpload(currentUpload.id, nextProgress);

      if (nextProgress >= 100) {
        // Upload Completed!
        await updatePost(currentUpload.id, {
          status: 'published',
          uploadProgress: 100,
          failureReason: null,
        });
        setActiveUpload(null, 0);
        setEngineState('idle');
      } else {
        await updatePost(currentUpload.id, {
          uploadProgress: nextProgress,
        });
      }
    } else {
      setEngineState('idle');
      setActiveUpload(null, 0);
    }
  } catch (error) {
    console.error('Queue Engine error:', error);
  } finally {
    isProcessing = false;
  }
}
