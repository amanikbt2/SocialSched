import { Container, Post, SkipTimeRange, SocialPlatform } from '../db/types';
import { extractHashtags, extractMentions } from '../utils/tagSuggestionService';
import { processSmartFirstComment } from '../utils/tagProcessor';

export interface LoopGenerationParams {
  container: Container;
  loopDescriptions: string[];
  loopMediaPool: string[];
  usedMediaUris: string[];
  mediaPerPost: number;
  startDate: string; // ISO date or YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;  // ISO date or YYYY-MM-DD
  endTime?: string;  // HH:mm for exact hard cutoff time
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
    endTime,
    intervalMinutes,
    platforms,
  } = params;

  const usedSet = new Set<string>(initialUsed || []);
  let availableMedia = (loopMediaPool || []).filter((uri) => !usedSet.has(uri));

  // Ensure availableMedia is never empty if loopMediaPool has items
  if (
    availableMedia.length < Math.max(1, mediaPerPost || 1) &&
    (loopMediaPool || []).length > 0
  ) {
    usedSet.clear();
    availableMedia = [...(loopMediaPool || [])];
  }
  
  const generatedPosts: Post[] = [];
  const cleanIntervalMinutes = Math.max(1, Number(intervalMinutes) || 60);

  // Helper to parse start timestamp
  const [startH, startM] = (startTime || '09:00').split(':').map(Number);
  
  // Normalize startDate (e.g. YYYY-MM-DD)
  let baseDateStr = startDate || new Date().toISOString().split('T')[0];
  if (baseDateStr.includes('T')) {
    baseDateStr = baseDateStr.split('T')[0];
  }

  const parsedStart = Date.parse(
    `${baseDateStr}T${String(startH || 9).padStart(2, '0')}:${String(startM || 0).padStart(2, '0')}:00`
  );
  let baseTimestamp = isNaN(parsedStart) ? Date.now() + 15 * 60000 : parsedStart;
  if (baseTimestamp <= Date.now() + 10 * 60000) {
    baseTimestamp = Date.now() + 15 * 60000;
  }

  let currentCursor = new Date(baseTimestamp);

  let endCutoff: number | null = null;
  if (endDate && endDate.trim() !== '') {
    let cleanEndDate = endDate.trim();
    if (cleanEndDate.includes('T')) {
      cleanEndDate = cleanEndDate.split('T')[0];
    }
    const cleanEndTime = endTime && endTime.trim() !== '' ? endTime.trim() : '23:59';
    const parsedEnd = Date.parse(`${cleanEndDate}T${cleanEndTime}:00`);
    if (!isNaN(parsedEnd)) {
      endCutoff = parsedEnd;
    }
  }

  const effectiveMediaPerPost = Math.max(1, mediaPerPost || 1);
  const descriptionsList = loopDescriptions && loopDescriptions.length > 0
    ? loopDescriptions
    : ['Default loop post description'];

  // Tracking available unused descriptions for non-repeating random selection
  let availableDescriptions = [...descriptionsList];

  let postIndex = 0;
  let isLoopCompleted = false;
  const updatedUsedMediaUris: string[] = [...(initialUsed || [])];
  const autoNextRound = container?.autoNextRound !== false;
  const skipTimeRanges: SkipTimeRange[] = container?.skipTimeRanges || [];

  while (true) {
    if (availableMedia.length < effectiveMediaPerPost) {
      if (autoNextRound && (loopMediaPool || []).length >= effectiveMediaPerPost) {
        usedSet.clear();
        availableMedia = [...(loopMediaPool || [])];
      } else {
        isLoopCompleted = true;
        break;
      }
    }

    // Check end date cutoff
    if (endCutoff && currentCursor.getTime() > endCutoff) {
      break;
    }

    // Check if currentCursor falls inside ANY active Skip Time range
    let isInsideSkipRange = false;
    for (const range of skipTimeRanges) {
      if (range.isRecurring) {
        // Daily recurring range (no date specified)
        const [startH, startM] = range.startTime.split(':').map(Number);
        const [endH, endM] = range.endTime.split(':').map(Number);

        const cursorH = currentCursor.getHours();
        const cursorM = currentCursor.getMinutes();

        const cursorMins = cursorH * 60 + cursorM;
        const startMins = (startH ?? 0) * 60 + (startM ?? 0);
        const endMins = (endH ?? 0) * 60 + (endM ?? 0);

        let inside = false;
        if (startMins < endMins) {
          inside = cursorMins >= startMins && cursorMins < endMins;
        } else {
          inside = cursorMins >= startMins || cursorMins < endMins;
        }

        if (inside) {
          // Advance cursor to end of daily range
          const endD = new Date(currentCursor.getTime());
          if (startMins >= endMins && cursorMins >= startMins) {
            // Spans midnight and cursor is on the start day -> target is tomorrow's end time
            endD.setDate(endD.getDate() + 1);
          }
          endD.setHours(endH, endM, 0, 0);

          console.log(`⏩ [SkipTimeEngine] Skipping smart daily range (${range.startTime} to ${range.endTime}). Advancing cursor to ${endD.toLocaleString()}...`);
          currentCursor = endD;
          isInsideSkipRange = true;
          break;
        }
      } else {
        // Standard Manual range (specific date and time)
        const sStart = Date.parse(`${range.startDate}T${range.startTime}:00`);
        const sEnd = Date.parse(`${range.endDate}T${range.endTime}:00`);
        if (!isNaN(sStart) && !isNaN(sEnd) && sStart < sEnd) {
          if (currentCursor.getTime() >= sStart && currentCursor.getTime() < sEnd) {
            console.log(`⏩ [SkipTimeEngine] Skipping range (${range.startDate} ${range.startTime} to ${range.endDate} ${range.endTime}). Advancing cursor to ${new Date(sEnd).toLocaleString()}...`);
            currentCursor = new Date(sEnd);
            isInsideSkipRange = true;
            break;
          }
        }
      }
    }
    if (isInsideSkipRange) {
      continue;
    }

    // Pick effectiveMediaPerPost RANDOM media items from available pool without repetition
    const selectedMediaForPost: string[] = [];
    for (let m = 0; m < effectiveMediaPerPost; m++) {
      if (availableMedia.length === 0) break;
      const randomIndex = Math.floor(Math.random() * availableMedia.length);
      const chosenUri = availableMedia[randomIndex];
      selectedMediaForPost.push(chosenUri);
      updatedUsedMediaUris.push(chosenUri);
      usedSet.add(chosenUri);
      availableMedia.splice(randomIndex, 1);
    }

    if (selectedMediaForPost.length === 0) break;

    // Refill available descriptions if all descriptions in pool have been used once
    if (availableDescriptions.length === 0) {
      availableDescriptions = [...descriptionsList];
    }

    // Pick 1 RANDOM description from availableDescriptions pool without repetition
    const randomDescIndex = Math.floor(Math.random() * availableDescriptions.length);
    const caption = availableDescriptions[randomDescIndex];
    availableDescriptions.splice(randomDescIndex, 1);

    const extractedTags = extractHashtags(caption);
    const extractedMentions = extractMentions(caption);

    let firstComment: string | undefined = undefined;
    if (container.enableFirstComment && container.firstComment) {
      firstComment = processSmartFirstComment(container.firstComment, {
        title: container.title,
        caption: caption,
        hashtags: extractedTags,
        round: container.currentLoopRound || 1,
        scheduledAt: currentCursor.toISOString(),
      });
    }

    // Assemble final image list: prepend startMediaUri, append endMediaUri if set
    const finalImages: string[] = [];
    if (container.startMediaUri) {
      finalImages.push(container.startMediaUri);
    }
    finalImages.push(...selectedMediaForPost);
    if (container.endMediaUri) {
      finalImages.push(container.endMediaUri);
    }

    const newPost: Post = {
      id: `post_loop_${container.id}_${Date.now()}_${postIndex}`,
      campaignId: container.id,
      caption,
      firstComment,
      images: finalImages,
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

    // Safety cap to prevent memory overflow (up to 100 posts generated per batch)
    if (generatedPosts.length >= 100) {
      break;
    }

    // Advance scheduling cursor by intervalMinutes (cleanIntervalMinutes * 60 * 1000 milliseconds)
    currentCursor = new Date(currentCursor.getTime() + cleanIntervalMinutes * 60 * 1000);
  }

  // Check if remaining available media is less than mediaPerPost
  if (availableMedia.length < effectiveMediaPerPost) {
    isLoopCompleted = true;
  }

  return {
    newPosts: generatedPosts,
    updatedUsedMediaUris,
    isLoopCompleted,
  };
}
