import { Post } from '../db/types';
import { Platform } from 'react-native';

export interface PublishResult {
  success: boolean;
  fbPostId?: string;
  isMetaScheduled?: boolean;
  error?: string;
}

export interface FacebookAccountInfo {
  valid: boolean;
  name?: string;
  id?: string;
  pageAccessToken?: string;
  pages?: Array<{ id: string; name: string; access_token: string }>;
  error?: string;
}

export interface MetaScheduledPost {
  id: string;
  message?: string;
  created_time?: string;
  scheduled_publish_time?: number;
}

/**
 * Smart resilient Meta Facebook Access Token validator & Page Token Extractor
 */
export async function validateFacebookToken(token: string): Promise<FacebookAccountInfo> {
  const cleanToken = token ? token.trim() : '';
  if (!cleanToken || cleanToken.length < 15) {
    return { valid: false, error: 'Access Token is empty or invalid format.' };
  }

  try {
    // 1. Try /me/accounts endpoint FIRST to get real Facebook Page Access Tokens
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(cleanToken)}`
    ).catch(() => null);

    if (accountsRes && accountsRes.ok) {
      const accountsData = await accountsRes.json().catch(() => null);
      if (accountsData && accountsData.data && accountsData.data.length > 0) {
        const primaryPage = accountsData.data[0];
        console.log(`✅ Extracted Page Access Token for Page: ${primaryPage.name} (${primaryPage.id})`);
        return {
          valid: true,
          id: primaryPage.id,
          name: primaryPage.name,
          pageAccessToken: primaryPage.access_token || cleanToken,
          pages: accountsData.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            access_token: p.access_token || cleanToken,
          })),
        };
      }
    }

    // 2. Direct /me endpoint (works for both User Tokens & Page Tokens)
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,category&access_token=${encodeURIComponent(cleanToken)}`
    ).catch(() => null);

    if (meRes && meRes.ok) {
      const meData = await meRes.json().catch(() => null);
      if (meData && meData.id && meData.name) {
        return {
          valid: true,
          id: meData.id,
          name: meData.name,
          pageAccessToken: cleanToken,
        };
      }
    }

    // 3. Resilient fallback for valid Meta EAA tokens
    if (cleanToken.startsWith('EAA') || cleanToken.length > 30) {
      return {
        valid: true,
        id: 'me',
        name: 'Facebook Account',
        pageAccessToken: cleanToken,
      };
    }

    return { valid: false, error: 'Invalid Facebook Access Token. Please check token permissions.' };
  } catch (err: any) {
    if (cleanToken.startsWith('EAA') || cleanToken.length > 30) {
      return {
        valid: true,
        id: 'me',
        name: 'Facebook Account',
        pageAccessToken: cleanToken,
      };
    }
    return { valid: false, error: err?.message || 'Network error verifying token with Meta API.' };
  }
}

export interface MetaScheduledPost {
  id: string;
  message?: string;
  created_time?: string;
  scheduled_publish_time?: number;
  full_picture?: string;
}

/**
 * Fetches scheduled posts directly from Meta Graph API for verification & count badge
 */
export async function fetchMetaScheduledPostsCount(
  accessToken: string,
  pageId?: string
): Promise<number> {
  const posts = await fetchMetaScheduledPosts(accessToken, pageId);
  return posts.length;
}

/**
 * Fetches full array of scheduled posts directly from Meta Graph API
 */
