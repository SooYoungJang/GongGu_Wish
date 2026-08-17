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
import {
  extractPostAudioInfo,
  isInstagramCdnUrl as isTrustedInstagramCdnUrl,
  preferAudioVideoVersions,
  resolvePostAudio,
  trustedInstagramCdnUrl,
} from '../_shared/hiker-instagram-audio.ts';

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
  postAudioUrl: string | null;
  postAudioStartTimeMs: number | null;
  postAudioDurationMs: number | null;
  postAudioLookupStatus: 'FOUND' | 'NONE' | 'RETRYABLE';
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  takenAt: string | null;
};

type GroupBuyRow = {
  id: string;
  status: string;
  thumbnail_url: string | null;
  video_url: string | null;
  media_urls: string[] | null;
  media_items: MediaAsset[] | null;
  media_type: 'IMAGE' | 'VIDEO' | null;
  post_audio_url: string | null;
  post_audio_start_time_ms: number | null;
  post_audio_duration_ms: number | null;
  post_audio_checked_at: string | null;
  media_refreshed_at: string | null;
  media_refresh_attempted_at: string | null;
  end_date: string | null;
  raw_post?: { post_url?: string | null } | null;
  submission?: { instagram_url?: string | null } | null;
};

type RefreshRequest = {
  groupBuyId?: string;
  force?: boolean;
  failedPostAudioUrl?: string;
  mode?: 'single' | 'batch';
  limit?: number;
  refreshWindowHours?: number;
};

export type RefreshCallerKind = 'user' | 'cron' | 'service';

type RefreshCaller =
  | { kind: 'user'; userId: string }
  | { kind: 'cron' | 'service' };

export type RefreshExecution = {
  mode: 'single' | 'batch';
  force: boolean;
  limit: number;
  refreshWindowHours: number;
  claimCooldownSeconds: number;
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
    postAudioUrl: string | null;
    postAudioStartTimeMs: number | null;
    postAudioDurationMs: number | null;
  };
  error?: string;
};

