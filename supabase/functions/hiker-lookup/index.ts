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
  /** Display-ready media URLs in post order */
  mediaUrls: string[];
  /** Ordered media assets with per-slide type information */
  mediaItems: Array<{
    url: string;
    mediaType: 'IMAGE' | 'VIDEO';
    thumbnailUrl?: string | null;
  }>;
  /** Dominant media type: IMAGE or VIDEO */
  mediaType: 'IMAGE' | 'VIDEO' | null;
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  takenAt: string | null;
  /** LLM-inferred product metadata. Present when UMANS_API_KEY is configured;
   *  absent when LLM enrichment is disabled or fails (callers fall back to
   *  rule-based inference on the client). */
  suggestions?: HikerLlmSuggestions;
}

interface HikerLlmSuggestions {
  productName: string;
  brandName: string;
  category: string;
  discountInfo: string;
  /** Group-buy start date as YYYY-MM-DD, empty when unknown. */
  startDate: string;
  /** Group-buy end date as YYYY-MM-DD, empty when unknown. */
  endDate: string;
  /** Korean-won price as a string (e.g. "19900"). Empty when unknown. */
  priceKrw: string;
}

// Valid category set kept in sync with apps/admin/src/lib/hikerSuggestions.ts

const VALID_CATEGORIES = [
  'food', 'living', 'beauty', 'fashion', 'home', 'kitchen', 'electronics',
  'pet', 'auto', 'hobby', 'baby', 'sports', 'stationery', 'books', 'media', 'travel',
] as const;

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

type CollectedCarouselMedia = {
  urls: string[];
  items: InstagramMediaInfo['mediaItems'];
  hasVideo: boolean;
  firstVideoUrl: string | null;
  thumbnailUrl: string | null;
};

export function collectCarouselMedia(media: Record<string, unknown>): CollectedCarouselMedia {
  const carousel = media.carousel_media;
  if (!Array.isArray(carousel)) {
    return { urls: [], items: [], hasVideo: false, firstVideoUrl: null, thumbnailUrl: null };
  }

  const urls: string[] = [];
  const items: InstagramMediaInfo['mediaItems'] = [];
  let hasVideo = false;
  let firstVideoUrl: string | null = null;
  let thumbnailUrl: string | null = null;

  for (const item of carousel) {
    if (!item || typeof item !== 'object') continue;
    const itemMedia = item as Record<string, unknown>;
    const imageUrl = bestImageUrl(itemMedia);
    const videoUrl = bestVideoUrl(itemMedia);

    if (!thumbnailUrl) {
      thumbnailUrl = imageUrl ?? videoUrl;
    }

    if (videoUrl) {
      urls.push(videoUrl);
      items.push({ url: videoUrl, mediaType: 'VIDEO', thumbnailUrl: imageUrl });
      hasVideo = true;
      if (!firstVideoUrl) {
        firstVideoUrl = videoUrl;
      }
    } else if (imageUrl) {
      urls.push(imageUrl);
      items.push({ url: imageUrl, mediaType: 'IMAGE', thumbnailUrl: imageUrl });
    }
  }

  return { urls, items, hasVideo, firstVideoUrl, thumbnailUrl };
}

export function collectPostMedia(media: Record<string, unknown>): Pick<
  InstagramMediaInfo,
  'imageUrl' | 'thumbnailUrl' | 'videoUrl' | 'mediaUrls' | 'mediaItems' | 'mediaType'
