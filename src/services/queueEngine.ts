import { useCampaignStore } from '../stores/useCampaignStore';
import { useQueueStore } from '../stores/useQueueStore';
import { useSocialAccountsStore } from '../stores/useSocialAccountsStore';
import { publishToFacebook } from './facebookPublisher';
import { Post } from '../db/types';

let intervalId: NodeJS.Timeout | null = null;
let isProcessing = false;
const processingPostIds = new Set<string>();

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

/**
 * Manually trigger instant publishing for a post immediately
 */
export async function triggerInstantPublish(postId: string): Promise<{ success: boolean; error?: string }> {
  if (processingPostIds.has(postId)) {
    return { success: false, error: 'Post is currently being processed.' };
  }
  processingPostIds.add(postId);

  try {
    const { posts, updatePost } = useCampaignStore.getState();
    const targetPost = posts.find((p) => p.id === postId);

    if (!targetPost) {
      return { success: false, error: 'Post not found.' };
    }

    await updatePost(postId, { status: 'uploading', uploadProgress: 50, failureReason: null });

    const fbAccount = useSocialAccountsStore.getState().getAccount('facebook');

    if (!fbAccount || !fbAccount.isConnected || !fbAccount.accessToken) {
      const errorMsg = 'No connected Facebook account found. Open Settings (☰) to connect your Facebook Page.';
      await updatePost(postId, { status: 'failed', uploadProgress: 0, failureReason: errorMsg });
      return { success: false, error: errorMsg };
    }

    console.log('🚀 Triggering instant publish to Facebook Page for post:', postId);
    const fbResult = await publishToFacebook(
      { ...targetPost, scheduledAt: new Date().toISOString() }, // Force immediate timestamp
      fbAccount.accessToken,
      fbAccount.pageId || 'me'
    );

    if (fbResult.success) {
      await updatePost(postId, { status: 'published', uploadProgress: 100, failureReason: null });
      return { success: true };
    } else {
      await updatePost(postId, { status: 'failed', uploadProgress: 0, failureReason: fbResult.error });
      return { success: false, error: fbResult.error };
    }
  } finally {
    processingPostIds.delete(postId);
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
        await updatePost(activeUploading.id, {
          status: 'paused',
          failureReason: 'Internet connection lost. Upload paused.',
        });
        setActiveUpload(null, 0);
      }
      isProcessing = false;
      return;
    }

    // 3. Find post currently uploading or next candidate post ready to send to Meta servers
    let currentUpload = posts.find((p) => p.status === 'uploading' || processingPostIds.has(p.id));

    if (!currentUpload) {
      // Pick posts ready for Meta:
      // 1. Long schedules (>= 10 mins in future) -> Upload to Meta immediately so Meta handles server scheduling.
      // 2. Short schedules (1-9 mins or due now) -> Wait until scheduledAt arrives, then publish live at exact minute!
      const nowTime = Date.now();
      const candidate = posts.find((p) => {
        if (processingPostIds.has(p.id)) return false;
        if (p.status !== 'scheduled' && p.status !== 'waiting' && p.status !== 'paused') return false;
        const schedTime = Date.parse(p.scheduledAt);
        const diffMins = (schedTime - nowTime) / (1000 * 60);
        return diffMins >= 10 || schedTime <= nowTime;
      });

      if (candidate) {
        currentUpload = candidate;
        processingPostIds.add(candidate.id);
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
        await updatePost(currentUpload.id, {
          status: 'failed',
          failureReason: 'Upload timeout due to poor network stability (Flaky Mode).',
        });
        setActiveUpload(null, 0);
        setEngineState('idle');
        isProcessing = false;
        return;
      }

      // Increment upload progress
      const nextProgress = Math.min(100, currentProgress + Math.floor(Math.random() * 35) + 30);
      setActiveUpload(currentUpload.id, nextProgress);

      if (nextProgress >= 100) {
        // Upload Completed! Execute Meta Server Scheduling / Publishing
        let publishError: string | null = null;
        const targetPlatforms = currentUpload.platforms || ['facebook'];

        if (targetPlatforms.includes('facebook')) {
          const fbAccount = useSocialAccountsStore.getState().getAccount('facebook');

          if (!fbAccount || !fbAccount.isConnected || !fbAccount.accessToken) {
            publishError = 'No connected Facebook account found. Open Settings (☰) to connect your Facebook Page.';
          } else {
            console.log('🚀 Queue Engine: Uploading post to Meta servers for post:', currentUpload.id);
            const fbResult = await publishToFacebook(
              currentUpload,
              fbAccount.accessToken,
              fbAccount.pageId || 'me'
            );

            if (!fbResult.success) {
              publishError = fbResult.error || 'Facebook publishing failed.';
            }
          }
        }

        if (publishError) {
          console.error('❌ Queue Engine: Post publish failed with error:', publishError);
          await updatePost(currentUpload.id, {
            status: 'failed',
            uploadProgress: 0,
            failureReason: publishError,
          });
        } else {
          console.log('✅ Queue Engine: Post uploaded & scheduled on Meta servers!');
          await updatePost(currentUpload.id, {
            status: 'published',
            uploadProgress: 100,
            failureReason: null,
          });
        }

        processingPostIds.delete(currentUpload.id);
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
