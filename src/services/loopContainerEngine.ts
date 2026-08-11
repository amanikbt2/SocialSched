import { Container, Post, SocialPlatform } from '../db/types';

export interface LoopGenerationParams {
  container: Container;
  loopDescriptions: string[];
  loopMediaPool: string[];
  usedMediaUris: string[];
  mediaPerPost: number;
  startDate: string; // ISO date or YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;  // ISO date or YYYY-MM-DD
  intervalMinutes: number;
  platforms: SocialPlatform[];
}

export interface LoopGenerationResult {
  newPosts: Post[];
  updatedUsedMediaUris: string[];
  isLoopCompleted: boolean;
}

export function generateLoopPosts(params: LoopGenerationParams): LoopGenerationResult {
  const {
    container,
    loopDescriptions,
    loopMediaPool,
    usedMediaUris: initialUsed,
    mediaPerPost,
    startDate,
    startTime,
    endDate,
    intervalMinutes,
    platforms,
  } = params;

  const usedSet = new Set<string>(initialUsed || []);
  let availableMedia = (loopMediaPool || []).filter((uri) => !usedSet.has(uri));
  
  const generatedPosts: Post[] = [];
  const updatedUsed = [...(initialUsed || [])];

  // Helper to parse start timestamp
  const [startH, startM] = (startTime || '09:00').split(':').map(Number);
  
  // Normalize startDate (e.g. YYYY-MM-DD)
  let baseDateStr = startDate || new Date().toISOString().split('T')[0];
  if (baseDateStr.includes('T')) {
    baseDateStr = baseDateStr.split('T')[0];
  }

  let currentCursor = new Date(`${baseDateStr}T${String(startH || 9).padStart(2, '0')}:${String(startM || 0).padStart(2, '0')}:00`);
  if (isNaN(currentCursor.getTime()) || currentCursor.getTime() <= Date.now()) {
    currentCursor = new Date(Date.now() + 15 * 60000);
  }

  let endCutoff: number | null = null;
  if (endDate && endDate.trim() !== '') {
    let cleanEndDate = endDate.trim();
    if (cleanEndDate.includes('T')) {
      cleanEndDate = cleanEndDate.split('T')[0];
    }
    const parsedEnd = Date.parse(`${cleanEndDate}T23:59:59`);
    if (!isNaN(parsedEnd)) {
      endCutoff = parsedEnd;
    }
  }

  const effectiveMediaPerPost = Math.max(1, mediaPerPost || 1);
  const descriptionsList = loopDescriptions && loopDescriptions.length > 0
    ? loopDescriptions
    : ['Default loop post description'];

  let postIndex = 0;
  let isLoopCompleted = false;

  while (availableMedia.length >= effectiveMediaPerPost) {
    // Check end date cutoff
    if (endCutoff && currentCursor.getTime() > endCutoff) {
      break;
    }

    // Pick effectiveMediaPerPost RANDOM media items from available pool without repetition
    const selectedMediaForPost: string[] = [];
    for (let m = 0; m < effectiveMediaPerPost; m++) {
      if (availableMedia.length === 0) break;
      const randomIndex = Math.floor(Math.random() * availableMedia.length);
      const chosenUri = availableMedia[randomIndex];
      selectedMediaForPost.push(chosenUri);
      updatedUsed.push(chosenUri);
      usedSet.add(chosenUri);
      availableMedia.splice(randomIndex, 1);
    }

    if (selectedMediaForPost.length === 0) break;

    // Pick 1 RANDOM description from loopDescriptions
    const randomDescIndex = Math.floor(Math.random() * descriptionsList.length);
    const caption = descriptionsList[randomDescIndex];

    const extractedTags = caption.match(/#\w+/g) || [];
    const extractedMentions = caption.match(/@\w+/g) || [];

    const newPost: Post = {
      id: `post_loop_${container.id}_${Date.now()}_${postIndex}`,
      campaignId: container.id,
      caption,
      images: selectedMediaForPost,
      videos: [],
      platforms: platforms && platforms.length > 0 ? platforms : ['facebook', 'instagram'],
      scheduledAt: currentCursor.toISOString(),
      status: 'scheduled',
      notes: `Generated via Loop Container (Round ${container.currentLoopRound || 1})`,
      failureReason: null,
      uploadProgress: 0,
      tags: extractedTags,
      hashtags: extractedTags,
      mentions: extractedMentions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    generatedPosts.push(newPost);
    postIndex++;

    // Advance scheduling cursor by intervalMinutes
    currentCursor = new Date(currentCursor.getTime() + (intervalMinutes || 60) * 60 * 1000);
  }

  // Check if remaining available media is less than mediaPerPost
  if (availableMedia.length < effectiveMediaPerPost) {
    isLoopCompleted = true;
  }

  return {
    newPosts: generatedPosts,
    updatedUsedMediaUris: updatedUsed,
    isLoopCompleted,
  };
}
