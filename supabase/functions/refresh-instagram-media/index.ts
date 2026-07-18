// ============================================================================
// Edge Function: refresh-instagram-media
// Purpose: Refresh expiring Instagram CDN media URLs and cache them in DB.
//
// App usage:
//   POST /functions/v1/refresh-instagram-media { "groupBuyId": "..." }
//
// Cron usage:
//   POST /functions/v1/refresh-instagram-media { "mode": "batch", "limit": 20 }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

type MediaAsset = {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  thumbnailUrl?: string | null;
};

type InstagramMediaInfo = {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaUrls: string[];
  mediaItems: MediaAsset[];
  mediaType: 'IMAGE' | 'VIDEO' | null;
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  takenAt: string | null;
};

type GroupBuyRow = {
  id: string;
  thumbnail_url: string | null;
  video_url: string | null;
  media_urls: string[] | null;
  media_items: MediaAsset[] | null;
  media_type: 'IMAGE' | 'VIDEO' | null;
  end_date: string | null;
  submission?: { instagram_url?: string | null } | null;
};

type RefreshRequest = {
  groupBuyId?: string;
  force?: boolean;
  mode?: 'single' | 'batch';
  limit?: number;
  refreshWindowHours?: number;
};

type RefreshResult = {
  groupBuyId: string;
  refreshed: boolean;
  source: 'cache' | 'hiker' | 'skipped';
  instagramUrl: string | null;
  media: {
    imageUrl: string | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    mediaUrls: string[];
    mediaItems: MediaAsset[];
    mediaType: 'IMAGE' | 'VIDEO' | null;
  };
  error?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const DEFAULT_REFRESH_WINDOW_HOURS = 1;
const MAX_BATCH_LIMIT = 100;
const GROUP_BUY_SELECT = [
  'id',
  'thumbnail_url',
  'video_url',
  'media_urls',
  'media_items',
  'media_type',
  'end_date',
  'submission:gonggu_submissions!group_buys_submission_id_fkey(instagram_url)',
].join(', ');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isInstagramCdnUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'cdninstagram.com' ||
      hostname.endsWith('.cdninstagram.com') ||
      hostname === 'fbcdn.net' ||
      hostname.endsWith('.fbcdn.net')
    );
  } catch {
    return false;
  }
}

function getCdnExpiryMs(url?: string | null): number | null {
  if (!url) return null;
  try {
    const raw = new URL(url).searchParams.get('oe');
    if (!raw || !/^[0-9a-f]+$/i.test(raw)) return null;
    return Number.parseInt(raw, 16) * 1000;
  } catch {
    return null;
  }
}

function isGroupBuyExpired(row: GroupBuyRow): boolean {
  if (!row.end_date) return false;
  const endTime = Date.parse(row.end_date);
  return Number.isFinite(endTime) && endTime < Date.now();
}

function needsRefresh(row: GroupBuyRow, force: boolean, refreshWindowHours: number): boolean {
  if (isGroupBuyExpired(row)) return false;
  if (force) return true;

  if (!isInstagramCdnUrl(row.video_url)) return false;

  const expiresAt = getCdnExpiryMs(row.video_url);
  if (!expiresAt) return true;

  // CDN이 공구 종료 이후에 만료된다면, 공구가 끝나기 전에는 갱신할 필요가 없다.
  const groupBuyEnd = row.end_date ? Date.parse(row.end_date) : null;
  if (typeof groupBuyEnd === 'number' && Number.isFinite(groupBuyEnd) && expiresAt > groupBuyEnd) {
    return false;
  }

  return expiresAt <= Date.now() + refreshWindowHours * 60 * 60 * 1000;
}

function getOriginalInstagramUrl(row: GroupBuyRow): string | null {
  const submissionUrl = row.submission?.instagram_url?.trim();
  if (submissionUrl && submissionUrl.includes('instagram.com')) return submissionUrl;

  return null;
}

function getRecoverableInstagramUrl(row: GroupBuyRow): string | null {
  return getOriginalInstagramUrl(row);
}