> {
  const carousel = collectCarouselMedia(media);
  if (carousel.urls.length > 0) {
    const thumbnailUrl = carousel.thumbnailUrl ?? bestImageUrl(media);
    return {
      imageUrl: thumbnailUrl,
      thumbnailUrl,
      videoUrl: carousel.firstVideoUrl,
      mediaUrls: carousel.urls,
      mediaItems: carousel.items,
      mediaType: carousel.hasVideo ? 'VIDEO' : 'IMAGE',
    };
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

export async function lookupViaHikerAPI(url: string, apiKey: string): Promise<InstagramMediaInfo> {
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
  const mediaInfo = collectPostMedia(media);

  return {
    ...mediaInfo,
    caption: getString(caption?.text) ?? getString(media.caption_text) ?? getString(media.caption),
    likeCount: getNumber(media.like_count) ?? getNumber(media.likeCount),
    username: getString(user?.username) ?? getString(media.username),
    takenAt: typeof takenAt === 'number'
      ? new Date(takenAt * 1000).toISOString()
      : getString(takenAt),
  };
}


// ─── LLM Enrichment (umans.ai — OpenAI-compatible) ──────────────────────────

interface UmansChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface LlmParsedSuggestion {
  productName?: string;
  brandName?: string;
  category?: string;
  discountInfo?: string;
  startDate?: string;
  endDate?: string;
  priceKrw?: string;
}
/**
 * Calls umans.ai (OpenAI-compatible Chat Completions) to extract structured
 * product metadata from an Instagram caption. Returns null when the API key
 * is missing, the call fails, or the model emits nothing usable — callers
 * then fall back to the rule-based client inference in hikerSuggestions.ts.
 */
async function inferSuggestionsViaLlm(caption: string | null): Promise<HikerLlmSuggestions | null> {
  const apiKey = Deno.env.get('UMANS_API_KEY') ?? '';
  if (!apiKey || !caption || caption.trim().length === 0) {
    return null;
  }

  const model = Deno.env.get('UMANS_MODEL') ?? 'umans/umans-glm-5.2';
  const endpoint = Deno.env.get('UMANS_API_BASE') ?? 'https://api.code.umans.ai/v1/chat/completions';

  const systemPrompt = [
    '너는 한국어 인스타그램 공동구매 게시글에서 상품 메타데이터를 추출하는 전문 어시스턴트다.',
    '주어진 캡션(해시태그 포함)에서 아래 필드를 JSON으로만 응답하라. 한국어 외 텍스트는 금지.',
    '- productName: 실제 판매 상품명. 홍보문구/날짜/가격/해시태그/URL은 제외. 최대 80자.',
    '- brandName: 브랜드명. 없거나 불명확하면 빈 문자열.',
    '- category: 반드시 다음 중 하나: food, living, beauty, fashion, home, kitchen, electronics, pet, auto, hobby, baby, sports, stationery, books, media, travel. 판단 불가하면 빈 문자열.',
    '- discountInfo: 할인/가격 정보 요약(예: "정가 29,900원 → 공구가 19,900원"). 없으면 빈 문자열.',
    '- startDate: 공구 시작일. YYYY-MM-DD 형식. 캡션에 명시된 시작일/오픈일만. 없으면 빈 문자열.',
    '- endDate: 공구 마감일. YYYY-MM-DD 형식. 캡션에 명시된 마감일/종료일만. 없으면 빈 문자열.',
    '- priceKrw: 판매 가격(원). 숫자만(쉼표/원/공구가 등 단위 제외, 예: "19900"). 여러 가격이 있으면 공구가 우선. 없으면 빈 문자열.',
    '반드시 {"productName":...,"brandName":...,"category":...,"discountInfo":...,"startDate":...,"endDate":...,"priceKrw":...} 형태의 JSON만 출력하라.'
  ].join('\n');
  const userPrompt = '캡션:\n' + caption;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[hiker-lookup] umans.ai request failed:', msg);
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[hiker-lookup] umans.ai returned ${response.status}: ${body.slice(0, 200)}`);
    return null;
  }

  let payload: UmansChatResponse;
  try {
    payload = await response.json() as UmansChatResponse;
  } catch {
    console.error('[hiker-lookup] umans.ai returned invalid JSON');
    return null;
  }

  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content) {
    return null;
  }

  const parsed = parseLlmJson(content);
  if (!parsed || typeof parsed !== 'object') {
    console.error('[hiker-lookup] umans.ai content was not parseable JSON');
    return null;
  }

  return normalizeLlmSuggestions(parsed as LlmParsedSuggestion);
}

/** Tolerant JSON extraction — strips code fences and trailing prose. */
function parseLlmJson(content: string): LlmParsedSuggestion | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.search(/\{/);
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as LlmParsedSuggestion;
  } catch {
    return null;
  }
}

function normalizeLlmSuggestions(raw: LlmParsedSuggestion): HikerLlmSuggestions {
  const categoryRaw = (raw.category ?? '').trim().toLowerCase();
  const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw) ? categoryRaw : '';
  return {
    productName: trimTo(raw.productName, 80),
    brandName: trimTo(raw.brandName, 60),
    category,
    discountInfo: trimTo(raw.discountInfo, 200),
    startDate: normalizeDate(raw.startDate),
    endDate: normalizeDate(raw.endDate),
    priceKrw: normalizePrice(raw.priceKrw),
  };
}

/** Coerces a date-ish string into YYYY-MM-DD. Returns "" when unparseable.
 *  Tolerates Korean month/day tokens ("7월 13일") and missing years. */
function normalizeDate(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';

  // Already YYYY-MM-DD
  let m = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // YYYY-MM-DD with trailing time or noise
  m = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // Korean: 7월 13일 (year defaults to current)
  m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${pad(m[1])}-${pad(m[2])}`;
  }

  // MM/DD or MM-DD (year defaults to current)
  m = text.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${pad(m[1])}-${pad(m[2])}`;
  }

  return '';
}

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

/** Strips currency/separator noise and returns a numeric string. "" if not a number. */
function normalizePrice(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  const num = Number(digits);
  return Number.isFinite(num) && num > 0 ? String(num) : '';
}
function trimTo(value: string | undefined, max: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, max);
}
// ─── CORS Headers ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Main Handler ────────────────────────────────────────────────────────────

async function handler(req: Request) {
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

    // LLM enrichment is optional — a missing key or a failed call simply
    // yields suggestions === null and the client falls back to rule-based
    // inference. Never let LLM failure fail the whole lookup.
    try {
      const suggestions = await inferSuggestionsViaLlm(result.caption);
      if (suggestions) {
        result.suggestions = suggestions;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[hiker-lookup] LLM enrichment skipped:', msg);
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
}

if (import.meta.main) {
  serve(handler);
}
