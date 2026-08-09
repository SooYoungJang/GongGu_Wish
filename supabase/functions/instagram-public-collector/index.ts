import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { parseSubmissionCaption } from "../../../packages/shared/src/utils/captionParser.ts";
import {
  classifyKoreaCaption,
  isGroupBuyCandidate,
} from "../_shared/instagram-public-rules.ts";

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
};

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

async function createGroupBuy(
  supabase: AdminClient,
  post: CollectedPost,
  rawPostId: string,
  influencerId: string,
  parsed: ReturnType<typeof parseSubmissionCaption>,
) {
  const { data, error } = await supabase
    .from("group_buys")
    .insert({
      id: crypto.randomUUID(),
      raw_post_id: rawPostId,
      influencer_id: influencerId,
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
      if (existing?.id) return String(existing.id);
    }
    throw error;
  }
  return String(data.id);
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
  let parsed: ReturnType<typeof parseSubmissionCaption> = {};
  let parseError: string | null = null;
  if (isCandidate && isKoreaCandidate) {
    try {
      parsed = parseSubmissionCaption(post.caption, {
        referenceDate: new Date(post.takenAt),
      });
    } catch (error) {
      parseError =
        error instanceof Error ? error.message.slice(0, 500) : "parse failed";
    }
  }

  const existing = await findRawPost(supabase, post, contentHash);
  if (existing?.id) {
    const groupBuy = await findGroupBuy(supabase, String(existing.id));
    const groupBuyId = groupBuy?.id
      ? String(groupBuy.id)
      : isCandidate && isKoreaCandidate
        ? await createGroupBuy(
            supabase,
            post,
            String(existing.id),
            influencerId,
            parsed,
          )
        : null;
    return {
      created: false,
      duplicate: true,
      rawPostId: String(existing.id),
      groupBuyId,
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
      parsed_at: isCandidate && isKoreaCandidate ? now : null,
      parse_error: parseError,
      updated_at: now,
    })
    .select("id")
    .single();
  if (rawPostError) throw rawPostError;

  const groupBuyId =
    isCandidate && isKoreaCandidate
      ? await createGroupBuy(
          supabase,
          post,
          String(rawPost.id),
          influencerId,
          parsed,
        )
      : null;
  return {
    created: true,
    duplicate: false,
    rawPostId: String(rawPost.id),
    groupBuyId,
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