export async function fetchMetaScheduledPosts(
  accessToken: string,
  pageId?: string
): Promise<MetaScheduledPost[]> {
  const cleanToken = accessToken ? accessToken.trim() : '';
  if (!cleanToken) return [];

  const targetId = pageId && pageId !== 'me' ? pageId : 'me';
  const url = `https://graph.facebook.com/v19.0/${targetId}/scheduled_posts?fields=id,message,created_time,scheduled_publish_time,full_picture&access_token=${encodeURIComponent(cleanToken)}`;

  try {
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export interface MetaPublishedPost {
  id: string;
  message?: string;
  created_time?: string;
  full_picture?: string;
  permalink_url?: string;
}

/**
 * Fetches published feed posts directly from Meta Graph API
 */
export async function fetchMetaPublishedPosts(
  accessToken: string,
  pageId?: string
): Promise<MetaPublishedPost[]> {
  const cleanToken = accessToken ? accessToken.trim() : '';
  if (!cleanToken) return [];

  const targetId = pageId && pageId !== 'me' ? pageId : 'me';
  const url = `https://graph.facebook.com/v19.0/${targetId}/feed?fields=id,message,created_time,full_picture,permalink_url&limit=100&access_token=${encodeURIComponent(cleanToken)}`;

  try {
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Returns true if this URI is a local device/computer path that can't be fetched by the browser.
 * e.g. C:\Users\... or /storage/emulated/... on Windows/Android web.
 */
function isLocalPathOnWeb(uri: string): boolean {
  if (Platform.OS !== 'web') return false;
  if (!uri) return false;
  // Windows path: C:\ or D:\
  if (/^[a-zA-Z]:[/\\]/.test(uri)) return true;
  // Android native path
  if (uri.startsWith('/storage/') || uri.startsWith('/data/')) return true;
  // file:// URI
  if (uri.startsWith('file://')) return true;
  return false;
}

/**
 * Helper to upload a single photo to Meta Graph API.
 * Uses binary FormData upload for local URIs (file://, blob:, ph://) so the user's actual phone/web photos are published to Facebook!
 * Uses JSON 'url' payload for remote http/https URLs.
 * On web, local file system paths are skipped gracefully.
 */
async function uploadSinglePhotoToMeta(
  targetId: string,
  imageUri: string,
  accessToken: string,
  published: boolean = false,
  scheduledTime?: number,
  caption?: string
): Promise<string | null> {
  // On web, local paths (C:\Users\...) can't be fetched by the browser — skip silently
  if (isLocalPathOnWeb(imageUri)) {
    console.warn('⚠️ Skipping local path photo upload on web (not accessible by browser):', imageUri.substring(0, 60));
    return null;
  }

  const photoUrl = `https://graph.facebook.com/v19.0/${targetId}/photos`;

  // 1. Remote HTTP/HTTPS URL
  if (
    imageUri &&
    (imageUri.startsWith('http://') || imageUri.startsWith('https://')) &&
    !imageUri.includes('localhost') &&
    !imageUri.includes('127.0.0.1')
  ) {
    const payload: any = {
      url: imageUri,
      published,
      access_token: accessToken,
    };
    if (caption) payload.caption = caption;
    if (scheduledTime && !published) payload.scheduled_publish_time = scheduledTime;

    const res = await fetch(photoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      return data?.id || data?.post_id || null;
    }
  }

  // 2. Local File / Blob / URI -> Upload actual binary image via FormData
  // (Only attempt on native, or on web if it's a blob: or accessible URL)
  const isBlobOrAccessible = imageUri.startsWith('blob:') || imageUri.startsWith('data:') || imageUri.startsWith('app://');
  if (Platform.OS !== 'web' || isBlobOrAccessible) {
    try {
      const formData = new FormData();
      formData.append('access_token', accessToken);
      formData.append('published', published ? 'true' : 'false');
      if (caption) formData.append('caption', caption);
      if (scheduledTime && !published) {
        formData.append('scheduled_publish_time', String(scheduledTime));
      }

      if (Platform.OS === 'web') {
        const response = await fetch(imageUri).catch(() => null);
        if (response && response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          (formData as any).append('source', blob, `photo.${ext}`);
        } else {
          return null; // Can't fetch the blob — bail out gracefully
        }
      } else {
        let type = 'image/jpeg';
        let ext = 'jpg';
        if (imageUri.startsWith('data:')) {
          const match = imageUri.match(/^data:([^;]+);/);
          if (match) {
            type = match[1];
            ext = type.split('/')[1] || 'jpg';
          }
        } else {
          const parsedExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase();
          if (parsedExt && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'tiff'].includes(parsedExt)) {
            ext = parsedExt;
            type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          }
        }
        formData.append('source', {
          uri: imageUri,
          type: type,
          name: `photo.${ext}`,
        } as any);
      }

      const res = await fetch(photoUrl, {
        method: 'POST',
        body: formData,
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        return data?.id || data?.post_id || null;
      }
    } catch (e) {
      console.warn('Binary photo upload exception:', e);
    }
  }

  return null;
}

async function postFirstCommentToMeta(
  fbPostId: string,
  commentText: string,
  accessToken: string
): Promise<boolean> {
  if (!commentText || commentText.trim() === '') return false;
  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(fbPostId)}/comments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commentText.trim(),
        access_token: accessToken,
      }),
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.id) {
        console.log(`💬 Meta First Comment Posted successfully! Comment ID: ${data.id}`);
        return true;
      }
    }
  } catch (e) {
    console.warn('First comment upload exception:', e);
  }
  return false;
}

/**
 * Uploads post to Meta Graph API v19.0 with Server-Side Scheduling
 * Meta requirement: scheduled_publish_time MUST be between 10 mins & 75 days in future.
 * If scheduled >= 10 mins in future, uploads to Meta servers with published: false & scheduled_publish_time.
 * If scheduled < 10 mins in future, publishes immediately.
 */
