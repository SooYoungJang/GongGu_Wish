// ============================================================================
// Edge Function: hiker-lookup
// Purpose: Instagram post metadata lookup via HikerAPI
//
// Takes an Instagram post URL and returns post metadata (image, caption,
// like count, username, taken-at date). Requires HIKER_API_KEY to be configured
// as a Supabase secret.
//
// Deploy: supabase functions deploy hiker-lookup
// Invoke: POST /functions/v1/hiker-lookup  { "url": "https://www.instagram.com/p/..." }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LookupRequest {
  url: string;
}

interface InstagramMediaInfo {
  imageUrl: string | null;
  /** Best image for thumbnail (first carousel image or cover) */
  thumbnailUrl: string | null;
  /** Primary video URL if the post is a video/reel */
  videoUrl: string | null;
  /** All media URLs from carousel (images + videos) in post order */
  mediaUrls: string[];
  /** Dominant media type: IMAGE or VIDEO */
  mediaType: 'IMAGE' | 'VIDEO' | null;
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  takenAt: string | null;
}

interface ErrorResponse {
  error: string;
}

// ─── HikerAPI Client ─────────────────────────────────────────────────────────

function firstItem(value: unknown): Record<string, unknown> {
  const data = value as Record<string, unknown>;
  const mediaOrAd = data?.media_or_ad;
  if (mediaOrAd && typeof mediaOrAd === 'object') {
    return mediaOrAd as Record<string, unknown>;
  }

  const items = data?.items;
  if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
    return items[0] as Record<string, unknown>;
  }

  const nestedData = data?.data;
  if (Array.isArray(nestedData) && nestedData[0] && typeof nestedData[0] === 'object') {
    return nestedData[0] as Record<string, unknown>;
  }
  if (nestedData && typeof nestedData === 'object') {
    const nestedMediaOrAd = (nestedData as Record<string, unknown>).media_or_ad;
    if (nestedMediaOrAd && typeof nestedMediaOrAd === 'object') {
      return nestedMediaOrAd as Record<string, unknown>;
    }

    const nestedItems = (nestedData as Record<string, unknown>).items;
    if (Array.isArray(nestedItems) && nestedItems[0] && typeof nestedItems[0] === 'object') {
      return nestedItems[0] as Record<string, unknown>;
    }
    return nestedData as Record<string, unknown>;
  }

  return data;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bestImageUrl(media: Record<string, unknown>): string | null {
  const imageVersions = getRecord(media.image_versions2);
  const candidates = imageVersions?.candidates;
  if (Array.isArray(candidates)) {
    const best = candidates
      .filter((candidate): candidate is Record<string, unknown> =>
        Boolean(candidate && typeof candidate === 'object'),
      )
      .sort((a, b) =>
        ((getNumber(b.width) ?? 0) * (getNumber(b.height) ?? 0)) -
        ((getNumber(a.width) ?? 0) * (getNumber(a.height) ?? 0)),
      )[0];
    const url = getString(best?.url);
    if (url) return url;
  }

  const carousel = media.carousel_media;
  if (Array.isArray(carousel) && carousel[0] && typeof carousel[0] === 'object') {
    return bestImageUrl(carousel[0] as Record<string, unknown>);
  }

  const videoVersions = media.video_versions;
  if (Array.isArray(videoVersions) && videoVersions[0] && typeof videoVersions[0] === 'object') {
    const url = getString((videoVersions[0] as Record<string, unknown>).url);
    if (url) return url;
  }

  return getString(media.imageUrl) ?? getString(media.thumbnail_url) ?? getString(media.thumbnailUrl);
}

function bestVideoUrl(media: Record<string, unknown>): string | null {
  const videoVersions = media.video_versions;
  if (Array.isArray(videoVersions) && videoVersions[0] && typeof videoVersions[0] === 'object') {
    return getString((videoVersions[0] as Record<string, unknown>).url);
  }
  return null;
}

