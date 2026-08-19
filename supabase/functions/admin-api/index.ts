// ============================================================================
// Edge Function: admin-api
// Purpose: Authenticated admin operations for GongGu Wish.
//
// Invoke: POST /functions/v1/admin-api  { path, method, body?, params? }
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  buildReviewedCollectionSnapshot,
  legacyCollectionReviewStatus,
  reviewTransition,
  type CollectionReviewSnapshot,
  type CollectionReviewStatus,
} from "../_shared/automaticCollectionReview.ts";
import { isInstagramCdnUrl } from "../_shared/hiker-instagram-audio.ts";
import {
  automaticInstagramPostUrl,
  collectionReviewFilter,
  CollectionReviewContractError,
  normalizeRejectionReason,
  protectPendingAutomaticCatalogPatch,
  reviewedData,
  validateApprovalData,
} from "./automaticCollectionReviewContract.ts";
import {
  normalizeCommercePatch,
  normalizePersistedPriceKrw,
} from "./commerceFields.ts";
import {
  type CdnRefreshStatusRow,
  mapCdnRefreshStatusRow,
} from "./cdnRefreshStatus.ts";
import {
  groupBuyRequestRejectionTransition,
  mapAdminGroupBuyRequestList,
  type AdminGroupBuyRequestStatus,
} from "./groupBuyRequestContract.ts";
import { normalizeMonthlyFeaturedRank } from "./monthlyFeaturedRank.ts";
import {
  hasInstagramOwnerChanged,
  normalizeInstagramUsername,
  normalizeProfileImageUrl,
  parseInstagramUsernameWrite,
  parseProfileImageWriteIntent,
  type ProfileImageWriteIntent,
  resolveCanonicalProfileImageWriteIntent,
} from "./influencerProfile.ts";
import {
  deliverPendingSubmissionApprovalPushes,
  type SubmissionApprovalDeliverySummary,
} from "./submissionApprovalPush.ts";
import { sendPushNotification } from "./pushNotifications.ts";
import {
  mapSubmissionDelivery,
  type SubmissionNotificationDelivery,
} from "./submissionDelivery.ts";
import { mapAdminUser } from "./userContract.ts";

type AdminMethod = "GET" | "POST" | "PATCH" | "DELETE";
type SubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DUPLICATE"
  | "CANCELLED";
type GroupBuyStatus = "APPROVED" | "REVIEW_REQUIRED" | "REJECTED" | "EXPIRED";
type MediaAsset = {
  url: string;
  mediaType: "IMAGE" | "VIDEO";
  thumbnailUrl?: string | null;
};
interface AdminRequest {
  path: string;
  method: AdminMethod;
  body?: Record<string, unknown>;
  params?: Record<string, string | number | null | undefined>;
}

type AdminClient = ReturnType<typeof createAdminClient>;

class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SUBMISSION_SELECT = `
  id,
  product_name,
  brand_name,
  instagram_username,
  profile_image_url,
  category,
  start_date,
  end_date,
  purchase_url,
  discount_info,
  price_krw,
  summary,
  instagram_url,
  image_urls,
  media_items,
  post_audio_url,
  post_audio_start_time_ms,
  post_audio_duration_ms,
  post_audio_checked_at,
  reporter_name,
  reporter_contact,
  is_anonymous,
  content_hash,
  status,
  admin_memo,
  reviewed_at,
  reviewed_by,
  group_buy_id,
  is_home_banner,
  home_banner_start_date,
  home_banner_end_date,
  created_at,
  updated_at
`;

const GROUP_BUY_SELECT = `
  id,
  product_name,
  brand_name,
  instagram_username,
  influencer_id,
  influencer:influencer_id (
    id,
    instagram_username,
    profile_image_url
  ),
  raw_post:raw_post_id (
    id,
    post_url,
    instagram_post_id,
    taken_at,
    collected_at
  ),
  category,
  start_date,
  end_date,
  purchase_url,
  discount_info,
  price_krw,
  summary,
  thumbnail_url,
  video_url,
  media_urls,
  media_items,
  media_type,
  post_audio_url,
  post_audio_start_time_ms,
  post_audio_duration_ms,
  post_audio_checked_at,
  confidence,
  status,
  rejection_reason,
  reviewed_at,
  reviewed_by,
  collection_review_status,
  collection_proposal_snapshot,
  collection_reviewed_snapshot,
  collection_ruleset_version,
  collection_hiker_used,
  collection_hiker_lookup_at,
  source_type,
  submission_id,
  is_all_day,
  is_monthly_featured,
  monthly_featured_rank,
  is_home_banner,
  home_banner_start_date,
  home_banner_end_date,
  created_at,
  updated_at
`;

const USER_SELECT = `
  id,
  email,
  nickname,
  fcm_token,
  push_token,
  push_provider,
  created_at,
  updated_at,
  status
`;

const COMMENT_MODERATION_SELECT = `
  id,
  group_buy_id,
  parent_id,
  body,
  author_display_name,
  state,
  like_count,
  content_version,
  created_at,
  edited_at,
  group_buys(product_name),
  comment_reports(count)
`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  return { supabaseUrl, serviceRoleKey };
}

function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin(req: Request, supabase: AdminClient) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: json({ error: "관리자 로그인이 필요합니다." }, 401) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  const user = data.user;
  if (error || !user) {
    return {
      error: json(
        { error: "세션이 만료되었습니다. 다시 로그인해주세요." },
        401,
      ),
    };
  }

  const role = user.app_metadata?.role;
  const roles = user.app_metadata?.roles;
  const isAdmin =
    role === "admin" || (Array.isArray(roles) && roles.includes("admin"));
  if (!isAdmin) {
    return { error: json({ error: "관리자 권한이 없습니다." }, 403) };
  }

  return { user };
}

