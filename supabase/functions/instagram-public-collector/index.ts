import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { parseSubmissionCaption } from "../../../packages/shared/src/utils/captionParser.ts";
import {
  classifyKoreaCaption,
  isGroupBuyCandidate,
} from "../_shared/instagram-public-rules.ts";
import {
  AUTOMATIC_COLLECTION_RULESET_VERSION,
  buildCollectionReviewSnapshot,
  legacyCollectionReviewStatus,
  normalizeProfileLinkCandidates,
  type CollectionReviewProfileLinkCandidate,
  type CollectionReviewStatus,
} from "../_shared/automaticCollectionReview.ts";

const MAX_BODY_BYTES = 1024 * 1024;
const ACTIONS = ["watchlist", "collect", "status"] as const;
const STATUSES = ["SUCCESS", "ERROR", "BLOCKED"] as const;
type CollectorAction = (typeof ACTIONS)[number];
type CollectorStatus = (typeof STATUSES)[number];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Collector-Token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CollectedPost = {
  instagramPostId: string;
  influencerUsername: string;
  caption: string;
  postUrl: string;
  imageUrl: string | null;
  takenAt: string;
  collectedAt: string;
  collectionSource: "PLAYWRIGHT_PUBLIC";
  profileLinkCandidates: CollectionReviewProfileLinkCandidate[];
};

type ParsedAutomaticCaption = ReturnType<typeof parseSubmissionCaption>;
type ExistingCampaign = {
  id: string;
  raw_post_id: string | null;
  status: string;
  collection_review_status: CollectionReviewStatus;
};

export function buildAutomaticProposalSnapshot(
  post: CollectedPost,
  rawPostId: string,
  parsed: ParsedAutomaticCaption,
) {
  const mediaUrls = post.imageUrl ? [post.imageUrl] : [];
  return buildCollectionReviewSnapshot({
    rawPostId,
    instagramPostId: post.instagramPostId,
    originalPostUrl: post.postUrl,
    takenAt: post.takenAt,
    productName: parsed.productName,
    brandName: parsed.brandName,
    instagramUsername: post.influencerUsername,
    category: null,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    purchaseUrl: parsed.purchaseUrl,
    profileLinkCandidates: post.profileLinkCandidates,
    discountInfo: parsed.discountInfo,
    priceKrw: parsed.priceKrw,
    summary: post.caption.slice(0, 500),
    thumbnailUrl: post.imageUrl,
    mediaUrls,
    mediaItems: mediaUrls.map((url) => ({
      url,
      mediaType: "IMAGE",
      thumbnailUrl: null,
    })),
    mediaType: post.imageUrl ? "IMAGE" : null,
    confidence: 0.5,
  });
}

const AUTOMATIC_PRODUCT_CTA_RE =
  /^(?:공구|공동구매|마켓|특가|할인|프로모션|구매|판매|링크|마감|오픈|프로필|스토리|dm|디엠)(?:\s|[:：\-–—!?]|은|는|이|가|을|를|의|부터|까지)/iu;
const GENERIC_HASHTAG_RE =
  /^(?:공구|공동구매|마켓|특가|할인|세일|추천|이벤트)$/iu;
const GENERIC_PRODUCT_RE =
  /^(?:공구|공동구매|마켓|특가|할인|프로모션|상품명\s*확인\s*필요)$/iu;
const TRACKING_QUERY_RE = /^(?:utm_[^=]+|fbclid|gclid|dclid|mc_cid|mc_eid)$/iu;

class CollectorInputError extends Error {}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function constantTimeTokenMatches(expected: string, provided: string) {
  if (!expected || !provided || expected.length !== provided.length)
    return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

function requireCollectorToken(request: Request) {
  const expected = Deno.env.get("INSTAGRAM_COLLECTOR_TOKEN") ?? "";
  const provided = request.headers.get("X-Collector-Token") ?? "";
  return expected && constantTimeTokenMatches(expected, provided);
}

export function normalizeCollectorAction(
  body: Record<string, unknown>,
): CollectorAction {
  if (
    typeof body.action !== "string" ||
    !ACTIONS.includes(body.action as CollectorAction)
  ) {
    throw new CollectorInputError(
      "action must be watchlist, collect, or status",
    );
  }
  return body.action as CollectorAction;
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new CollectorInputError(`${field} is invalid`);
  }
  return value.trim();
}

