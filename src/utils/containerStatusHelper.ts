import { Container, Post } from '../db/types';

export interface ContainerStatusInfo {
  status: 'paused' | 'calculating' | 'scheduling' | 'waiting_network' | 'finished' | 'idle' | 'failed';
  label: string;
  badgeColor: string;
}

export function getContainerStatusInfo(
  container: Container,
  posts: Post[],
  networkStatus: string = 'online',
  activeUploadPostId: string | null = null
): ContainerStatusInfo {
  // 1. Manually Paused by user
  if (container.isPaused) {
    return {
      status: 'paused',
      label: 'PAUSED',
      badgeColor: '#F59E0B', // Amber
    };
  }

  const containerPosts = posts.filter((p) => p.campaignId === container.id);

  // 2. Loop container completed or all posts in batch container published
  if (container.isLoopContainer && container.isLoopCompleted) {
    return {
      status: 'finished',
      label: 'FINISHED',
      badgeColor: '#10B981', // Emerald Green
    };
  }

  if (containerPosts.length > 0 && containerPosts.every((p) => p.status === 'published')) {
    return {
      status: 'finished',
      label: 'FINISHED',
      badgeColor: '#10B981',
    };
  }

  // 3. No posts generated yet -> Calculating time / intervals
  if (containerPosts.length === 0) {
    return {
      status: 'calculating',
      label: 'CALCULATING TIME...',
      badgeColor: '#3B82F6', // Blue
    };
  }

  // 4. Active upload or queue engine scheduling in progress
  const uploadingPost = containerPosts.find(
    (p) => p.status === 'uploading' || (activeUploadPostId && p.id === activeUploadPostId)
  );

  if (uploadingPost) {
    const progressText = uploadingPost.uploadProgress && uploadingPost.uploadProgress > 0
      ? ` (${uploadingPost.uploadProgress}%)`
      : '';
    return {
      status: 'scheduling',
      label: `SCHEDULING${progressText}...`,
      badgeColor: '#8B5CF6', // Purple
    };
  }

  // 5. Network Offline / Waiting for network
  if (networkStatus === 'offline') {
    return {
      status: 'waiting_network',
      label: 'WAITING FOR NETWORK...',
      badgeColor: '#F97316', // Orange
    };
  }

  // 6. Check for failed posts requiring retry
  const hasFailedPost = containerPosts.some((p) => p.status === 'failed' || p.status === 'missed');
  if (hasFailedPost) {
    return {
      status: 'failed',
      label: 'FAILED (NETWORK ERROR)',
      badgeColor: '#EF4444', // Red
    };
  }

  // 7. Active running container waiting for next scheduled slot -> Idle...
  const scheduledPosts = containerPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'waiting'
  );

  if (scheduledPosts.length > 0) {
    const nowTime = Date.now();
    const isDueNow = scheduledPosts.some((p) => Date.parse(p.scheduledAt) <= nowTime);

    if (isDueNow) {
      return {
        status: 'scheduling',
        label: 'SCHEDULING NOW...',
        badgeColor: '#10B981',
      };
    }

    return {
      status: 'idle',
      label: 'IDLE...',
      badgeColor: '#10B981', // Green
    };
  }

  return {
    status: 'idle',
    label: 'IDLE...',
    badgeColor: '#10B981',
  };
}