function str(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function listParam(
  params: AdminRequest["params"],
  key: string,
  fallback: number,
) {
  const value = Number(params?.[key] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function sanitizeSearch(value: string | null) {
  return (
    value
      ?.replace(/[%,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? null
  );
}

function normalizeMediaItems(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) return [];

  const items: MediaAsset[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = str(record.url);
    const mediaType =
      record.mediaType === "VIDEO"
        ? "VIDEO"
        : record.mediaType === "IMAGE"
          ? "IMAGE"
          : null;
    const thumbnailUrl = str(record.thumbnailUrl);
    if (!url || !mediaType) continue;
    items.push({ url, mediaType, thumbnailUrl });
    if (items.length >= 20) break;
  }
  return items;
}

function normalizeMediaUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .slice(0, 20)
    : [];
}

function normalizePostAudioUrl(value: unknown): string | null {
  const url = str(value);
  if (!url) return null;
  if (!isInstagramCdnUrl(url)) {
    throw new Error("postAudioUrl must be an HTTPS Instagram CDN URL.");
  }
  return url;
}

function normalizePostAudioInteger(
  value: unknown,
  fieldName: string,
  allowZero: boolean,
): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${fieldName} must be ${allowZero ? "non-negative" : "positive"}.`,
    );
  }
  return parsed;
}

export function normalizePostAudioPatch(body: Record<string, unknown>) {
  const urlTouched = hasOwn(body, "postAudioUrl");
  const startTouched = hasOwn(body, "postAudioStartTimeMs");
  const durationTouched = hasOwn(body, "postAudioDurationMs");
  if (!urlTouched && !startTouched && !durationTouched) return {};

  const patch: Record<string, unknown> = {
    post_audio_checked_at: new Date().toISOString(),
  };
  if (urlTouched) {
    patch.post_audio_url = normalizePostAudioUrl(body.postAudioUrl);
  }
  if (startTouched) {
    patch.post_audio_start_time_ms = normalizePostAudioInteger(
      body.postAudioStartTimeMs,
      "postAudioStartTimeMs",
      true,
    );
  }
  if (durationTouched) {
    patch.post_audio_duration_ms = normalizePostAudioInteger(
      body.postAudioDurationMs,
      "postAudioDurationMs",
      false,
    );
  }
  if (patch.post_audio_url === null) {
    patch.post_audio_start_time_ms = null;
    patch.post_audio_duration_ms = null;
  }
  return patch;
}

function normalizeSubmissionPatch(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(body, "productName")) patch.product_name = str(body.productName);
  if (hasOwn(body, "brandName")) patch.brand_name = str(body.brandName);
  if (hasOwn(body, "instagramUsername")) {
    patch.instagram_username = parseInstagramUsernameWrite(
      body.instagramUsername,
    );
  }
  if (hasOwn(body, "profileImageUrl"))
    patch.profile_image_url = parseProfileImageWriteIntent(
      body.profileImageUrl,
      true,
    ).profileImageUrl;
  if (hasOwn(body, "category")) patch.category = str(body.category);
  if (hasOwn(body, "startDate")) patch.start_date = str(body.startDate);
  if (hasOwn(body, "endDate")) patch.end_date = str(body.endDate);
  if (hasOwn(body, "purchaseUrl")) patch.purchase_url = str(body.purchaseUrl);
  if (hasOwn(body, "discountInfo"))
    patch.discount_info = str(body.discountInfo);
  if (hasOwn(body, "summary")) patch.summary = str(body.summary);
  if (hasOwn(body, "instagramUrl"))
    patch.instagram_url = str(body.instagramUrl);
  if (hasOwn(body, "imageUrls"))
    patch.image_urls = normalizeMediaUrls(body.imageUrls);
  if (hasOwn(body, "mediaItems"))
    patch.media_items = normalizeMediaItems(body.mediaItems);
  if (hasOwn(body, "adminMemo")) patch.admin_memo = str(body.adminMemo);
  Object.assign(patch, normalizePostAudioPatch(body));
  Object.assign(patch, normalizeCommercePatch(body, existing));

  return patch;
}

function normalizeGroupBuyPatch(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(body, "productName")) patch.product_name = str(body.productName);
  if (hasOwn(body, "brandName")) patch.brand_name = str(body.brandName);
  if (hasOwn(body, "instagramUsername")) {
    patch.instagram_username = parseInstagramUsernameWrite(
      body.instagramUsername,
    );
  }
  if (hasOwn(body, "category")) patch.category = str(body.category);
  if (hasOwn(body, "startDate")) patch.start_date = str(body.startDate);
  if (hasOwn(body, "endDate")) patch.end_date = str(body.endDate);
  if (hasOwn(body, "purchaseUrl")) patch.purchase_url = str(body.purchaseUrl);
  if (hasOwn(body, "discountInfo"))
    patch.discount_info = str(body.discountInfo);
  if (hasOwn(body, "summary")) patch.summary = str(body.summary);
  if (hasOwn(body, "thumbnailUrl"))
    patch.thumbnail_url = str(body.thumbnailUrl);
  if (hasOwn(body, "videoUrl")) patch.video_url = str(body.videoUrl);
  if (hasOwn(body, "mediaUrls"))
    patch.media_urls = normalizeMediaUrls(body.mediaUrls);
  if (hasOwn(body, "mediaItems"))
    patch.media_items = normalizeMediaItems(body.mediaItems);
  if (hasOwn(body, "mediaType")) patch.media_type = str(body.mediaType);
  if (hasOwn(body, "confidence")) patch.confidence = num(body.confidence, 0.9);
  if (hasOwn(body, "status")) patch.status = str(body.status) as GroupBuyStatus;
  if (hasOwn(body, "isAllDay")) patch.is_all_day = bool(body.isAllDay);
  if (hasOwn(body, "isMonthlyFeatured"))
    patch.is_monthly_featured = bool(body.isMonthlyFeatured);
  if (hasOwn(body, "monthlyFeaturedRank")) {
    patch.monthly_featured_rank = normalizeMonthlyFeaturedRank(
      body.monthlyFeaturedRank,
    );
  }
  Object.assign(patch, normalizePostAudioPatch(body));
  Object.assign(patch, normalizeCommercePatch(body, existing));

  return patch;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

async function getSubmissionNotificationDeliveries(
  supabase: AdminClient,
  submissionIds: string[],
) {
  if (submissionIds.length === 0) {
    return new Map<string, SubmissionNotificationDelivery>();
  }
  const { data, error } = await supabase.rpc(
    "get_submission_notification_delivery",
    { p_submission_ids: [...new Set(submissionIds)] },
  );
  if (error) throw new Error(error.message);
  return new Map<string, SubmissionNotificationDelivery>(
    ((data ?? []) as Record<string, unknown>[]).map((row) => [
      String(row.submission_id),
      mapSubmissionDelivery(row),
    ]),
  );
}

function mapSubmission(
  row: Record<string, unknown>,
  notificationDelivery: SubmissionNotificationDelivery | null = null,
) {
  return {
    id: row.id,
    productName: row.product_name,
    brandName: row.brand_name,
    instagramUsername: row.instagram_username,
    profileImageUrl: normalizeProfileImageUrl(row.profile_image_url),
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    purchaseUrl: row.purchase_url,
    discountInfo: row.discount_info,
    priceKrw: normalizePersistedPriceKrw(row.price_krw),
    summary: row.summary,
    instagramUrl: row.instagram_url,
    imageUrls: row.image_urls ?? [],
    mediaItems: row.media_items ?? [],
    postAudioUrl: row.post_audio_url,
    postAudioStartTimeMs: row.post_audio_start_time_ms,
    postAudioDurationMs: row.post_audio_duration_ms,
    reporterName: row.reporter_name,
    reporterContact: row.reporter_contact,
    isAnonymous: row.is_anonymous,
    contentHash: row.content_hash,
    status: row.status,
    adminMemo: row.admin_memo,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    groupBuyId: row.group_buy_id,
    isHomeBanner: row.is_home_banner,
    homeBannerStartDate: row.home_banner_start_date,
    homeBannerEndDate: row.home_banner_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notificationDelivery,
  };
}

function relatedInfluencerRecord(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const relatedInfluencer = Array.isArray(row.influencer)
    ? row.influencer[0]
    : row.influencer;
  return relatedInfluencer && typeof relatedInfluencer === "object"
    ? (relatedInfluencer as Record<string, unknown>)
    : null;
}

function relatedRawPostRecord(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const relatedRawPost = Array.isArray(row.raw_post)
    ? row.raw_post[0]
    : row.raw_post;
  return relatedRawPost && typeof relatedRawPost === "object"
    ? (relatedRawPost as Record<string, unknown>)
    : null;
}

function mapGroupBuy(row: Record<string, unknown>) {
  const influencer = relatedInfluencerRecord(row);
  const rawPost = relatedRawPostRecord(row);

  return {
    id: row.id,
    productName: row.product_name,
    brandName: row.brand_name,
    instagramUsername:
      row.instagram_username ?? influencer?.instagram_username ?? null,
    influencerId: row.influencer_id,
    profileImageUrl: normalizeProfileImageUrl(influencer?.profile_image_url),
    originalPostUrl:
      typeof rawPost?.post_url === "string" ? rawPost.post_url : null,
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    purchaseUrl: row.purchase_url,
    discountInfo: row.discount_info,
    priceKrw: normalizePersistedPriceKrw(row.price_krw),
    summary: row.summary,
    thumbnailUrl: row.thumbnail_url,
    videoUrl: row.video_url,
    mediaUrls: row.media_urls ?? [],
    mediaItems: row.media_items ?? [],
    mediaType: row.media_type,
    postAudioUrl: row.post_audio_url,
    postAudioStartTimeMs: row.post_audio_start_time_ms,
    postAudioDurationMs: row.post_audio_duration_ms,
    confidence: row.confidence,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    collectionReviewStatus: row.collection_review_status,
    collectionProposalSnapshot: row.collection_proposal_snapshot,
    collectionReviewedSnapshot: row.collection_reviewed_snapshot,
    collectionRulesetVersion: row.collection_ruleset_version,
    collectionHikerUsed: row.collection_hiker_used === true,
    collectionHikerLookupAt: row.collection_hiker_lookup_at,
    sourceType: row.source_type,
    submissionId: row.submission_id,
    isAllDay: row.is_all_day,
    isMonthlyFeatured: row.is_monthly_featured,
    monthlyFeaturedRank: row.monthly_featured_rank,
    isHomeBanner: row.is_home_banner,
    homeBannerStartDate: row.home_banner_start_date,
    homeBannerEndDate: row.home_banner_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listSubmissions(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const page = listParam(params, "page", 1);
  const limit = Math.min(listParam(params, "limit", 30), 100);
  const start = (page - 1) * limit;
  const status = str(params?.status);
  const q = sanitizeSearch(str(params?.q));

  let query = supabase
    .from("gonggu_submissions")
    .select(SUBMISSION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  if (status && status !== "ALL") query = query.eq("status", status);
  if (q) {
    query = query.or(
      `product_name.ilike.%${q}%,brand_name.ilike.%${q}%,instagram_url.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const deliveries = await getSubmissionNotificationDeliveries(
    supabase,
    rows.map((row) => String(row.id)),
  );
  return {
    items: rows.map((row) =>
      mapSubmission(row, deliveries.get(String(row.id)) ?? null),
    ),
    total: count ?? 0,
  };
}

async function listGroupBuys(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const page = listParam(params, "page", 1);
  const limit = Math.min(listParam(params, "limit", 30), 100);
  const start = (page - 1) * limit;
  const status = str(params?.status);
  const q = sanitizeSearch(str(params?.q));
  const sourceType = str(params?.sourceType);
  const reviewStatus = collectionReviewFilter(params?.collectionReviewStatus);

  let query = supabase
    .from("group_buys")
    .select(GROUP_BUY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  if (status && status !== "ALL") query = query.eq("status", status);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (reviewStatus) {
    query = query.eq("collection_review_status", reviewStatus);
  }
  if (q) query = query.or(`product_name.ilike.%${q}%,brand_name.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    items: (data ?? []).map((row) => mapGroupBuy(row)),
    total: count ?? 0,
  };
}

async function listGroupBuyRequests(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const page = Math.min(
    Math.floor(listParam(params, "page", 1)),
    1_000_000,
  );
  const limit = Math.min(Math.floor(listParam(params, "limit", 30)), 100);
  const status = str(params?.status);
  const q = sanitizeSearch(str(params?.q));
  const { data, error } = await supabase.rpc("get_admin_group_buy_requests", {
    p_page: page,
    p_limit_count: limit,
    p_status: status,
    p_query: q,
  });

  if (error) {
    console.error("Failed to list group-buy requests", error);
    throw new Error("공구 요청 목록을 불러오지 못했습니다.");
  }

  return mapAdminGroupBuyRequestList(data);
}

function adminGroupBuyRequestStatus(
  value: unknown,
): AdminGroupBuyRequestStatus {
  if (value === "OPEN" || value === "FULFILLED" || value === "HIDDEN") {
    return value;
  }
  throw new Error("공구 요청 상태가 올바르지 않습니다.");
}

async function rejectGroupBuyRequest(supabase: AdminClient, id: string) {
  const { data: existing, error: findError } = await supabase
    .from("group_buy_requests")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!existing) {
    throw new AdminRequestError(
      "공구 요청을 찾을 수 없습니다.",
      404,
      "GROUP_BUY_REQUEST_NOT_FOUND",
    );
  }

  const transition = groupBuyRequestRejectionTransition(
    adminGroupBuyRequestStatus(existing.status),
  );
  if (transition === "IDEMPOTENT") return { id, status: "HIDDEN" as const };
  if (transition === "CONFLICT") {
    throw new AdminRequestError(
      "이미 공구 등록 처리된 요청입니다.",
      409,
      "GROUP_BUY_REQUEST_ALREADY_COMPLETED",
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("group_buy_requests")
    .update({ status: "HIDDEN" })
    .eq("id", id)
    .eq("status", "OPEN")
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) {
    throw new AdminRequestError(
      "다른 검수 작업이 먼저 완료되었습니다.",
      409,
      "GROUP_BUY_REQUEST_ALREADY_COMPLETED",
    );
  }

  return { id, status: "HIDDEN" as const };
}

async function dashboard(supabase: AdminClient) {
  const [
    submissions,
    pending,
    approved,
    rejected,
    groupBuys,
    activeGroupBuys,
    users,
  ] = await Promise.all([
    supabase
      .from("gonggu_submissions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("gonggu_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("gonggu_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "APPROVED"),
    supabase
      .from("gonggu_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "REJECTED"),
    supabase.from("group_buys").select("id", { count: "exact", head: true }),
    supabase
      .from("group_buys")
      .select("id", { count: "exact", head: true })
      .eq("status", "APPROVED"),
    supabase.from("users").select("id", { count: "exact", head: true }),
  ]);

  for (const result of [
    submissions,
    pending,
    approved,
    rejected,
    groupBuys,
    activeGroupBuys,
    users,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const [recentPending, recentUsers, recentGroupBuys, categoryDist] =
    await Promise.all([
      listSubmissions(supabase, { page: 1, limit: 6, status: "PENDING" }),
      supabase
        .from("users")
        .select(USER_SELECT)
        .order("created_at", { ascending: false })
        .range(0, 4),
      supabase
        .from("group_buys")
        .select(GROUP_BUY_SELECT)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .range(0, 4),
      supabase.from("group_buys").select("category").eq("status", "APPROVED"),
    ]);

  if (recentUsers.error) throw new Error(recentUsers.error.message);
  if (recentGroupBuys.error) throw new Error(recentGroupBuys.error.message);
  if (categoryDist.error) throw new Error(categoryDist.error.message);

  const categoryCounts: Record<string, number> = {};
  for (const row of categoryDist.data ?? []) {
    const cat = (row as Record<string, unknown>).category as string | null;
    const key = cat ?? "미지정";
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
  }

  return {
    totals: {
      submissions: submissions.count ?? 0,
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      groupBuys: groupBuys.count ?? 0,
      activeGroupBuys: activeGroupBuys.count ?? 0,
      users: users.count ?? 0,
    },
    pendingQueue: recentPending.items,
    recentUsers: (recentUsers.data ?? []).map((row) => mapAdminUser(row)),
    recentGroupBuys: (recentGroupBuys.data ?? []).map((row) =>
      mapGroupBuy(row),
    ),
    categoryDistribution: categoryCounts,
  };
}

async function updateSubmission(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
) {
  const { data: existing, error: findError } = await supabase
    .from("gonggu_submissions")
    .select(
      "instagram_username, profile_image_url, is_home_banner, home_banner_start_date, home_banner_end_date",
    )
    .eq("id", id)
    .single();
  if (findError) throw new Error(findError.message);

  const patch = compact(normalizeSubmissionPatch(body, existing));
  if (
    hasOwn(body, "instagramUsername") &&
    hasInstagramOwnerChanged(
      existing.instagram_username,
      body.instagramUsername,
    ) &&
    !hasOwn(body, "profileImageUrl")
  ) {
    patch.profile_image_url = null;
  }

  const { data, error } = await supabase
    .from("gonggu_submissions")
    .update(patch)
    .eq("id", id)
    .select(SUBMISSION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapSubmission(data);
}

async function approveSubmission(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
  adminId: string,
) {
  const { data: existing, error: findError } = await supabase
    .from("gonggu_submissions")
    .select(SUBMISSION_SELECT)
    .eq("id", id)
    .single();

  if (findError) throw new Error(findError.message);
  if (!existing) throw new Error("제보를 찾을 수 없습니다.");
  if (existing.status !== "PENDING") {
    throw new Error(`이미 ${existing.status} 처리된 제보입니다.`);
  }

  const patch = compact(normalizeSubmissionPatch(body, existing));
  const requestedInstagramUsername = hasOwn(body, "instagramUsername")
    ? body.instagramUsername
    : existing.instagram_username;
  const ownerChanged = hasInstagramOwnerChanged(
    existing.instagram_username,
    requestedInstagramUsername,
  );
  if (ownerChanged && !hasOwn(body, "profileImageUrl")) {
    patch.profile_image_url = null;
  }
  const priceTouched = hasOwn(body, "priceKrw") || hasOwn(body, "price_krw");
  const productName = str(body.productName) ?? str(existing.product_name);
  if (!productName || productName.length < 2) {
    throw new Error("제품명을 입력해주세요.");
  }
  const existingProfileImageUrl = normalizeProfileImageUrl(
    existing.profile_image_url,
  );

  const instagramUsername = parseInstagramUsernameWrite(
    requestedInstagramUsername,
  );
  const profileImageValue = hasOwn(body, "profileImageUrl")
    ? body.profileImageUrl
    : !ownerChanged && existingProfileImageUrl
      ? existingProfileImageUrl
      : undefined;
  const profileImageWrite = resolveCanonicalProfileImageWriteIntent(
    profileImageValue,
    hasOwn(body, "profileImageUrl") || Boolean(profileImageValue),
    ownerChanged,
  );

  const groupBuyPayload = compact({
    product_name: productName,
    brand_name: hasOwn(body, "brandName")
      ? str(body.brandName)
      : existing.brand_name,
    category: hasOwn(body, "category") ? str(body.category) : existing.category,
    start_date: hasOwn(body, "startDate")
      ? str(body.startDate)
      : existing.start_date,
    end_date: hasOwn(body, "endDate") ? str(body.endDate) : existing.end_date,
    purchase_url: hasOwn(body, "purchaseUrl")
      ? str(body.purchaseUrl)
      : existing.purchase_url,
    discount_info: hasOwn(body, "discountInfo")
      ? str(body.discountInfo)
      : existing.discount_info,
    price_krw: priceTouched ? patch.price_krw : existing.price_krw,
    summary: hasOwn(body, "summary") ? str(body.summary) : existing.summary,
    thumbnail_url: str(body.thumbnailUrl),
    video_url: str(body.videoUrl),
    media_urls: hasOwn(body, "mediaUrls")
      ? normalizeMediaUrls(body.mediaUrls)
      : [],
    media_items: hasOwn(body, "mediaItems")
      ? normalizeMediaItems(body.mediaItems)
      : existing.media_items,
    media_type: str(body.mediaType),
    post_audio_url: hasOwn(patch, "post_audio_url")
      ? patch.post_audio_url
      : existing.post_audio_url,
    post_audio_start_time_ms: hasOwn(patch, "post_audio_start_time_ms")
      ? patch.post_audio_start_time_ms
      : existing.post_audio_start_time_ms,
    post_audio_duration_ms: hasOwn(patch, "post_audio_duration_ms")
      ? patch.post_audio_duration_ms
      : existing.post_audio_duration_ms,
    post_audio_checked_at: hasOwn(patch, "post_audio_checked_at")
      ? patch.post_audio_checked_at
      : existing.post_audio_checked_at,
    is_all_day: hasOwn(body, "isAllDay") ? bool(body.isAllDay) : false,
    is_monthly_featured: hasOwn(body, "isMonthlyFeatured")
      ? bool(body.isMonthlyFeatured)
      : false,
    monthly_featured_rank: hasOwn(body, "monthlyFeaturedRank")
      ? normalizeMonthlyFeaturedRank(body.monthlyFeaturedRank)
      : null,
    is_home_banner: hasOwn(body, "isHomeBanner")
      ? patch.is_home_banner
      : existing.is_home_banner,
    home_banner_start_date: hasOwn(patch, "home_banner_start_date")
      ? patch.home_banner_start_date
      : existing.home_banner_start_date,
    home_banner_end_date: hasOwn(patch, "home_banner_end_date")
      ? patch.home_banner_end_date
      : existing.home_banner_end_date,
    confidence: hasOwn(body, "confidence") ? num(body.confidence, 0.9) : 0.9,
  });

  const groupBuyId = crypto.randomUUID();
  const { error: finalizeError } = await supabase.rpc(
    "finalize_gonggu_submission_approval",
    {
      p_submission_id: id,
      p_group_buy_id: groupBuyId,
      p_admin_id: adminId,
      p_expected_submission_updated_at: existing.updated_at,
      p_group_buy_payload: groupBuyPayload,
      p_submission_patch: patch,
      p_instagram_username: instagramUsername,
      p_profile_image_url: profileImageWrite.profileImageUrl,
      p_update_profile_image: profileImageWrite.shouldUpdate,
    },
  );
  if (finalizeError) {
    throw new Error(finalizeError.message);
  }

  const [submissionResponse, groupBuyResponse] = await Promise.all([
    supabase
      .from("gonggu_submissions")
      .select(SUBMISSION_SELECT)
      .eq("id", id)
      .single(),
    supabase
      .from("group_buys")
      .select(GROUP_BUY_SELECT)
      .eq("id", groupBuyId)
      .single(),
  ]);
  if (submissionResponse.error) {
    throw new Error(submissionResponse.error.message);
  }
  if (groupBuyResponse.error) {
    throw new Error(groupBuyResponse.error.message);
  }
  const submission = submissionResponse.data;
  const approvedGroupBuy = groupBuyResponse.data;
  let notificationDelivery: SubmissionApprovalDeliverySummary;
  try {
    notificationDelivery = await deliverPendingSubmissionApprovalPushes(
      supabase,
      { submissionId: id },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "submission_approval_push_queue_failed",
        submissionId: id,
        groupBuyId: approvedGroupBuy.id,
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "unknown error",
      }),
    );
    notificationDelivery = {
      status: "retrying",
      queued: 0,
      sent: 0,
      skipped: 0,
      retrying: 1,
      failed: 0,
    };
  }
  return {
    submission: mapSubmission(
      submission,
      (await getSubmissionNotificationDeliveries(supabase, [id])).get(id) ??
        null,
    ),
    groupBuy: mapGroupBuy(approvedGroupBuy),
    notificationDelivery,
  };
}

async function retrySubmissionApprovalNotification(
  supabase: AdminClient,
  id: string,
) {
  const { data: submission, error: findError } = await supabase
    .from("gonggu_submissions")
    .select(SUBMISSION_SELECT)
    .eq("id", id)
    .single();
  if (findError) throw new Error(findError.message);
  if (!submission) throw new Error("제보를 찾을 수 없습니다.");
  if (submission.status !== "APPROVED") {
    throw new Error("승인된 제보의 알림만 재시도할 수 있습니다.");
  }

  const { error: resetError } = await supabase
    .from("submission_approval_push_outbox")
    .update({
      status: "PENDING",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("submission_id", id)
    .in("status", ["FAILED", "RETRYING"]);
  if (resetError) throw new Error(resetError.message);

  const notificationDelivery = await deliverPendingSubmissionApprovalPushes(
    supabase,
    { submissionId: id },
  );
  const delivery =
    (await getSubmissionNotificationDeliveries(supabase, [id])).get(id) ?? null;
  return {
    submission: mapSubmission(submission, delivery),
    notificationDelivery,
  };
}

async function rejectSubmission(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
  adminId: string,
) {
  const reason = str(body.reason) ?? "관리자 반려";
  const { data, error } = await supabase
    .from("gonggu_submissions")
    .update({
      status: "REJECTED",
      admin_memo: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDING")
    .select(SUBMISSION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapSubmission(data);
}

async function listUsers(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const page = listParam(params, "page", 1);
  const limit = Math.min(listParam(params, "limit", 30), 100);
  const start = (page - 1) * limit;
  const q = sanitizeSearch(str(params?.q));

  let query = supabase
    .from("users")
    .select(USER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  if (q) query = query.or(`email.ilike.%${q}%,nickname.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    items: (data ?? []).map((row) => mapAdminUser(row)),
    total: count ?? 0,
  };
}

async function updateUser(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  let moderationStatus: "ACTIVE" | "SUSPENDED" | "BANNED" | null = null;
  if (hasOwn(body, "nickname")) patch.nickname = str(body.nickname);
  if (hasOwn(body, "fcmToken")) patch.fcm_token = str(body.fcmToken);
  if (hasOwn(body, "status")) {
    const status = str(body.status);
    if (status && !["ACTIVE", "SUSPENDED", "BANNED"].includes(status)) {
      throw new Error("유효하지 않은 상태입니다.");
    }
    moderationStatus = (status ?? "ACTIVE") as
      | "ACTIVE"
      | "SUSPENDED"
      | "BANNED";
    patch.status = moderationStatus;
  }

  const { data, error } = await supabase
    .from("users")
    .update(compact(patch))
    .eq("id", id)
    .select(USER_SELECT)
    .single();

  if (error) throw new Error(error.message);
  if (moderationStatus) {
    const { error: moderationError } = await supabase
      .from("comment_user_moderation")
      .upsert(
        {
          user_id: id,
          status: moderationStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (moderationError) throw new Error(moderationError.message);
  }
  return mapAdminUser(data);
}

function relatedCommentRecord(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function mapCommentModeration(row: Record<string, unknown>) {
  const product = relatedCommentRecord(row.group_buys);
  const reports = Array.isArray(row.comment_reports)
    ? row.comment_reports
    : [];
  const reportCount = reports.reduce((total, item) => {
    if (!item || typeof item !== "object") return total;
    const count = num((item as Record<string, unknown>).count, 0) ?? 0;
    return total + count;
  }, 0);
  const rawState = str(row.state);
  const state = [
    "VISIBLE",
    "HIDDEN",
    "DELETED",
    "ACCOUNT_ANONYMIZED",
  ].includes(rawState ?? "")
    ? rawState
    : "HIDDEN";

  return {
    id: String(row.id ?? ""),
    groupBuyId: String(row.group_buy_id ?? ""),
    productName: str(product?.product_name),
    parentId: str(row.parent_id),
    body: typeof row.body === "string" ? row.body : null,
    authorDisplayName: str(row.author_display_name),
    state,
    likeCount: num(row.like_count, 0) ?? 0,
    reportCount,
    contentVersion: num(row.content_version, 1) ?? 1,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    editedAt: typeof row.edited_at === "string" ? row.edited_at : null,
  };
}

async function listComments(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const page = listParam(params, "page", 1);
  const limit = Math.min(listParam(params, "limit", 30), 100);
  const start = (page - 1) * limit;
  const state = str(params?.state);
  const q = sanitizeSearch(str(params?.q));

  let query = supabase
    .from("group_buy_comments")
    .select(COMMENT_MODERATION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  if (state && state !== "ALL") query = query.eq("state", state);
  if (q) query = query.or(`body.ilike.%${q}%,author_display_name.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(
      mapCommentModeration,
    ),
    total: count ?? 0,
  };
}

async function updateCommentModeration(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
  adminId: string,
) {
  const nextState = str(body.state);
  if (nextState !== "VISIBLE" && nextState !== "HIDDEN") {
    throw new AdminRequestError(
      "댓글 상태는 VISIBLE 또는 HIDDEN이어야 합니다.",
      422,
      "INVALID_COMMENT_STATE",
    );
  }
  const reason = str(body.reason)?.slice(0, 500) ?? null;
  const expectedVersion = num(body.expectedVersion);
  const { data: existing, error: findError } = await supabase
    .from("group_buy_comments")
    .select("id,state,content_version")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!existing) {
    throw new AdminRequestError(
      "댓글을 찾을 수 없습니다.",
      404,
      "COMMENT_NOT_FOUND",
    );
  }
  const currentState = str(existing.state) ?? "HIDDEN";
  const currentVersion = num(existing.content_version, 1) ?? 1;
  if (expectedVersion !== null && expectedVersion !== currentVersion) {
    throw new AdminRequestError(
      "다른 운영자가 먼저 댓글을 변경했습니다. 새로고침 후 다시 시도해주세요.",
      409,
      "COMMENT_VERSION_CONFLICT",
    );
  }
  if (currentState === "DELETED" || currentState === "ACCOUNT_ANONYMIZED") {
    throw new AdminRequestError(
      "삭제된 댓글은 복원하거나 숨길 수 없습니다.",
      409,
      "COMMENT_TOMBSTONED",
    );
  }
  if (currentState === nextState) {
    const { data, error } = await supabase
      .from("group_buy_comments")
      .select(COMMENT_MODERATION_SELECT)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return mapCommentModeration(data as Record<string, unknown>);
  }

  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("group_buy_comments")
    .update({
      state: nextState,
      content_version: nextVersion,
      updated_at: now,
    })
    .eq("id", id)
    .eq("content_version", currentVersion)
    .select(COMMENT_MODERATION_SELECT)
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) {
    throw new AdminRequestError(
      "다른 운영자가 먼저 댓글을 변경했습니다. 새로고침 후 다시 시도해주세요.",
      409,
      "COMMENT_VERSION_CONFLICT",
    );
  }

  const { error: eventError } = await supabase
    .from("comment_moderation_events")
    .insert({
      comment_id: id,
      actor_id: adminId,
      action: nextState === "HIDDEN" ? "HIDE" : "RESTORE",
      reason,
      previous_state: currentState,
      next_state: nextState,
      content_version: nextVersion,
    });
  if (eventError) throw new Error(eventError.message);
  return mapCommentModeration(updated as Record<string, unknown>);
}

async function setGroupBuyCommentsEnabled(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
) {
  if (!hasOwn(body, "enabled") || typeof body.enabled !== "boolean") {
    throw new AdminRequestError(
      "enabled는 boolean이어야 합니다.",
      422,
      "INVALID_COMMENTS_ENABLED",
    );
  }
  const { data, error } = await supabase
    .from("group_buys")
    .update({ comments_enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,comments_enabled")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new AdminRequestError(
      "공구 상품을 찾을 수 없습니다.",
      404,
      "GROUP_BUY_NOT_FOUND",
    );
  }
  return {
    groupBuyId: String(data.id),
    commentsEnabled: Boolean(data.comments_enabled),
  };
}

type CdnRefreshStatusResponse = {
  items: CdnRefreshStatusRow[];
  summary: {
    total: number;
    expired: number;
    expiring: number;
    healthy: number;
    unknown: number;
    noCdn: number;
  };
};

async function listCdnRefreshStatus(
  supabase: AdminClient,
  params: AdminRequest["params"],
) {
  const limitCount = listParam(params, "limit", 50);
  const refreshWindowHours = num(params?.refreshWindowHours, 1) ?? 1;
  const statusFilter = str(params?.status) ?? null;

  const { data, error } = await supabase.rpc(
    "get_instagram_cdn_refresh_status",
    {
      limit_count: limitCount,
      refresh_window_hours: refreshWindowHours,
      status_filter: statusFilter,
    },
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const items = rows.map((row) => mapCdnRefreshStatusRow(row));

  // Most recent media_refreshed_at across all approved VIDEO group buys,
  // representing the last time the hourly batch actually refreshed a CDN URL.
  let lastRefreshedAt: string | null = null;
  const { data: lastRefreshRow, error: lastRefreshError } = await supabase
    .from("group_buys")
    .select("media_refreshed_at")
    .eq("status", "APPROVED")
    .eq("media_type", "VIDEO")
    .not("media_refreshed_at", "is", null)
    .order("media_refreshed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRefreshError) throw new Error(lastRefreshError.message);
  if (lastRefreshRow?.media_refreshed_at) {
    lastRefreshedAt = String(lastRefreshRow.media_refreshed_at);
  }

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.refreshStatus === "expired") acc.expired += 1;
      else if (item.refreshStatus === "expiring") acc.expiring += 1;
      else if (item.refreshStatus === "healthy") acc.healthy += 1;
      else if (item.refreshStatus === "unknown") acc.unknown += 1;
      else if (item.refreshStatus === "no_cdn") acc.noCdn += 1;
      return acc;
    },
    { total: 0, expired: 0, expiring: 0, healthy: 0, unknown: 0, noCdn: 0 },
  );

  return { items, summary, lastRefreshedAt };
}

async function triggerCdnRefresh(body: Record<string, unknown>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  const groupBuyId = str(body.groupBuyId);
  const mode = body.mode === "batch" ? "batch" : "single";

  const requestPayload: Record<string, unknown> =
    mode === "batch"
      ? {
          mode: "batch",
          limit: num(body.limit, 20),
          refreshWindowHours: num(body.refreshWindowHours, 1),
        }
      : { groupBuyId, force: bool(body.force, false) };

  if (mode === "single" && !groupBuyId) {
    throw new Error("groupBuyId is required for single refresh.");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/refresh-instagram-media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(requestPayload),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `CDN refresh failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function lookupHiker(body: Record<string, unknown>) {
  const url = str(body.url);
  if (!url) {
    throw new Error("인스타그램 URL을 입력해주세요.");
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${supabaseUrl}/functions/v1/hiker-lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Hiker lookup failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function collectionReviewStatusFromRow(
  row: Record<string, unknown>,
): CollectionReviewStatus {
  if (
    row.collection_review_status === "PENDING" ||
    row.collection_review_status === "APPROVED" ||
    row.collection_review_status === "REJECTED"
  ) {
    return row.collection_review_status;
  }
  return legacyCollectionReviewStatus(row.status);
}

async function automaticCollectionCandidate(supabase: AdminClient, id: string) {
  const { data, error } = await supabase
    .from("group_buys")
    .select(GROUP_BUY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new AdminRequestError(
      "자동수집 검수 항목을 찾을 수 없습니다.",
      404,
      "AUTO_COLLECTION_NOT_FOUND",
    );
  }
  if (data.source_type !== "PLAYWRIGHT_PUBLIC") {
    throw new AdminRequestError(
      "Playwright 자동수집 항목만 처리할 수 있습니다.",
      422,
      "NOT_AUTO_COLLECTION",
    );
  }
  return data as Record<string, unknown>;
}

function automaticReviewSnapshot(
  existing: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  const rawPost = relatedRawPostRecord(existing);
  const proposalSnapshot = existing.collection_proposal_snapshot;
  return buildReviewedCollectionSnapshot(
    {
      ...mapGroupBuy(existing),
      ...data,
      rawPostId: rawPost?.id,
      instagramPostId: rawPost?.instagram_post_id,
      originalPostUrl: rawPost?.post_url,
      takenAt: rawPost?.taken_at,
    },
    proposalSnapshot,
  );
}

function groupBuyProfileWrite(
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const ownerTouched =
    hasOwn(body, "instagramUsername") || hasOwn(body, "profileImageUrl");
  let instagramUsername: string | null = null;
  let profileImageWrite: ProfileImageWriteIntent = {
    shouldUpdate: false,
    profileImageUrl: null,
  };
  if (ownerTouched) {
    const existingInfluencer = relatedInfluencerRecord(existing);
    const existingInstagramUsername =
      normalizeInstagramUsername(existing.instagram_username) ??
      normalizeInstagramUsername(existingInfluencer?.instagram_username);
    const profileInput: Record<string, unknown> = {
      ...body,
      instagramUsername: hasOwn(body, "instagramUsername")
        ? body.instagramUsername
        : existingInstagramUsername,
    };
    const ownerChanged = hasInstagramOwnerChanged(
      existingInstagramUsername,
      profileInput.instagramUsername,
    );
    instagramUsername = parseInstagramUsernameWrite(
      profileInput.instagramUsername,
    );
    profileImageWrite = resolveCanonicalProfileImageWriteIntent(
      profileInput.profileImageUrl,
      hasOwn(body, "profileImageUrl"),
      ownerChanged,
    );
    delete patch.instagram_username;
  }

  return {
    expectedInfluencerId:
      typeof existing.influencer_id === "string"
        ? existing.influencer_id
        : null,
    instagramUsername,
    ownerTouched,
    profileImageUrl: profileImageWrite.profileImageUrl,
    updateProfileImage: profileImageWrite.shouldUpdate,
  };
}

async function persistGroupBuyPatchWithProfile(
  supabase: AdminClient,
  id: string,
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const profileWrite = groupBuyProfileWrite(existing, body, patch);

  const { error: updateError } = await supabase.rpc(
    "update_group_buy_with_influencer_profile",
    {
      p_group_buy_id: id,
      p_expected_influencer_id: profileWrite.expectedInfluencerId,
      p_patch: patch,
      p_owner_touched: profileWrite.ownerTouched,
      p_instagram_username: profileWrite.instagramUsername,
      p_profile_image_url: profileWrite.profileImageUrl,
      p_update_profile_image: profileWrite.updateProfileImage,
    },
  );
  if (updateError) throw new Error(updateError.message);

  const { data, error } = await supabase
    .from("group_buys")
    .select(GROUP_BUY_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function finalizeAutomaticCollectionApprovalWithProfile(
  supabase: AdminClient,
  id: string,
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
  adminId: string,
  reviewedSnapshot: CollectionReviewSnapshot,
) {
  const profileWrite = groupBuyProfileWrite(existing, body, patch);
  const { error: updateError } = await supabase.rpc(
    "finalize_automatic_collection_approval",
    {
      p_group_buy_id: id,
      p_expected_influencer_id: profileWrite.expectedInfluencerId,
      p_patch: patch,
      p_owner_touched: profileWrite.ownerTouched,
      p_instagram_username: profileWrite.instagramUsername,
      p_profile_image_url: profileWrite.profileImageUrl,
      p_update_profile_image: profileWrite.updateProfileImage,
      p_admin_id: adminId,
      p_reviewed_snapshot: reviewedSnapshot,
    },
  );
  if (updateError?.code === "40001") {
    throw new AdminRequestError(
      "다른 검수 작업이 먼저 완료되었습니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }
  if (updateError) throw new Error(updateError.message);

  const { data, error } = await supabase
    .from("group_buys")
    .select(GROUP_BUY_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function approveAutomaticCollection(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
  adminId: string,
) {
  const existing = await automaticCollectionCandidate(supabase, id);
  const transition = reviewTransition(
    collectionReviewStatusFromRow(existing),
    "APPROVED",
  );
  if (transition === "IDEMPOTENT") return mapGroupBuy(existing);
  if (transition === "CONFLICT") {
    throw new AdminRequestError(
      "이미 반려된 자동수집 항목입니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }

  const finalData = reviewedData(body);
  validateApprovalData(finalData);
  const patch = compact(normalizeGroupBuyPatch(finalData, existing));
  delete patch.status;
  const reviewedSnapshot = automaticReviewSnapshot(existing, finalData);

  return mapGroupBuy(
    await finalizeAutomaticCollectionApprovalWithProfile(
      supabase,
      id,
      existing,
      finalData,
      patch,
      adminId,
      reviewedSnapshot,
    ),
  );
}

async function rejectAutomaticCollection(
  supabase: AdminClient,
  id: string,
  body: Record<string, unknown>,
  adminId: string,
) {
  const existing = await automaticCollectionCandidate(supabase, id);
  const transition = reviewTransition(
    collectionReviewStatusFromRow(existing),
    "REJECTED",
  );
  if (transition === "IDEMPOTENT") return mapGroupBuy(existing);
  if (transition === "CONFLICT") {
    throw new AdminRequestError(
      "이미 공구 등록된 자동수집 항목입니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }

  const finalData = reviewedData(body);
  const reason = normalizeRejectionReason(body);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("group_buys")
    .update({
      status: "REJECTED",
      rejection_reason: reason,
      reviewed_at: now,
      reviewed_by: adminId,
      collection_review_status: "REJECTED",
      collection_reviewed_snapshot: automaticReviewSnapshot(
        existing,
        finalData,
      ),
      updated_at: now,
    })
    .eq("id", id)
    .eq("collection_review_status", "PENDING")
    .select(GROUP_BUY_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new AdminRequestError(
      "다른 검수 작업이 먼저 완료되었습니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }
  return mapGroupBuy(data);
}

async function lookupAutomaticCollectionHiker(
  supabase: AdminClient,
  id: string,
) {
  const existing = await automaticCollectionCandidate(supabase, id);
  if (collectionReviewStatusFromRow(existing) !== "PENDING") {
    throw new AdminRequestError(
      "처리 완료된 자동수집 히스토리는 Hiker 조회를 할 수 없습니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }
  const rawPost = relatedRawPostRecord(existing);
  const url = automaticInstagramPostUrl(rawPost?.post_url);
  if (!url) {
    throw new AdminRequestError(
      "조회 가능한 Instagram 원본 링크가 없습니다.",
      422,
      "INVALID_INSTAGRAM_SOURCE",
    );
  }

  const result = await lookupHiker({ url });
  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("group_buys")
    .update({
      collection_hiker_used: true,
      collection_hiker_lookup_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("collection_review_status", "PENDING")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) {
    throw new AdminRequestError(
      "Hiker 조회 중 다른 검수 작업이 먼저 완료되었습니다.",
      409,
      "REVIEW_ALREADY_COMPLETED",
    );
  }
  return result;
}

async function handleAdminRequest(req: AdminRequest, adminId: string) {
  const supabase = createAdminClient();
  const { path, method, body = {}, params } = req;

  if (path === "/admin/dashboard" && method === "GET") {
    return dashboard(supabase);
  }
  if (path === "/admin/hiker-lookup" && method === "POST") {
    return lookupHiker(body);
  }
  if (path === "/admin/submissions" && method === "GET") {
    return listSubmissions(supabase, params);
  }
  if (
    path.startsWith("/admin/submissions/") &&
    path.endsWith("/notification/retry") &&
    method === "POST"
  ) {
    return retrySubmissionApprovalNotification(supabase, path.split("/")[3]);
  }
  if (
    path.startsWith("/admin/submissions/") &&
    path.endsWith("/approve") &&
    method === "POST"
  ) {
    return approveSubmission(supabase, path.split("/")[3], body, adminId);
  }
  if (
    path.startsWith("/admin/submissions/") &&
    path.endsWith("/reject") &&
    method === "POST"
  ) {
    return rejectSubmission(supabase, path.split("/")[3], body, adminId);
  }
  if (path.startsWith("/admin/submissions/") && method === "PATCH") {
    return updateSubmission(
      supabase,
      path.replace("/admin/submissions/", ""),
      body,
    );
  }
  if (path === "/admin/group-buys" && method === "GET") {
    return listGroupBuys(supabase, params);
  }
  if (
    path.startsWith("/admin/group-buys/") &&
    path.endsWith("/hiker-lookup") &&
    method === "POST"
  ) {
    return lookupAutomaticCollectionHiker(supabase, path.split("/")[3]);
  }
  if (
    path.startsWith("/admin/group-buys/") &&
    path.endsWith("/approve") &&
    method === "POST"
  ) {
    return approveAutomaticCollection(
      supabase,
      path.split("/")[3],
      body,
      adminId,
    );
  }
  if (
    path.startsWith("/admin/group-buys/") &&
    path.endsWith("/reject") &&
    method === "POST"
  ) {
    return rejectAutomaticCollection(
      supabase,
      path.split("/")[3],
      body,
      adminId,
    );
  }
  if (path === "/admin/group-buy-requests" && method === "GET") {
    return listGroupBuyRequests(supabase, params);
  }
  if (
    path.startsWith("/admin/group-buy-requests/") &&
    path.endsWith("/reject") &&
    method === "POST"
  ) {
    return rejectGroupBuyRequest(supabase, path.split("/")[3]);
  }
  if (path === "/admin/users" && method === "GET") {
    return listUsers(supabase, params);
  }
  if (path.startsWith("/admin/users/") && method === "PATCH") {
    return updateUser(supabase, path.replace("/admin/users/", ""), body);
  }
  if (path === "/admin/comments" && method === "GET") {
    return listComments(supabase, params);
  }
  if (path.startsWith("/admin/comments/") && method === "PATCH") {
    return updateCommentModeration(
      supabase,
      path.replace("/admin/comments/", ""),
      body,
      adminId,
    );
  }
  if (path === "/admin/notifications" && method === "POST") {
    return sendPushNotification(supabase, body);
  }
  if (
    path.startsWith("/admin/group-buys/") &&
    path.endsWith("/comments") &&
    method === "PATCH"
  ) {
    return setGroupBuyCommentsEnabled(
      supabase,
      path.split("/")[3],
      body,
    );
  }
  if (path.startsWith("/admin/group-buys/") && method === "PATCH") {
    const id = path.replace("/admin/group-buys/", "");
    const { data: existing, error: findError } = await supabase
      .from("group_buys")
      .select(
        "instagram_username, influencer_id, influencer:influencer_id(instagram_username), is_home_banner, home_banner_start_date, home_banner_end_date, source_type, status, collection_review_status",
      )
      .eq("id", id)
      .single();
    if (findError) throw new Error(findError.message);

    const groupBuyPatch = protectPendingAutomaticCatalogPatch(
      existing.source_type,
      collectionReviewStatusFromRow(existing),
      compact(normalizeGroupBuyPatch(body, existing)),
    );
    return mapGroupBuy(
      await persistGroupBuyPatchWithProfile(
        supabase,
        id,
        existing,
        body,
        groupBuyPatch,
      ),
    );
  }

  if (path === "/admin/cdn-refresh" && method === "GET") {
    return listCdnRefreshStatus(supabase, params);
  }
  if (path === "/admin/cdn-refresh" && method === "POST") {
    return triggerCdnRefresh(body);
  }
  throw new Error(`Unknown route: ${method} ${path}`);
}

export async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let adminReq: AdminRequest;
  try {
    adminReq = (await req.json()) as AdminRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!adminReq.path || !adminReq.method) {
    return json({ error: "path and method are required" }, 400);
  }

  try {
    const supabase = createAdminClient();
    const admin = await requireAdmin(req, supabase);
    if ("error" in admin) return admin.error;

    const data = await handleAdminRequest(adminReq, admin.user.id);
    return json({ data });
  } catch (err) {
    if (err instanceof CollectionReviewContractError) {
      return json({ error: err.message, code: "VALIDATION_ERROR" }, 422);
    }
    if (err instanceof AdminRequestError) {
      return json({ error: err.message, code: err.code }, err.status);
    }
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[admin-api] Error:", message);
    return json({ error: message }, 500);
  }
}

if (import.meta.main) serve(handler);