function isoDate(value: unknown, field: string) {
  const parsed = requiredString(value, field, 80);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new CollectorInputError(`${field} is invalid`);
  }
  return parsed;
}

function instagramPostUrl(value: unknown) {
  let parsed: URL;
  try {
    parsed = new URL(requiredString(value, "postUrl", 500));
  } catch {
    throw new CollectorInputError(
      "postUrl must be a canonical Instagram post URL",
    );
  }
  if (
    parsed.protocol !== "https:" ||
    !["www.instagram.com", "instagram.com", "instagr.am"].includes(
      parsed.hostname.toLowerCase(),
    ) ||
    parsed.search ||
    parsed.hash ||
    !/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)
  ) {
    throw new CollectorInputError(
      "postUrl must be a canonical Instagram post URL",
    );
  }
  return parsed.toString();
}

export function normalizeCollectedPost(
  body: Record<string, unknown>,
): CollectedPost {
  if (body.collectionSource !== "PLAYWRIGHT_PUBLIC") {
    throw new CollectorInputError("collectionSource must be PLAYWRIGHT_PUBLIC");
  }
  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim().slice(0, 2_000)
      : null;
  if (typeof body.caption !== "string" || body.caption.length > 20_000) {
    throw new CollectorInputError("caption is invalid");
  }
  const influencerUsername = requiredString(
    body.influencerUsername,
    "influencerUsername",
    30,
  )
    .replace(/^@/, "")
    .toLowerCase();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(influencerUsername)) {
    throw new CollectorInputError("influencerUsername is invalid");
  }
  return {
    instagramPostId: requiredString(
      body.instagramPostId,
      "instagramPostId",
      200,
    ),
    influencerUsername,
    caption: body.caption.trim(),
    postUrl: instagramPostUrl(body.postUrl),
    imageUrl,
    takenAt: isoDate(body.takenAt, "takenAt"),
    collectedAt: isoDate(body.collectedAt, "collectedAt"),
    collectionSource: "PLAYWRIGHT_PUBLIC",
    profileLinkCandidates: normalizeProfileLinkCandidates(
      body.profileLinkCandidates,
    ),
  };
}

export function normalizeCollectPayload(
  body: Record<string, unknown>,
): CollectedPost {
  const nestedPost = body.post;
  if (
    nestedPost &&
    typeof nestedPost === "object" &&
    !Array.isArray(nestedPost)
  ) {
    return normalizeCollectedPost(nestedPost as Record<string, unknown>);
  }
  return normalizeCollectedPost(body);
}

function normalizeCampaignToken(value: string | undefined) {
  if (!value) return null;
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 120);
  return normalized || null;
}

function normalizeCampaignUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_RE.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/u, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function hashtagProductName(caption: string) {
  const candidates = (caption.match(/#[\p{L}\p{N}_-]{2,80}/gu) ?? [])
    .map((value) =>
      value.slice(1).replace(/(?:공동구매|공구|마켓|특가|할인|세일)$/u, ""),
    )
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && !GENERIC_HASHTAG_RE.test(value));
  return (
    candidates.sort((left, right) => right.length - left.length)[0] ?? null
  );
}

function automaticProductName(
  productName: string | undefined,
  brandName: string | undefined,
  caption: string,
) {
  const candidate = productName?.trim().replace(/\s+/gu, " ");
  if (
    candidate &&
    candidate.length >= 2 &&
    candidate.length <= 120 &&
    !AUTOMATIC_PRODUCT_CTA_RE.test(candidate) &&
    !GENERIC_PRODUCT_RE.test(candidate)
  ) {
    return candidate;
  }

  const hashtag = hashtagProductName(caption);
  if (hashtag) return hashtag;

  const brand = brandName?.trim().replace(/\s+/gu, " ");
  if (brand && brand.length >= 2 && brand.length <= 80) {
    return `${brand} 공구`;
  }
  return null;
}

function normalizeCampaignDate(value: string | undefined) {
  return value ? value.slice(0, 10) : "";
}

function validCampaignDate(value: string | undefined) {
  const date = normalizeCampaignDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function koreaCalendarDate(value: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  return new Date(instant.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function isAutomaticCampaignCurrentOrUpcoming(
  parsed: ParsedAutomaticCaption,
  referenceTime: string,
) {
  const today = koreaCalendarDate(referenceTime);
  if (!today) return false;

  const endDate = validCampaignDate(parsed.endDate);
  if (endDate) return endDate >= today;

  const startDate = validCampaignDate(parsed.startDate);
  return Boolean(startDate && startDate >= today);
}

export function normalizeAutoParsedCaption(
  parsed: ParsedAutomaticCaption,
  caption: string,
): ParsedAutomaticCaption {
  const productName = automaticProductName(
    parsed.productName,
    parsed.brandName,
    caption,
  );
  return {
    ...parsed,
    productName:
      productName ?? (parsed.purchaseUrl ? "상품명 확인 필요" : undefined),
  };
}

export function applyAutomaticProfilePurchaseFallback(
  parsed: ParsedAutomaticCaption,
  profileLinkCandidates: CollectionReviewProfileLinkCandidate[],
) {
  if (parsed.purchaseUrl || profileLinkCandidates.length !== 1) return parsed;
  return { ...parsed, purchaseUrl: profileLinkCandidates[0].url };
}

export function buildCampaignDedupeKey(parsed: ParsedAutomaticCaption) {
  const purchaseUrl = normalizeCampaignUrl(parsed.purchaseUrl);
  const productName = normalizeCampaignToken(parsed.productName);
  const brandName = normalizeCampaignToken(parsed.brandName);
  const identity = purchaseUrl
    ? `url:${purchaseUrl}`
    : productName && !GENERIC_PRODUCT_RE.test(productName)
      ? `product:${productName}|brand:${brandName ?? ""}`
      : null;
  if (!identity) return null;

  return [
    "PLAYWRIGHT_PUBLIC",
    identity,
    `start:${normalizeCampaignDate(parsed.startDate)}`,
    `end:${normalizeCampaignDate(parsed.endDate)}`,
  ].join("|");
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function watchlist(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("influencers")
    .select(
      "id,instagram_username,playwright_failure_count,playwright_next_run_at",
    )
    .eq("is_active", true)
    .eq("playwright_collection_enabled", true)
    .order("playwright_next_run_at", { ascending: true, nullsFirst: true })
    .order("instagram_username", { ascending: true });
  if (error) throw error;

  const now = Date.now();
  return {
    items: (data ?? [])
      .filter(
        (row) =>
          !row.playwright_next_run_at ||
          Date.parse(String(row.playwright_next_run_at)) <= now,
      )
      .map((row) => ({
        id: String(row.id),
        instagramUsername: String(row.instagram_username),
        playwrightFailureCount: Number(row.playwright_failure_count ?? 0),
        playwrightNextRunAt: row.playwright_next_run_at,
      })),
  };
}

async function ensureInfluencer(
  supabase: AdminClient,
  instagramUsername: string,
) {
  const { data: existing, error: findError } = await supabase
    .from("influencers")
    .select("id")
    .eq("instagram_username", instagramUsername)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return String(existing.id);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("influencers")
    .insert({
      id: crypto.randomUUID(),
      instagram_username: instagramUsername,
      is_active: true,
      playwright_collection_enabled: true,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) {
    const { data: concurrent } = await supabase
      .from("influencers")
      .select("id")
      .eq("instagram_username", instagramUsername)
      .maybeSingle();
    if (concurrent?.id) return String(concurrent.id);
    throw error;
  }
  return String(data.id);
}

async function findRawPost(
  supabase: AdminClient,
  post: CollectedPost,
  contentHash: string,
) {
  const { data: byPostId, error: postIdError } = await supabase
    .from("raw_posts")
    .select("id")
    .eq("instagram_post_id", post.instagramPostId)
    .maybeSingle();
  if (postIdError) throw postIdError;
  if (byPostId) return byPostId;

  const { data: byHash, error: hashError } = await supabase
    .from("raw_posts")
    .select("id")
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (hashError) throw hashError;
  return byHash;
}

async function findExistingCampaign(
  supabase: AdminClient,
  dedupeKey: string,
): Promise<ExistingCampaign | null> {
  const { data, error } = await supabase
    .from("group_buys")
    .select("id,raw_post_id,status,collection_review_status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) {
    return {
      id: String(data.id),
      raw_post_id: data.raw_post_id ? String(data.raw_post_id) : null,
      status: String(data.status ?? "REVIEW_REQUIRED"),
      collection_review_status:
        data.collection_review_status === "PENDING" ||
        data.collection_review_status === "APPROVED" ||
        data.collection_review_status === "REJECTED"
          ? data.collection_review_status
          : legacyCollectionReviewStatus(data.status),
    };
  }

  // Rows created before dedupe_key was introduced are matched once and
  // backfilled, so an existing Preview/Production review is not requeued.
  const { data: legacyRows, error: legacyError } = await supabase
    .from("group_buys")
    .select(
      "id,raw_post_id,status,collection_review_status,dedupe_key,product_name,brand_name,purchase_url,start_date,end_date,raw_post:raw_post_id(caption)",
    )
    .eq("source_type", "PLAYWRIGHT_PUBLIC")
    .is("dedupe_key", null)
    .limit(200);
  if (legacyError) throw legacyError;

  for (const row of legacyRows ?? []) {
    const rawPost = Array.isArray(row.raw_post)
      ? row.raw_post[0]
      : row.raw_post;
    const caption =
      rawPost &&
      typeof rawPost === "object" &&
      typeof rawPost.caption === "string"
        ? rawPost.caption
        : "";
    const legacyParsed = normalizeAutoParsedCaption(
      {
        productName:
          typeof row.product_name === "string" ? row.product_name : undefined,
        brandName:
          typeof row.brand_name === "string" ? row.brand_name : undefined,
        purchaseUrl:
          typeof row.purchase_url === "string" ? row.purchase_url : undefined,
        startDate:
          typeof row.start_date === "string"
            ? normalizeCampaignDate(row.start_date)
            : undefined,
        endDate:
          typeof row.end_date === "string"
            ? normalizeCampaignDate(row.end_date)
            : undefined,
      },
      caption,
    );
    if (buildCampaignDedupeKey(legacyParsed) !== dedupeKey) continue;

    const { error: backfillError } = await supabase
      .from("group_buys")
      .update({ dedupe_key: dedupeKey })
      .eq("id", String(row.id))
      .is("dedupe_key", null);
    if (backfillError && backfillError.code !== "23505") throw backfillError;

    const { data: matched, error: matchedError } = await supabase
      .from("group_buys")
      .select("id,raw_post_id,status,collection_review_status")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (matchedError) throw matchedError;
    const selected = matched ?? row;
    return selected?.id
      ? {
          id: String(selected.id),
          raw_post_id: selected.raw_post_id
            ? String(selected.raw_post_id)
            : null,
          status: String(selected.status ?? "REVIEW_REQUIRED"),
          collection_review_status:
            selected.collection_review_status === "PENDING" ||
            selected.collection_review_status === "APPROVED" ||
            selected.collection_review_status === "REJECTED"
              ? selected.collection_review_status
              : legacyCollectionReviewStatus(selected.status),
        }
      : null;
  }

  return null;
}

async function attachLatestCampaignPost(
  supabase: AdminClient,
  campaign: ExistingCampaign,
  post: CollectedPost,
  rawPostId: string,
  influencerId: string,
  parsed: ParsedAutomaticCaption,
) {
  if (campaign.status === "REJECTED" || campaign.status === "EXPIRED") {
    return campaign.id;
  }

  const update: Record<string, unknown> = {
    raw_post_id: rawPostId,
    influencer_id: influencerId,
    updated_at: new Date().toISOString(),
  };
  if (
    campaign.status === "REVIEW_REQUIRED" &&
    campaign.collection_review_status === "PENDING"
  ) {
    update.product_name = parsed.productName ?? null;
    update.brand_name = parsed.brandName ?? null;
    update.start_date = parsed.startDate ?? null;
    update.end_date = parsed.endDate ?? null;
    update.purchase_url = parsed.purchaseUrl ?? null;
    update.discount_info = parsed.discountInfo ?? null;
    update.price_krw = parsed.priceKrw ?? null;
    update.summary = post.caption.slice(0, 500);
    update.collection_proposal_snapshot = buildAutomaticProposalSnapshot(
      post,
      rawPostId,
      parsed,
    );
    update.collection_ruleset_version = AUTOMATIC_COLLECTION_RULESET_VERSION;
  }

  const { error } = await supabase
    .from("group_buys")
    .update(update)
    .eq("id", campaign.id);
  if (error) throw error;
  return campaign.id;
}

async function createGroupBuy(
  supabase: AdminClient,
  post: CollectedPost,
  rawPostId: string,
  influencerId: string,
  parsed: ParsedAutomaticCaption,
  dedupeKey: string,
) {
  const { data, error } = await supabase
    .from("group_buys")
    .insert({
      id: crypto.randomUUID(),
      raw_post_id: rawPostId,
      influencer_id: influencerId,
      dedupe_key: dedupeKey,
      product_name: parsed.productName ?? null,
      brand_name: parsed.brandName ?? null,
      start_date: parsed.startDate ?? null,
      end_date: parsed.endDate ?? null,
      purchase_url: parsed.purchaseUrl ?? null,
      discount_info: parsed.discountInfo ?? null,
      price_krw: parsed.priceKrw ?? null,
      summary: post.caption.slice(0, 500),
      confidence: 0.5,
      status: "REVIEW_REQUIRED",
      source_type: "PLAYWRIGHT_PUBLIC",
      collection_review_status: "PENDING",
      collection_proposal_snapshot: buildAutomaticProposalSnapshot(
        post,
        rawPostId,
        parsed,
      ),
      collection_ruleset_version: AUTOMATIC_COLLECTION_RULESET_VERSION,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: findError } = await supabase
        .from("group_buys")
        .select("id")
        .eq("raw_post_id", rawPostId)
        .maybeSingle();
      if (findError) throw findError;
      if (existing?.id) {
        return {
          id: String(existing.id),
          reviewCandidateCreated: false,
        };
      }

      const campaign = await findExistingCampaign(supabase, dedupeKey);
      if (campaign) {
        const id = await attachLatestCampaignPost(
          supabase,
          campaign,
          post,
          rawPostId,
          influencerId,
          parsed,
        );
        return { id, reviewCandidateCreated: false };
      }
    }
    throw error;
  }
  return {
    id: String(data.id),
    reviewCandidateCreated: true,
  };
}

async function findGroupBuy(supabase: AdminClient, rawPostId: string) {
  const { data, error } = await supabase
    .from("group_buys")
    .select("id")
    .eq("raw_post_id", rawPostId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function collectPost(supabase: AdminClient, post: CollectedPost) {
  const contentHash = await sha256(
    `${post.instagramPostId}\n${post.caption}\n${post.postUrl}`,
  );
  const influencerId = await ensureInfluencer(
    supabase,
    post.influencerUsername,
  );
  const isCandidate = isGroupBuyCandidate(post.caption);
  const koreaSignals = classifyKoreaCaption(post.caption);
  const isKoreaCandidate = koreaSignals.isKoreaCandidate;
  let parsed: ParsedAutomaticCaption = {};
  let parseError: string | null = null;
  if (isCandidate && isKoreaCandidate) {
    try {
      parsed = normalizeAutoParsedCaption(
        parseSubmissionCaption(post.caption, {
          referenceDate: new Date(post.takenAt),
        }),
        post.caption,
      );
      if (!buildCampaignDedupeKey(parsed)) {
        parseError = "자동 수집 상품 식별 정보가 없습니다.";
      }
    } catch (error) {
      parseError =
        error instanceof Error ? error.message.slice(0, 500) : "parse failed";
    }
  }
  const campaignDedupeKey = parseError ? null : buildCampaignDedupeKey(parsed);
  const proposal = applyAutomaticProfilePurchaseFallback(
    parsed,
    post.profileLinkCandidates,
  );
  const shouldCreateGroupBuy = Boolean(
    isCandidate &&
    isKoreaCandidate &&
    campaignDedupeKey &&
    isAutomaticCampaignCurrentOrUpcoming(parsed, new Date().toISOString()),
  );

  const existing = await findRawPost(supabase, post, contentHash);
  if (existing?.id) {
    const groupBuy = await findGroupBuy(supabase, String(existing.id));
    let groupBuyId = groupBuy?.id ? String(groupBuy.id) : null;
    let reviewCandidateCreated = false;
    if (!groupBuyId && shouldCreateGroupBuy && campaignDedupeKey) {
      const campaign = await findExistingCampaign(supabase, campaignDedupeKey);
      if (campaign) {
        groupBuyId = await attachLatestCampaignPost(
          supabase,
          campaign,
          post,
          String(existing.id),
          influencerId,
          proposal,
        );
      } else {
        const createdGroupBuy = await createGroupBuy(
          supabase,
          post,
          String(existing.id),
          influencerId,
          proposal,
          campaignDedupeKey,
        );
        groupBuyId = createdGroupBuy.id;
        reviewCandidateCreated = createdGroupBuy.reviewCandidateCreated;
      }
    }
    return {
      created: false,
      duplicate: true,
      rawPostId: String(existing.id),
      groupBuyId,
      reviewCandidateCreated,
    };
  }

  const parsingStatus = !isCandidate
    ? "NOT_GROUP_BUY"
    : !isKoreaCandidate
      ? "NOT_KOREA"
      : parseError
        ? "FAILED"
        : "PARSED";
  const now = new Date().toISOString();
  const { data: rawPost, error: rawPostError } = await supabase
    .from("raw_posts")
    .insert({
      id: crypto.randomUUID(),
      instagram_post_id: post.instagramPostId,
      influencer_id: influencerId,
      caption: post.caption,
      post_url: post.postUrl,
      image_url: post.imageUrl,
      taken_at: post.takenAt,
      collected_at: post.collectedAt,
      content_hash: contentHash,
      is_candidate: isCandidate,
      is_korea_candidate: isKoreaCandidate,
      collection_source: "PLAYWRIGHT_PUBLIC",
      parsing_status: parsingStatus,
      parsed_at: shouldCreateGroupBuy ? now : null,
      parse_error: parseError,
      updated_at: now,
    })
    .select("id")
    .single();
  if (rawPostError) throw rawPostError;

  const groupBuy =
    shouldCreateGroupBuy && campaignDedupeKey
      ? await createGroupBuy(
          supabase,
          post,
          String(rawPost.id),
          influencerId,
          proposal,
          campaignDedupeKey,
        )
      : null;
  const groupBuyId = groupBuy?.id ?? null;
  return {
    created: true,
    duplicate: false,
    rawPostId: String(rawPost.id),
    groupBuyId,
    reviewCandidateCreated: groupBuy?.reviewCandidateCreated ?? false,
  };
}

function normalizeStatus(body: Record<string, unknown>): CollectorStatus {
  if (
    typeof body.status !== "string" ||
    !STATUSES.includes(body.status as CollectorStatus)
  ) {
    throw new CollectorInputError("status is invalid");
  }
  return body.status as CollectorStatus;
}

async function updateStatus(
  supabase: AdminClient,
  body: Record<string, unknown>,
) {
  const influencerId = requiredString(body.influencerId, "influencerId", 100);
  const status = normalizeStatus(body);
  const attemptAt = isoDate(body.attemptAt, "attemptAt");
  const nextRunAt = isoDate(body.nextRunAt, "nextRunAt");
  const errorCode =
    typeof body.errorCode === "string" ? body.errorCode.slice(0, 80) : "";
  const errorMessage =
    typeof body.errorMessage === "string"
      ? body.errorMessage.slice(0, 400)
      : "";

  const { data: existing, error: findError } = await supabase
    .from("influencers")
    .select("playwright_failure_count")
    .eq("id", influencerId)
    .single();
  if (findError) throw findError;

  const failureCount =
    status === "SUCCESS"
      ? 0
      : Number(existing.playwright_failure_count ?? 0) + 1;
  const { error } = await supabase
    .from("influencers")
    .update({
      playwright_last_attempt_at: attemptAt,
      playwright_last_success_at: status === "SUCCESS" ? attemptAt : undefined,
      playwright_last_error:
        status === "SUCCESS"
          ? null
          : [errorCode, errorMessage].filter(Boolean).join(": ").slice(0, 500),
      playwright_failure_count: failureCount,
      playwright_next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", influencerId);
  if (error) throw error;
  return { ok: true };
}

export async function handler(request: Request) {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (!Deno.env.get("INSTAGRAM_COLLECTOR_TOKEN")) {
    return json({ error: "Collector is not configured" }, 503);
  }
  if (!requireCollectorToken(request)) {
    return json({ error: "Collector authentication failed" }, 401);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const action = normalizeCollectorAction(body);
    const supabase = createAdminClient();
    if (action === "watchlist") return json(await watchlist(supabase));
    if (action === "status") return json(await updateStatus(supabase, body));
    return json({
      result: await collectPost(supabase, normalizeCollectPayload(body)),
    });
  } catch (error) {
    if (error instanceof CollectorInputError) {
      return json({ error: error.message }, 400);
    }
    console.error(
      JSON.stringify({
        event: "instagram_public_collector_failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
      }),
    );
    return json({ error: "Collector request failed" }, 500);
  }
}

if (import.meta.main) serve(handler);