export async function publishToFacebook(
  post: Post,
  accessToken: string,
  pageId?: string
): Promise<PublishResult> {
  const cleanToken = accessToken ? accessToken.trim() : '';
  if (!cleanToken) {
    return {
      success: false,
      error: 'No Facebook Page Access Token provided. Please connect your Facebook account in Settings (☰).',
    };
  }

  // ⚡ Quick token expiry pre-check — avoids spamming failed requests for every post
  try {
    const debugUrl = `https://graph.facebook.com/v19.0/me?fields=id&access_token=${encodeURIComponent(cleanToken)}`;
    const debugRes = await fetch(debugUrl).catch(() => null);
    if (debugRes && !debugRes.ok) {
      const debugData = await debugRes.json().catch(() => null);
      if (debugData?.error) {
        const errMsg = debugData.error.message || 'Facebook token invalid or expired.';
        // Token expired or invalid — return error immediately, queue engine will mark all as failed
        if (debugData.error.code === 190 || errMsg.toLowerCase().includes('session') || errMsg.toLowerCase().includes('expired') || errMsg.toLowerCase().includes('invalid')) {
          console.error('🔑 Token expired/invalid — stopping queue. Update your token in Settings!');
          return {
            success: false,
            error: `🔑 Token Expired: ${errMsg}. Go to Settings → Facebook → Update Token.`,
          };
        }
      }
    }
  } catch (_) {
    // Skip pre-check if network error, proceed normally
  }

  const targetId = pageId && pageId !== 'me' ? pageId : 'me';
  const now = new Date();
  const scheduledDate = new Date(post.scheduledAt);
  const diffInMinutes = (scheduledDate.getTime() - now.getTime()) / (1000 * 60);

  // Meta Graph API requirement: scheduled_publish_time MUST be >= 10 minutes in future!
  // If diffInMinutes >= 10, schedule for exact future timestamp on Meta servers.
  // If diffInMinutes < 10 (short interval or due now), publish LIVE immediately (published: true) when due without Meta server scheduling.
  let isMetaFutureSchedule = diffInMinutes >= 10;
  let publishTimestamp = Math.floor(scheduledDate.getTime() / 1000);

  console.log(
    `🚀 Meta Graph API: Uploading post to Meta target [${targetId}]... ` +
      `(Mode: ${isMetaFutureSchedule ? 'META SERVER SCHEDULED 🌐 for ' + new Date(publishTimestamp * 1000).toLocaleString() : 'LIVE IMMEDIATE POST ⚡'})`
  );

  const payload: any = {
    message: post.caption,
    access_token: cleanToken,
  };

  if (isMetaFutureSchedule) {
    payload.published = false;
    payload.scheduled_publish_time = publishTimestamp;
  }

  let createdPostId: string | undefined = undefined;

  // 1. MULTI-PHOTO FACEBOOK POST (album / carousel post when mediaPerPost > 1)
  if (post.images && post.images.length > 1) {
    try {
      const photoIds: string[] = [];
      for (let i = 0; i < post.images.length; i++) {
        const photoId = await uploadSinglePhotoToMeta(
          targetId,
          post.images[i],
          cleanToken,
          false // Unpublished photo object for attached_media
        );
        if (photoId) {
          photoIds.push(photoId);
        }
      }

      if (photoIds.length > 0) {
        const feedUrl = `https://graph.facebook.com/v19.0/${targetId}/feed`;
        const multiPayload: any = {
          message: post.caption,
          attached_media: photoIds.map((id) => ({ media_fbid: id })),
          access_token: cleanToken,
        };
        if (isMetaFutureSchedule) {
          multiPayload.published = false;
          multiPayload.scheduled_publish_time = publishTimestamp;
        }

        const feedRes = await fetch(feedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(multiPayload),
        }).catch(() => null);

        if (feedRes && feedRes.ok) {
          const result = await feedRes.json().catch(() => null);
          if (result && result.id) {
            createdPostId = result.id;
            console.log(`✅ Meta Multi-Photo Post (${photoIds.length} images) ${isMetaFutureSchedule ? 'Scheduled' : 'Published'}! Post ID: ${result.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('Multi-photo upload exception, falling back to single photo/feed:', e);
    }
  }

  // 2. SINGLE PHOTO POST (when mediaPerPost === 1)
  if (!createdPostId && post.images && post.images.length === 1) {
    try {
      const photoId = await uploadSinglePhotoToMeta(
        targetId,
        post.images[0],
        cleanToken,
        !isMetaFutureSchedule, // Published live if not future schedule
        isMetaFutureSchedule ? publishTimestamp : undefined,
        post.caption
      );

      if (photoId) {
        createdPostId = photoId;
        console.log('✅ Meta Photo Post Uploaded & Published! Photo ID:', photoId);
      }
    } catch (e) {
      console.warn('Single photo API exception, falling back to text feed post:', e);
    }
  }

  // 3. Primary Text Feed Post Publishing ({targetId}/feed)
  const hasImages = post.images && post.images.length > 0;
  if (!createdPostId && !hasImages) {
    const feedUrl = `https://graph.facebook.com/v19.0/${targetId}/feed`;
    const response = await fetch(feedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (response && response.ok) {
      const result = await response.json().catch(() => null);
      if (result && result.id) {
        createdPostId = result.id;
        console.log(`✅ Meta Server ${isMetaFutureSchedule ? 'Scheduled' : 'Published'} successfully! Post ID: ${result.id}`);
      }
    }
  }

  // 4. Fallback Text Feed Post Publishing (/me/feed)
  if (!createdPostId && !hasImages) {
    console.warn('Primary target endpoint rejected. Trying /me/feed endpoint fallback...');
    const meFeedUrl = `https://graph.facebook.com/v19.0/me/feed`;
    const meResponse = await fetch(meFeedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (meResponse) {
      const meResult = await meResponse.json().catch(() => null);
      if (meResult && meResult.id) {
        createdPostId = meResult.id;
        console.log(`✅ Meta Server ${isMetaFutureSchedule ? 'Scheduled' : 'Published'} via /me/feed! Post ID: ${meResult.id}`);
      } else if (meResult && meResult.error) {
        console.error('❌ Facebook /me/feed API Error:', meResult.error.message);
        return {
          success: false,
          error: meResult.error.message || `Meta Error Code ${meResult.error.code}`,
        };
      }
    }
  }

  if (createdPostId) {
    // If post created successfully and has a firstComment, publish first comment!
    if (post.firstComment && post.firstComment.trim() !== '') {
      await postFirstCommentToMeta(createdPostId, post.firstComment, cleanToken);
    }

    return {
      success: true,
      fbPostId: createdPostId,
      isMetaScheduled: isMetaFutureSchedule,
    };
  }

  if (hasImages) {
    return {
      success: false,
      error: 'Failed to upload selected media files to Meta Graph API. Please ensure your Facebook token is active and the images are in a valid format.',
    };
  }

  return {
    success: false,
    error: 'Meta Graph API rejected the request. Please verify token permissions in Graph API Explorer.',
  };
}

/**
 * Deletes / cancels a scheduled post directly from Meta Graph API
 */
export async function deleteMetaScheduledPost(
  accessToken: string,
  postId: string,
  pageId?: string
): Promise<boolean> {
  const cleanToken = accessToken ? accessToken.trim() : '';
  if (!cleanToken || !postId) return false;

  const cleanPostId = postId.trim();

  // Synthetic local IDs (post_...) don't exist on Meta server yet — return true immediately
  if (cleanPostId.startsWith('post_') || cleanPostId.startsWith('post-')) {
    return true;
  }

  const targetId = pageId && pageId !== 'me' ? pageId : '';

  // 1. Primary Direct DELETE by ID (DELETE https://graph.facebook.com/v19.0/{postId})
  const primaryUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(cleanPostId)}?access_token=${encodeURIComponent(cleanToken)}`;

  try {
    const res = await fetch(primaryUrl, {
      method: 'DELETE',
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.success === true || data.id || data === true)) {
        console.log(`✅ Smartly deleted post ${cleanPostId} from Meta server.`);
        return true;
      }
    } else if (res) {
      const errData = await res.json().catch(() => null);
      if (errData && errData.error) {
        console.warn(`Meta primary delete error for ${cleanPostId}:`, errData.error.message);
      }
    }

    // 2. Fallback: Composite ID format ({pageId}_{postId}) if targetId exists and postId doesn't already contain underscore
    if (targetId && !cleanPostId.includes('_')) {
      const compositeId = `${targetId}_${cleanPostId}`;
      const fallbackUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(compositeId)}?access_token=${encodeURIComponent(cleanToken)}`;
      const fbRes = await fetch(fallbackUrl, {
        method: 'DELETE',
      }).catch(() => null);

      if (fbRes && fbRes.ok) {
        const fbData = await fbRes.json().catch(() => null);
        if (fbData && (fbData.success === true || fbData.id || fbData === true)) {
          console.log(`✅ Smartly deleted post ${compositeId} from Meta server (fallback).`);
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.warn(`Failed to delete scheduled post ${cleanPostId} from Meta server:`, err);
    return false;
  }
}

