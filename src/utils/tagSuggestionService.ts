export interface TagCategory {
  id: string;
  name: string;
  icon: string;
  hashtags: string[];
  mentions: string[];
}

export const CATEGORY_TAG_PRESETS: Record<string, TagCategory> = {
  general: {
    id: 'general',
    name: '🔥 Trending',
    icon: 'Flame',
    hashtags: ['#viral', '#trending', '#explorepage', '#content', '#foryou', '#instagood', '#reels', '#growth'],
    mentions: ['@facebook', '@instagram', '@meta', '@creators', '@socialmedia'],
  },
  marketing: {
    id: 'marketing',
    name: '📈 Business & Sales',
    icon: 'TrendingUp',
    hashtags: ['#marketing', '#digitalmarketing', '#socialmediamarketing', '#business', '#branding', '#entrepreneur', '#sales', '#startup'],
    mentions: ['@marketingprofs', '@hubspot', '@hootsuite', '@metaforbusiness', '@forbes'],
  },
  tech: {
    id: 'tech',
    name: '🚀 Tech & AI',
    icon: 'Cpu',
    hashtags: ['#tech', '#innovation', '#ai', '#software', '#coding', '#future', '#developer', '#automation', '#nextgen'],
    mentions: ['@techcrunch', '@wired', '@theverge', '@producthunt', '@github', '@openai'],
  },
  photography: {
    id: 'photography',
    name: '📸 Photo & Video',
    icon: 'Camera',
    hashtags: ['#photooftheday', '#photography', '#visualart', '#portrait', '#nature', '#streetphotography', '#cinematic', '#reelsvideo'],
    mentions: ['@natgeo', '@canon', '@sony', '@adobe', '@unsplash', '@vimeo'],
  },
  fitness: {
    id: 'fitness',
    name: '🏋️ Fitness & Health',
    icon: 'Activity',
    hashtags: ['#fitness', '#workout', '#gym', '#health', '#motivation', '#fitlife', '#bodybuilding', '#wellness'],
    mentions: ['@nike', '@gymshark', '@underarmour', '@menshealth', '@crossfit'],
  },
  fashion: {
    id: 'fashion',
    name: '👗 Fashion & Style',
    icon: 'Sparkles',
    hashtags: ['#fashion', '#style', '#outfit', '#ootd', '#streetwear', '#model', '#beauty', '#lookbook'],
    mentions: ['@vogue', '@zara', '@gq', '@highsnobiety', '@elle'],
  },
  food: {
    id: 'food',
    name: '🍔 Food & Lifestyle',
    icon: 'Utensils',
    hashtags: ['#foodie', '#instafood', '#delicious', '#yummy', '#recipe', '#chef', '#foodphotography', '#gourmet'],
    mentions: ['@tasty', '@foodnetwork', '@eater', '@bonappetit'],
  },
};

/**
 * Extracts hashtags from caption text safely
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_\u0590-\u05ff]+/g) || [];
  return Array.from(new Set(matches));
}

/**
 * Extracts mentions from caption text safely
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@[a-zA-Z0-9_\u0590-\u05ff.]+/g) || [];
  return Array.from(new Set(matches));
}

/**
 * Smart suggestion generator based on current caption text and category
 */
export function getSmartSuggestions(text: string, categoryId: string = 'general'): {
  hashtags: string[];
  mentions: string[];
} {
  const lowerText = text ? text.toLowerCase() : '';
  const currentTags = extractHashtags(text);
  const currentMentions = extractMentions(text);

  const suggestedTags = new Set<string>();
  const suggestedMentions = new Set<string>();

  // Add active category preset
  const categoryPreset = CATEGORY_TAG_PRESETS[categoryId] || CATEGORY_TAG_PRESETS.general;
  categoryPreset.hashtags.forEach((tag) => suggestedTags.add(tag));
  categoryPreset.mentions.forEach((men) => suggestedMentions.add(men));

  // Keyword-based dynamic suggestions
  if (lowerText.includes('market') || lowerText.includes('business') || lowerText.includes('sell') || lowerText.includes('deal') || lowerText.includes('sale')) {
    CATEGORY_TAG_PRESETS.marketing.hashtags.forEach((t) => suggestedTags.add(t));
    CATEGORY_TAG_PRESETS.marketing.mentions.forEach((m) => suggestedMentions.add(m));
  }
  if (lowerText.includes('photo') || lowerText.includes('picture') || lowerText.includes('shot') || lowerText.includes('camera') || lowerText.includes('video')) {
    CATEGORY_TAG_PRESETS.photography.hashtags.forEach((t) => suggestedTags.add(t));
  }
  if (lowerText.includes('code') || lowerText.includes('tech') || lowerText.includes('app') || lowerText.includes('ai') || lowerText.includes('software')) {
    CATEGORY_TAG_PRESETS.tech.hashtags.forEach((t) => suggestedTags.add(t));
    CATEGORY_TAG_PRESETS.tech.mentions.forEach((m) => suggestedMentions.add(m));
  }

  // Filter out tags/mentions already in description
  const hashtags = Array.from(suggestedTags).filter((t) => !currentTags.includes(t));
  const mentions = Array.from(suggestedMentions).filter((m) => !currentMentions.includes(m));

  return { hashtags, mentions };
}

/**
 * Cleanly appends tag or mention to text without double spacing or collision
 */
export function appendTagToText(currentText: string, tagOrMention: string): string {
  if (!currentText || currentText.trim() === '') {
    return tagOrMention;
  }
  const trimmed = currentText.trimEnd();
  if (trimmed.endsWith(tagOrMention) || trimmed.includes(` ${tagOrMention} `) || trimmed.includes(`\n${tagOrMention}`)) {
    return currentText;
  }
  return `${trimmed} ${tagOrMention}`;
}