export function buildPostAudioUpdatePatch(
  media: Pick<
    InstagramMediaInfo,
    | 'postAudioUrl'
    | 'postAudioStartTimeMs'
    | 'postAudioDurationMs'
    | 'postAudioLookupStatus'
  >,
  checkedAt: string,
): Record<string, unknown> {
  if (media.postAudioLookupStatus === 'RETRYABLE') return {};
  return {
    post_audio_url: media.postAudioUrl,
    post_audio_start_time_ms: media.postAudioStartTimeMs,
    post_audio_duration_ms: media.postAudioDurationMs,
    post_audio_checked_at: checkedAt,
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const DEFAULT_REFRESH_WINDOW_HOURS = 1;
const MAX_BATCH_LIMIT = 100;
const MAX_REFRESH_WINDOW_HOURS = 24;
const USER_CLAIM_COOLDOWN_SECONDS = 15 * 60;
const CRON_CLAIM_COOLDOWN_SECONDS = 55 * 60;
const SERVICE_CLAIM_COOLDOWN_SECONDS = 1;
const CRON_BATCH_LIMIT = 100;
const CRON_SECRET_HEADER = 'X-Refresh-Cron-Secret';
const USER_REFRESH_QUOTA_ATTEMPTS = 3;
const USER_REFRESH_QUOTA_WINDOW_SECONDS = 60 * 60;
const GROUP_BUY_SELECT = [
  'id',
  'status',
  'thumbnail_url',
  'video_url',
  'media_urls',
  'media_items',
  'media_type',
  'post_audio_url',
  'post_audio_start_time_ms',
  'post_audio_duration_ms',
  'post_audio_checked_at',
  'media_refreshed_at',
  'media_refresh_attempted_at',
  'end_date',
  'raw_post:raw_posts!group_buys_raw_post_id_fkey(post_url)',
  'submission:gonggu_submissions!group_buys_submission_id_fkey(instagram_url)',
].join(', ');

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

export function normalizeRefreshExecution(
  body: RefreshRequest,
  caller: RefreshCallerKind,
): RefreshExecution {
  if (body.mode !== undefined && body.mode !== 'single' && body.mode !== 'batch') {
    throw new HttpError(400, 'Invalid refresh mode');
  }
  if (caller === 'user') {
    if (body.mode === 'batch') {
      throw new HttpError(403, 'Batch refresh requires a trusted caller');
    }
    return {
      mode: 'single',
      force: false,
      limit: 1,
      refreshWindowHours: DEFAULT_REFRESH_WINDOW_HOURS,
      claimCooldownSeconds: USER_CLAIM_COOLDOWN_SECONDS,
    };
  }

  if (caller === 'cron') {
    if (body.mode !== 'batch') {
      throw new HttpError(403, 'Cron callers may only run the scheduled batch refresh');
    }
    return {
      mode: 'batch',
      force: false,
      limit: CRON_BATCH_LIMIT,
      refreshWindowHours: DEFAULT_REFRESH_WINDOW_HOURS,
      claimCooldownSeconds: CRON_CLAIM_COOLDOWN_SECONDS,
    };
  }

  return {
    mode: body.mode === 'batch' ? 'batch' : 'single',
    force: body.force === true,
    limit: boundedInteger(body.limit, 20, 1, MAX_BATCH_LIMIT),
    refreshWindowHours: boundedInteger(
      body.refreshWindowHours,
      DEFAULT_REFRESH_WINDOW_HOURS,
      0,
      MAX_REFRESH_WINDOW_HOURS,
    ),
    claimCooldownSeconds: SERVICE_CLAIM_COOLDOWN_SECONDS,
  };
}

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

export function extractBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

async function secretsEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function authenticateRefreshCaller(req: Request): Promise<RefreshCaller> {
  const bearerToken = extractBearerToken(req.headers.get('Authorization'));
  const cronSecret = req.headers.get(CRON_SECRET_HEADER)?.trim() ?? '';
  if (!bearerToken && (!cronSecret || cronSecret.length > 256)) {
    throw new HttpError(401, 'Authentication is required');
  }

  if (bearerToken) {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (serviceRoleKey && await secretsEqual(bearerToken, serviceRoleKey)) {
      return { kind: 'service' };
    }

    const supabase = createAdminClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearerToken);
    if (!error && user) return { kind: 'user', userId: user.id };
    throw new HttpError(401, 'Authentication is required');
  }

  if (cronSecret) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('verify_instagram_refresh_cron_secret', {
      candidate: cronSecret,
    });
    if (!error && data === true) return { kind: 'cron' };
  }

  throw new HttpError(401, 'Authentication is required');
}

export function isInstagramCdnUrl(url?: string | null): boolean {
  return isTrustedInstagramCdnUrl(url);
}