function firstItem(value: unknown): Record<string, unknown> {
  const data = value as Record<string, unknown>;
  const mediaOrAd = data?.media_or_ad;
  if (mediaOrAd && typeof mediaOrAd === 'object') return mediaOrAd as Record<string, unknown>;

  const items = data?.items;
  if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
    return items[0] as Record<string, unknown>;
  }

  const nestedData = data?.data;
  if (Array.isArray(nestedData) && nestedData[0] && typeof nestedData[0] === 'object') {
    return nestedData[0] as Record<string, unknown>;
  }
  if (nestedData && typeof nestedData === 'object') {
    const nested = nestedData as Record<string, unknown>;
    const nestedMediaOrAd = nested.media_or_ad;
    if (nestedMediaOrAd && typeof nestedMediaOrAd === 'object') {
      return nestedMediaOrAd as Record<string, unknown>;
    }

    const nestedItems = nested.items;
    if (Array.isArray(nestedItems) && nestedItems[0] && typeof nestedItems[0] === 'object') {
      return nestedItems[0] as Record<string, unknown>;
    }
    return nested;
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

function collectPostMedia(media: Record<string, unknown>): Pick<
  InstagramMediaInfo,
  'imageUrl' | 'thumbnailUrl' | 'videoUrl' | 'mediaUrls' | 'mediaItems' | 'mediaType'
> {
  const carousel = media.carousel_media;
  if (Array.isArray(carousel)) {
    const urls: string[] = [];
    const items: MediaAsset[] = [];
    let firstVideoUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    for (const item of carousel) {
      if (!item || typeof item !== 'object') continue;
      const itemMedia = item as Record<string, unknown>;
      const imageUrl = bestImageUrl(itemMedia);
      const videoUrl = bestVideoUrl(itemMedia);

      if (!thumbnailUrl) thumbnailUrl = imageUrl ?? videoUrl;
      if (videoUrl) {
        urls.push(videoUrl);
        items.push({ url: videoUrl, mediaType: 'VIDEO', thumbnailUrl: imageUrl });
        if (!firstVideoUrl) firstVideoUrl = videoUrl;
      } else if (imageUrl) {
        urls.push(imageUrl);
        items.push({ url: imageUrl, mediaType: 'IMAGE', thumbnailUrl: imageUrl });
      }
    }

    if (urls.length > 0) {
      return {
        imageUrl: thumbnailUrl,
        thumbnailUrl,
        videoUrl: firstVideoUrl,
        mediaUrls: urls,
        mediaItems: items,
        mediaType: firstVideoUrl ? 'VIDEO' : 'IMAGE',
      };
    }
  }

  const imageUrl = bestImageUrl(media);
  const videoUrl = bestVideoUrl(media);
  const displayUrl = imageUrl ?? videoUrl;

  return {
    imageUrl,
    thumbnailUrl: displayUrl,
    videoUrl,
    mediaUrls: displayUrl ? [displayUrl] : [],
    mediaItems: displayUrl
      ? [{ url: videoUrl ?? displayUrl, mediaType: videoUrl ? 'VIDEO' : 'IMAGE', thumbnailUrl: imageUrl ?? displayUrl }]
      : [],
    mediaType: videoUrl ? 'VIDEO' : imageUrl ? 'IMAGE' : null,
  };
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
    throw new Error(`HikerAPI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const media = firstItem(data);
  const user = getRecord(media.user) ?? getRecord(media.owner) ?? getRecord((data as Record<string, unknown>)?.user);
  const caption = getRecord(media.caption);
  const takenAt = media.taken_at ?? media.takenAt ?? null;
  const mediaInfo = collectPostMedia(media);

  return {
    ...mediaInfo,
    caption: getString(caption?.text) ?? getString(media.caption_text) ?? getString(media.caption),
    likeCount: getNumber(media.like_count) ?? getNumber(media.likeCount),
    username: getString(user?.username) ?? getString(media.username),
    takenAt: typeof takenAt === 'number' ? new Date(takenAt * 1000).toISOString() : getString(takenAt),
  };
}

function rowToResult(row: GroupBuyRow, source: RefreshResult['source'], instagramUrl: string | null): RefreshResult {
  const mediaItems: MediaAsset[] = row.media_items?.length
    ? row.media_items
    : row.video_url
      ? [{ url: row.video_url, mediaType: 'VIDEO', thumbnailUrl: row.thumbnail_url }]
      : (row.thumbnail_url ? [{ url: row.thumbnail_url, mediaType: 'IMAGE', thumbnailUrl: row.thumbnail_url }] : []);

  return {
    groupBuyId: row.id,
    refreshed: false,
    source,
    instagramUrl,
    media: {
      imageUrl: row.thumbnail_url,
      thumbnailUrl: row.thumbnail_url,
      videoUrl: row.video_url,
      mediaUrls: row.media_urls ?? (row.video_url ? [row.video_url] : []),
      mediaItems,
      mediaType: row.media_type,
    },
  };
}

async function refreshRow(row: GroupBuyRow, force: boolean, refreshWindowHours: number): Promise<RefreshResult> {
  const instagramUrl = getRecoverableInstagramUrl(row);

  if (isGroupBuyExpired(row)) {
    return {
      ...rowToResult(row, 'skipped', instagramUrl),
      error: 'Group buy has already ended',
    };
  }

  if (!needsRefresh(row, force, refreshWindowHours)) {
    return rowToResult(row, 'cache', instagramUrl);
  }

  if (!instagramUrl) {
    return {
      ...rowToResult(row, 'skipped', null),
      error: 'Instagram URL could not be recovered',
    };
  }

  const hikerApiKey = Deno.env.get('HIKER_API_KEY') ?? '';
  if (!hikerApiKey) {
    throw new Error('HIKER_API_KEY is not configured');
  }

  const media = await lookupViaHikerAPI(instagramUrl, hikerApiKey);
  if (!media.videoUrl) {
    return {
      ...rowToResult(row, 'skipped', instagramUrl),
      error: 'Hiker response did not include a video URL',
    };
  }

  const supabase = createAdminClient();
  const resolvedMediaItems = media.mediaItems.length
    ? media.mediaItems
    : media.videoUrl || media.imageUrl
      ? [{ url: media.videoUrl ?? media.imageUrl!, mediaType: media.videoUrl ? 'VIDEO' as const : 'IMAGE' as const, thumbnailUrl: media.thumbnailUrl ?? null }]
      : [];
  const nowIso = new Date().toISOString();
  const updatePayload = {
    thumbnail_url: media.thumbnailUrl ?? row.thumbnail_url,
    updated_at: nowIso,
    media_refreshed_at: nowIso,
    video_url: media.videoUrl,
    media_urls: media.mediaUrls.length
      ? media.mediaUrls
      : (media.videoUrl ? [media.videoUrl] : (media.imageUrl ? [media.imageUrl] : [])),
    media_items: resolvedMediaItems,
    media_type: media.mediaType ?? 'VIDEO',
  };

  const { data, error } = await supabase
    .from('group_buys')
    .update(updatePayload)
    .eq('id', row.id)
    .select(GROUP_BUY_SELECT)
    .single();

  if (error) throw new Error(error.message);
  const updatedRow = data as unknown as Pick<GroupBuyRow, 'thumbnail_url'>;

  return {
    groupBuyId: row.id,
    refreshed: true,
    source: 'hiker',
    instagramUrl,
    media: {
      imageUrl: media.imageUrl,
      thumbnailUrl: media.thumbnailUrl ?? updatedRow.thumbnail_url ?? null,
      videoUrl: media.videoUrl,
      mediaUrls: media.mediaUrls.length
        ? media.mediaUrls
        : (media.videoUrl ? [media.videoUrl] : (media.imageUrl ? [media.imageUrl] : [])),
      mediaItems: resolvedMediaItems,
      mediaType: media.mediaType ?? 'VIDEO',
    },
  };
}

async function fetchGroupBuy(groupBuyId: string): Promise<GroupBuyRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('group_buys')
    .select(GROUP_BUY_SELECT)
    .eq('id', groupBuyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as unknown as GroupBuyRow;
}

async function fetchBatch(limit: number, refreshWindowHours: number): Promise<GroupBuyRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc('get_refreshable_instagram_media', {
      limit_count: limit,
      refresh_window_hours: refreshWindowHours,
    });

  if (error) throw new Error(error.message);
  return (data ?? []) as GroupBuyRow[];
}

async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let body: RefreshRequest;
  try {
    body = await req.json() as RefreshRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const force = body.force === true;
    const refreshWindowHours = Number.isFinite(body.refreshWindowHours)
      ? Math.max(0, Number(body.refreshWindowHours))
      : DEFAULT_REFRESH_WINDOW_HOURS;

    if (body.mode === 'batch') {
      const limit = Math.min(Math.max(1, body.limit ?? 20), MAX_BATCH_LIMIT);
      const rows = await fetchBatch(limit, refreshWindowHours);
      const results: RefreshResult[] = [];

      for (const row of rows) {
        try {
          results.push(await refreshRow(row, force, refreshWindowHours));
        } catch (error) {
          results.push({
            ...rowToResult(row, 'skipped', getRecoverableInstagramUrl(row)),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return jsonResponse({ results });
    }

    if (!body.groupBuyId || typeof body.groupBuyId !== 'string') {
      return jsonResponse({ error: 'groupBuyId is required' }, 400);
    }

    const row = await fetchGroupBuy(body.groupBuyId);
    if (!row) return jsonResponse({ error: 'Group buy not found' }, 404);

    return jsonResponse(await refreshRow(row, force, refreshWindowHours));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[refresh-instagram-media] Error:', message);
    return jsonResponse({ error: message }, 502);
  }
}

if (import.meta.main) {
  serve(handler);
}
