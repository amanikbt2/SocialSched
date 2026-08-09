import { MagicDistributeConfig, Post } from '../db/types';

export interface DistributePreviewItem {
  postId: string;
  postCaption: string;
  originalScheduledAt: string;
  newScheduledAt: string;
  dayName: string;
  formattedTime: string;
}

export function generateMagicSchedule(
  posts: Post[],
  config: MagicDistributeConfig
): DistributePreviewItem[] {
  // Only target unscheduled, draft, or queued posts in the campaign
  const campaignPosts = posts.filter(
    (p) => p.campaignId === config.campaignId && (p.status === 'draft' || p.status === 'scheduled' || p.status === 'waiting')
  );

  if (campaignPosts.length === 0) return [];

  const preview: DistributePreviewItem[] = [];
  const [startHour, startMinute] = config.startTime.split(':').map(Number);
  
  let currentCursor = new Date(config.startDate);
  currentCursor.setHours(startHour, startMinute, 0, 0);

  const [bStartH, bStartM] = config.blackoutStart.split(':').map(Number);
  const [bEndH, bEndM] = config.blackoutEnd.split(':').map(Number);

  let dailyCountMap: Record<string, number> = {};

  for (let i = 0; i < campaignPosts.length; i++) {
    const post = campaignPosts[i];
    let candidate = new Date(currentCursor.getTime());

    // Advance candidate until valid according to days, blackout, and daily max
    let attempts = 0;
    while (attempts < 500) {
      attempts++;
      const dayOfWeek = candidate.getDay(); // 0=Sun, 1=Mon...
      const dateKey = candidate.toISOString().split('T')[0];

      // Check Weekend Skip
      if (config.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        // Advance to next day at start time
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(startHour, startMinute, 0, 0);
        continue;
      }

      // Check Selected Days filter
      if (config.selectedDays.length > 0 && !config.selectedDays.includes(dayOfWeek)) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(startHour, startMinute, 0, 0);
        continue;
      }

      // Check Blackout Hours (e.g. 00:00 to 06:00)
      const currentH = candidate.getHours();
      const currentM = candidate.getMinutes();
      const timeInMins = currentH * 60 + currentM;
      const bStartInMins = bStartH * 60 + bStartM;
      const bEndInMins = bEndH * 60 + bEndM;

      let inBlackout = false;
      if (bStartInMins < bEndInMins) {
        inBlackout = timeInMins >= bStartInMins && timeInMins < bEndInMins;
      } else if (bStartInMins > bEndInMins) {
        // Overnight blackout e.g. 23:00 to 06:00
        inBlackout = timeInMins >= bStartInMins || timeInMins < bEndInMins;
      }

      if (inBlackout) {
        // Skip past blackout end time
        candidate.setHours(bEndH, bEndM, 0, 0);
        if (candidate.getTime() <= currentCursor.getTime()) {
          candidate.setDate(candidate.getDate() + 1);
        }
        continue;
      }

      // Check Max Posts Per Day
      const currentDaily = dailyCountMap[dateKey] || 0;
      if (config.maxPostsPerDay > 0 && currentDaily >= config.maxPostsPerDay) {
        // Advance to next day
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(startHour, startMinute, 0, 0);
        continue;
      }

      // Valid slot found!
      break;
    }

    const dateKey = candidate.toISOString().split('T')[0];
    dailyCountMap[dateKey] = (dailyCountMap[dateKey] || 0) + 1;

    const dayName = candidate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const formattedTime = candidate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    preview.push({
      postId: post.id,
      postCaption: post.caption,
      originalScheduledAt: post.scheduledAt,
      newScheduledAt: candidate.toISOString(),
      dayName,
      formattedTime,
    });

    // Advance cursor for next post based on interval & random variance
    let deltaMins = config.intervalMinutes;
    if (config.allowRandomVariance && config.varianceMax > config.varianceMin) {
      deltaMins = Math.floor(Math.random() * (config.varianceMax - config.varianceMin + 1)) + config.varianceMin;
    }

    currentCursor = new Date(candidate.getTime() + deltaMins * 60 * 1000);
  }

  return preview;
}