export function trustedInstagramPostUrl(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048) return null;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isInstagramHost = hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
    const isPostPath = /^\/(p|reel|tv)\/[^/?#]+\/?$/i.test(parsed.pathname);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      !isInstagramHost ||
      !isPostPath
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function isUserPostAudioRecoveryAllowed(
  storedPostAudioUrl?: string | null,
  failedPostAudioUrl?: string | null,
): boolean {
  const storedUrl = trustedInstagramCdnUrl(storedPostAudioUrl);
  const failedUrl = trustedInstagramCdnUrl(failedPostAudioUrl);
  return storedUrl !== null && failedUrl === storedUrl;
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

function isGroupBuyExpired(row: Pick<GroupBuyRow, 'end_date'>): boolean {
  if (!row.end_date) return false;
  const endTime = Date.parse(row.end_date);
  return Number.isFinite(endTime) && endTime < Date.now();
}

function cdnUrlNeedsRefresh(
  url: string | null,
  endDate: string | null,
  refreshWindowHours: number,
): boolean {
  if (!isInstagramCdnUrl(url)) return false;
  const expiresAt = getCdnExpiryMs(url);
  if (!expiresAt) return true;

  // CDN이 공구 종료 이후에 만료된다면, 공구가 끝나기 전에는 갱신할 필요가 없다.
  const groupBuyEnd = endDate ? Date.parse(endDate) : null;
  if (typeof groupBuyEnd === 'number' && Number.isFinite(groupBuyEnd) && expiresAt > groupBuyEnd) {
    return false;
  }

  return expiresAt <= Date.now() + refreshWindowHours * 60 * 60 * 1000;
}

export function needsRefresh(
  row: Pick<
    GroupBuyRow,
    | 'end_date'
    | 'post_audio_checked_at'
    | 'post_audio_url'
    | 'thumbnail_url'
    | 'video_url'
  >,
  force: boolean,
  refreshWindowHours: number,
): boolean {
  if (isGroupBuyExpired(row)) return false;
  if (force || !row.post_audio_checked_at) return true;
  return (
    cdnUrlNeedsRefresh(row.thumbnail_url, row.end_date, refreshWindowHours) ||
    cdnUrlNeedsRefresh(row.video_url, row.end_date, refreshWindowHours) ||
    cdnUrlNeedsRefresh(row.post_audio_url, row.end_date, refreshWindowHours)
  );
}

export function getOriginalInstagramUrl(
  row: Pick<GroupBuyRow, 'raw_post' | 'submission'>,
): string | null {
  return (
    trustedInstagramPostUrl(row.raw_post?.post_url) ??
    trustedInstagramPostUrl(row.submission?.instagram_url)
  );
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
    const url = trustedInstagramCdnUrl(best?.url);
    if (url) return url;
  }

  const carousel = media.carousel_media;
  if (Array.isArray(carousel) && carousel[0] && typeof carousel[0] === 'object') {
    return bestImageUrl(carousel[0] as Record<string, unknown>);
  }

  const videoVersions = media.video_versions;
  if (Array.isArray(videoVersions) && videoVersions[0] && typeof videoVersions[0] === 'object') {
    const url = trustedInstagramCdnUrl(
      (videoVersions[0] as Record<string, unknown>).url,
    );
    if (url) return url;
  }

  return trustedInstagramCdnUrl(media.imageUrl) ??
    trustedInstagramCdnUrl(media.thumbnail_url) ??
    trustedInstagramCdnUrl(media.thumbnailUrl);
}

function bestVideoUrl(media: Record<string, unknown>): string | null {
  const videoVersions = media.video_versions;
  if (Array.isArray(videoVersions)) {
    for (const version of videoVersions) {
      const record = getRecord(version);
      const url = trustedInstagramCdnUrl(record?.url);
      if (url) return url;
    }
  }
  return null;
}

function collectPostMedia(media: Record<string, unknown>): Pick<
  InstagramMediaInfo,
  | 'imageUrl'
  | 'thumbnailUrl'
  | 'videoUrl'
  | 'mediaUrls'
  | 'mediaItems'
  | 'mediaType'
  | 'postAudioUrl'
  | 'postAudioStartTimeMs'
  | 'postAudioDurationMs'
> {
  const postAudio = extractPostAudioInfo(media);
  const carousel = media.carousel_media;
  if (Array.isArray(carousel)) {
    const urls: string[] = [];
    const items: MediaAsset[] = [];
    let firstVideoUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    for (const item of carousel.slice(0, 20)) {
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
        ...postAudio,
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
    ...postAudio,
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
  const preferredMedia = await preferAudioVideoVersions(media);
  const mediaInfo = collectPostMedia(preferredMedia);
  const postAudio = await resolvePostAudio(media, apiKey);

  return {
    ...mediaInfo,
    ...postAudio,
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
      postAudioUrl: row.post_audio_url,
      postAudioStartTimeMs: row.post_audio_start_time_ms,
      postAudioDurationMs: row.post_audio_duration_ms,
    },
  };
}

async function claimRefreshAttempt(groupBuyId: string, cooldownSeconds: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('claim_instagram_media_refresh', {
    target_group_buy_id: groupBuyId,
    cooldown_seconds: cooldownSeconds,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

async function claimUserRefreshQuota(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('claim_instagram_media_refresh_user_quota', {
    target_user_id: userId,
    max_attempts: USER_REFRESH_QUOTA_ATTEMPTS,
    window_seconds: USER_REFRESH_QUOTA_WINDOW_SECONDS,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

async function refreshRow(
  row: GroupBuyRow,
  force: boolean,
  refreshWindowHours: number,
  claimCooldownSeconds: number,
): Promise<RefreshResult> {
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

  if (!await claimRefreshAttempt(row.id, claimCooldownSeconds)) {
    return rowToResult(row, 'cache', instagramUrl);
  }

  const media = await lookupViaHikerAPI(instagramUrl, hikerApiKey);
  if (!media.videoUrl && !media.imageUrl && media.mediaItems.length === 0) {
    return {
      ...rowToResult(row, 'skipped', instagramUrl),
      error: 'Hiker response did not include trusted media',
    };
  }

  const supabase = createAdminClient();
  const resolvedMediaItems = media.mediaItems.length
    ? media.mediaItems
    : media.videoUrl || media.imageUrl
      ? [{ url: media.videoUrl ?? media.imageUrl!, mediaType: media.videoUrl ? 'VIDEO' as const : 'IMAGE' as const, thumbnailUrl: media.thumbnailUrl ?? null }]
      : [];
  const nowIso = new Date().toISOString();
  const resolvedMediaType = media.mediaType ?? row.media_type ?? (media.videoUrl ? 'VIDEO' : 'IMAGE');
  const updatePayload = {
    thumbnail_url: media.thumbnailUrl ?? row.thumbnail_url,
    updated_at: nowIso,
    media_refreshed_at: nowIso,
    video_url: media.videoUrl,
    media_urls: media.mediaUrls.length
      ? media.mediaUrls
      : (media.videoUrl ? [media.videoUrl] : (media.imageUrl ? [media.imageUrl] : [])),
    media_items: resolvedMediaItems,
    media_type: resolvedMediaType,
    ...buildPostAudioUpdatePatch(media, nowIso),
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
      mediaType: resolvedMediaType,
      postAudioUrl: media.postAudioUrl,
      postAudioStartTimeMs: media.postAudioStartTimeMs,
      postAudioDurationMs: media.postAudioDurationMs,
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

async function fetchBatch(
  limit: number,
  refreshWindowHours: number,
  claimCooldownSeconds: number,
): Promise<GroupBuyRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc('get_refreshable_instagram_media', {
      limit_count: limit,
      refresh_window_hours: refreshWindowHours,
      minimum_attempt_age_seconds: claimCooldownSeconds,
    });

  if (error) throw new Error(error.message);
  return (data ?? []) as GroupBuyRow[];
}

export async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const caller = await authenticateRefreshCaller(req);
    let body: RefreshRequest;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid body shape');
      }
      body = parsed as RefreshRequest;
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
    const execution = normalizeRefreshExecution(body, caller.kind);

    if (execution.mode === 'batch') {
      const rows = await fetchBatch(
        execution.limit,
        execution.refreshWindowHours,
        execution.claimCooldownSeconds,
      );
      const results: RefreshResult[] = [];

      for (const row of rows) {
        try {
          results.push(await refreshRow(
            row,
            execution.force,
            execution.refreshWindowHours,
            execution.claimCooldownSeconds,
          ));
        } catch (error) {
          results.push({
            ...rowToResult(row, 'skipped', getRecoverableInstagramUrl(row)),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return jsonResponse({ results });
    }

    const groupBuyId = typeof body.groupBuyId === 'string' ? body.groupBuyId.trim() : '';
    if (!groupBuyId || groupBuyId.length > 128) {
      return jsonResponse({ error: 'groupBuyId is required' }, 400);
    }

    const row = await fetchGroupBuy(groupBuyId);
    if (!row) return jsonResponse({ error: 'Group buy not found' }, 404);
    if (caller.kind === 'user' && row.status !== 'APPROVED') {
      return jsonResponse({ error: 'Group buy not found' }, 404);
    }

    let force = execution.force;
    if (caller.kind === 'user') {
      if (!isUserPostAudioRecoveryAllowed(row.post_audio_url, body.failedPostAudioUrl)) {
        throw new HttpError(403, 'Post audio recovery requires the current failed URL');
      }
      if (!await claimUserRefreshQuota(caller.userId)) {
        throw new HttpError(429, 'Post audio refresh quota exceeded');
      }
      force = true;
    }

    return jsonResponse(await refreshRow(
      row,
      force,
      execution.refreshWindowHours,
      execution.claimCooldownSeconds,
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (error instanceof HttpError) return jsonResponse({ error: message }, error.status);
    console.error('[refresh-instagram-media] Error:', message);
    return jsonResponse({ error: message }, 502);
  }
}

if (import.meta.main) {
  serve(handler);
}