function isVideoMedia(media: Record<string, unknown>): boolean {
  return media.media_type === 2 || media.video_versions !== undefined;
}

function collectCarouselMedia(media: Record<string, unknown>): { urls: string[]; hasVideo: boolean } {
  const carousel = media.carousel_media;
  if (!Array.isArray(carousel)) {
    return { urls: [], hasVideo: false };
  }

  const urls: string[] = [];
  let hasVideo = false;

  for (const item of carousel) {
    if (!item || typeof item !== 'object') continue;
    const itemMedia = item as Record<string, unknown>;
    const videoUrl = bestVideoUrl(itemMedia);
    if (videoUrl) {
      urls.push(videoUrl);
      hasVideo = true;
    } else {
      const imageUrl = bestImageUrl(itemMedia);
      if (imageUrl) urls.push(imageUrl);
    }
  }

  return { urls, hasVideo };
}

async function lookupViaHikerAPI(url: string, apiKey: string): Promise<InstagramMediaInfo> {
  const requestUrl = new URL('https://api.hikerapi.com/v2/media/info/by/url');
  requestUrl.searchParams.set('url', url);

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-access-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HikerAPI error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const media = firstItem(data);
  const user = getRecord(media.user) ?? getRecord(media.owner) ?? getRecord(data?.user);
  const caption = getRecord(media.caption);
  const takenAt = media.taken_at ?? media.takenAt ?? null;

  return {
    imageUrl: bestImageUrl(media),
    thumbnailUrl: bestImageUrl(media),
    videoUrl: bestVideoUrl(media),
    mediaUrls: [],
    mediaType: null,
    caption: getString(caption?.text) ?? getString(media.caption_text) ?? getString(media.caption),
    likeCount: getNumber(media.like_count) ?? getNumber(media.likeCount),
    username: getString(user?.username) ?? getString(media.username),
    takenAt: typeof takenAt === 'number' ? new Date(takenAt * 1000).toISOString() : takenAt,
  };
}

// ─── CORS Headers ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Only POST
  if (req.method !== 'POST') {
    const error: ErrorResponse = { error: 'Method not allowed' };
    return new Response(JSON.stringify(error), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body: LookupRequest;
  try {
    body = await req.json() as LookupRequest;
  } catch {
    const error: ErrorResponse = { error: 'Invalid JSON body' };
    return new Response(JSON.stringify(error), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Validate URL
  if (!body.url || typeof body.url !== 'string') {
    const error: ErrorResponse = { error: 'url is required' };
    return new Response(JSON.stringify(error), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const hikerApiKey = Deno.env.get('HIKER_API_KEY') ?? '';

    if (!hikerApiKey) {
      const error: ErrorResponse = { error: 'HIKER_API_KEY is not configured' };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }


    const result = await lookupViaHikerAPI(body.url, hikerApiKey);

    // Collect all carousel media URLs into mediaUrls, and determine mediaType
    const carousel = collectCarouselMedia(result as unknown as Record<string, unknown>);
    if (carousel.urls.length > 0) {
      (result as any).mediaUrls = carousel.urls;
      (result as any).mediaType = carousel.hasVideo ? 'VIDEO' : 'IMAGE';
      if (!result.thumbnailUrl) {
        (result as any).thumbnailUrl = carousel.urls[0];
      }
    } else if (result.imageUrl) {
      (result as any).mediaUrls = [result.imageUrl];
      (result as any).mediaType = bestVideoUrl(result as unknown as Record<string, unknown>) ? 'VIDEO' : 'IMAGE';
    } else if (result.videoUrl) {
      (result as any).mediaUrls = [result.videoUrl];
      (result as any).mediaType = 'VIDEO';
      (result as any).thumbnailUrl = result.videoUrl;
    } else {
      (result as any).mediaUrls = [];
      (result as any).mediaType = null;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[hiker-lookup] Error:', message);
    const error: ErrorResponse = { error: message };
    return new Response(JSON.stringify(error), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
