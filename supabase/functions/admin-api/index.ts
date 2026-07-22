// ============================================================================
// Edge Function: admin-api
// Purpose: Authenticated admin operations for GongGu Wish.
//
// Invoke: POST /functions/v1/admin-api  { path, method, body?, params? }
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  normalizeCommercePatch,
  normalizePersistedPriceKrw,
} from "./commerceFields.ts";
import {
  type CdnRefreshStatusRow,
  mapCdnRefreshStatusRow,
} from "./cdnRefreshStatus.ts";
import { normalizeMonthlyFeaturedRank } from "./monthlyFeaturedRank.ts";
import { sendPushNotification } from "./pushNotifications.ts";
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SUBMISSION_SELECT = `
  id,
  product_name,
  brand_name,
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
  confidence,
  status,
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

function normalizeSubmissionPatch(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(body, "productName")) patch.product_name = str(body.productName);
  if (hasOwn(body, "brandName")) patch.brand_name = str(body.brandName);
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
  Object.assign(patch, normalizeCommercePatch(body, existing));

  return patch;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function mapSubmission(row: Record<string, unknown>) {
  return {
    id: row.id,
    productName: row.product_name,
    brandName: row.brand_name,
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
  };
}

function mapGroupBuy(row: Record<string, unknown>) {
  return {
    id: row.id,
    productName: row.product_name,
    brandName: row.brand_name,
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
    confidence: row.confidence,
    status: row.status,
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
  return {
    items: (data ?? []).map((row) => mapSubmission(row)),
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

  let query = supabase
    .from("group_buys")
    .select(GROUP_BUY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  if (status && status !== "ALL") query = query.eq("status", status);
  if (q) query = query.or(`product_name.ilike.%${q}%,brand_name.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    items: (data ?? []).map((row) => mapGroupBuy(row)),
    total: count ?? 0,
  };
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
    .select("is_home_banner, home_banner_start_date, home_banner_end_date")
    .eq("id", id)
    .single();
  if (findError) throw new Error(findError.message);

  const { data, error } = await supabase
    .from("gonggu_submissions")
    .update(compact(normalizeSubmissionPatch(body, existing)))
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
  const priceTouched = hasOwn(body, "priceKrw") || hasOwn(body, "price_krw");
  const productName = str(body.productName) ?? str(existing.product_name);
  if (!productName || productName.length < 2) {
    throw new Error("제품명을 입력해주세요.");
  }

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
    source_type: "SUBMISSION",
    submission_id: id,
    status: "APPROVED",
    confidence: hasOwn(body, "confidence") ? num(body.confidence, 0.9) : 0.9,
    updated_at: new Date().toISOString(),
  });

  const { data: groupBuy, error: groupBuyError } = await supabase
    .from("group_buys")
    .insert({
      id: crypto.randomUUID(),
      ...groupBuyPayload,
      created_at: new Date().toISOString(),
    })
    .select(GROUP_BUY_SELECT)
    .single();

  if (groupBuyError) throw new Error(groupBuyError.message);

  const { data: submission, error: submissionError } = await supabase
    .from("gonggu_submissions")
    .update({
      ...patch,
      status: "APPROVED",
      group_buy_id: groupBuy.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      admin_memo: str(body.adminMemo),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SUBMISSION_SELECT)
    .single();

  if (submissionError) {
    await supabase.from("group_buys").delete().eq("id", groupBuy.id);
    throw new Error(submissionError.message);
  }
  return {
    submission: mapSubmission(submission),
    groupBuy: mapGroupBuy(groupBuy),
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
  if (hasOwn(body, "nickname")) patch.nickname = str(body.nickname);
  if (hasOwn(body, "fcmToken")) patch.fcm_token = str(body.fcmToken);
  if (hasOwn(body, "status")) {
    const status = str(body.status);
    if (status && !["ACTIVE", "SUSPENDED", "BANNED"].includes(status)) {
      throw new Error("유효하지 않은 상태입니다.");
    }
    patch.status = status ?? "ACTIVE";
  }

  const { data, error } = await supabase
    .from("users")
    .update(compact(patch))
    .eq("id", id)
    .select(USER_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapAdminUser(data);
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
  if (path === "/admin/users" && method === "GET") {
    return listUsers(supabase, params);
  }
  if (path.startsWith("/admin/users/") && method === "PATCH") {
    return updateUser(supabase, path.replace("/admin/users/", ""), body);
  }
  if (path === "/admin/notifications" && method === "POST") {
    return sendPushNotification(supabase, body);
  }
  if (path.startsWith("/admin/group-buys/") && method === "PATCH") {
    const id = path.replace("/admin/group-buys/", "");
    const { data: existing, error: findError } = await supabase
      .from("group_buys")
      .select("is_home_banner, home_banner_start_date, home_banner_end_date")
      .eq("id", id)
      .single();
    if (findError) throw new Error(findError.message);

    const { data, error } = await supabase
      .from("group_buys")
      .update(compact(normalizeGroupBuyPatch(body, existing)))
      .eq("id", id)
      .select(GROUP_BUY_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapGroupBuy(data);
  }

  if (path === "/admin/cdn-refresh" && method === "GET") {
    return listCdnRefreshStatus(supabase, params);
  }
  if (path === "/admin/cdn-refresh" && method === "POST") {
    return triggerCdnRefresh(body);
  }
  throw new Error(`Unknown route: ${method} ${path}`);
}

serve(async (req: Request) => {
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
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[admin-api] Error:", message);
    return json({ error: message }, 500);
  }
});
