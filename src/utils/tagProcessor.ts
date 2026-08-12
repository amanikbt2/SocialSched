export interface TagProcessorContext {
  title?: string;
  caption?: string;
  hashtags?: string[];
  round?: number;
  scheduledAt?: string;
}

/**
 * Replaces smart placeholders in a first comment template string:
 * - {title} -> Container title
 * - {hashtags} or {tags} -> Space-separated hashtags extracted from caption
 * - {round} -> Current loop round number
 * - {date} -> Scheduled date (YYYY-MM-DD)
 * - {time} -> Scheduled time (HH:mm)
 */
export function processSmartFirstComment(
  template: string,
  context: TagProcessorContext
): string {
  if (!template || template.trim() === '') return '';

  let result = template;

  // Extract hashtags if not explicitly provided
  let hashtagsList = context.hashtags;
  if (!hashtagsList && context.caption) {
    hashtagsList = context.caption.match(/#\w+/g) || [];
  }
  const hashtagsStr = hashtagsList && hashtagsList.length > 0 ? hashtagsList.join(' ') : '';

  // Process scheduled date and time
  let dateStr = '';
  let timeStr = '';
  if (context.scheduledAt) {
    try {
      const d = new Date(context.scheduledAt);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
        timeStr = d.toTimeString().slice(0, 5);
      }
    } catch (e) {}
  }

  const titleStr = context.title || '';
  const roundStr = context.round ? String(context.round) : '1';

  result = result.replace(/\{title\}/gi, titleStr);
  result = result.replace(/\{hashtags\}/gi, hashtagsStr);
  result = result.replace(/\{tags\}/gi, hashtagsStr);
  result = result.replace(/\{round\}/gi, roundStr);
  result = result.replace(/\{date\}/gi, dateStr);
  result = result.replace(/\{time\}/gi, timeStr);

  return result.trim();
}
