export const AUTOMATIC_COLLECTION_RULESET_VERSION =
  "playwright-public-latest3-dedupe-profile-links-v3";
export const COLLECTION_REVIEW_SNAPSHOT_VERSION = 1 as const;

export type CollectionReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type CollectionReviewTransition = "APPLY" | "IDEMPOTENT" | "CONFLICT";

export type CollectionReviewMediaItem = {
  url: string;
  mediaType: "IMAGE" | "VIDEO";
  thumbnailUrl: string | null;
};

export type CollectionReviewProfileLinkCandidate = {
  url: string;
  label: string | null;
  source: "PLAYWRIGHT_PROFILE";
};

export type CollectionReviewSnapshot = {
  schemaVersion: typeof COLLECTION_REVIEW_SNAPSHOT_VERSION;
  rawPostId: string | null;
  instagramPostId: string | null;
  originalPostUrl: string | null;
  takenAt: string | null;
  productName: string | null;
  brandName: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  purchaseUrl: string | null;
  profileLinkCandidates: CollectionReviewProfileLinkCandidate[];
  discountInfo: string | null;
  priceKrw: number | null;
  summary: string | null;
  thumbnailUrl: string | null;
  mediaUrls: string[];
  mediaItems: CollectionReviewMediaItem[];
  mediaType: "IMAGE" | "VIDEO" | null;
  confidence: number | null;
  postAudioUrl: string | null;
  postAudioStartTimeMs: number | null;
  postAudioDurationMs: number | null;
  isHomeBanner: boolean;
  homeBannerStartDate: string | null;
  homeBannerEndDate: string | null;
};

function text(value: unknown, maxLength = 2_000) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function integer(value: unknown) {
  const normalized = number(value);
  return normalized === null ? null : Math.trunc(normalized);
}

function mediaUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, 2_048))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
}

function mediaItems(value: unknown): CollectionReviewMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = text(record.url, 2_048);
      const mediaType =
        record.mediaType === "VIDEO" || record.media_type === "VIDEO"
          ? "VIDEO"
          : record.mediaType === "IMAGE" || record.media_type === "IMAGE"
            ? "IMAGE"
            : null;
      if (!url || !mediaType) return null;
      return {
        url,
        mediaType,
        thumbnailUrl: text(record.thumbnailUrl ?? record.thumbnail_url, 2_048),
      } satisfies CollectionReviewMediaItem;
    })
    .filter((item): item is CollectionReviewMediaItem => Boolean(item))
    .slice(0, 20);
}

const PROFILE_LINK_TRACKING_KEYS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

function isUnsafeProfileLinkHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "instagr.am" ||
    host.endsWith(".instagr.am") ||
    host.includes(":")
  ) {
    return true;
  }
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function profileLinkUrl(value: unknown) {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      isUnsafeProfileLinkHost(url.hostname)
    ) {
      return null;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        PROFILE_LINK_TRACKING_KEYS.has(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeProfileLinkCandidates(
  value: unknown,
): CollectionReviewProfileLinkCandidate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: CollectionReviewProfileLinkCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = profileLinkUrl(record.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({
      url,
      label: text(record.label, 200),
      source: "PLAYWRIGHT_PROFILE",
    });
    if (result.length >= 5) break;
  }
  return result;
}

export function profileLinkCandidatesFromReviewSnapshot(
  value: unknown,
): CollectionReviewProfileLinkCandidate[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return normalizeProfileLinkCandidates(
    (value as Record<string, unknown>).profileLinkCandidates,
  );
}

export function buildCollectionReviewSnapshot(
  input: Record<string, unknown>,
): CollectionReviewSnapshot {
  const username = text(input.instagramUsername, 100);
  const mediaType =
    input.mediaType === "VIDEO"
      ? "VIDEO"
      : input.mediaType === "IMAGE"
        ? "IMAGE"
        : null;

  return {
    schemaVersion: COLLECTION_REVIEW_SNAPSHOT_VERSION,
    rawPostId: text(input.rawPostId, 100),
    instagramPostId: text(input.instagramPostId, 100),
    originalPostUrl: text(input.originalPostUrl, 2_048),
    takenAt: text(input.takenAt, 100),
    productName: text(input.productName, 300),
    brandName: text(input.brandName, 300),
    instagramUsername: username?.replace(/^@+/, "") ?? null,
    profileImageUrl: text(input.profileImageUrl, 2_048),
    category: text(input.category, 100),
    startDate: text(input.startDate, 100),
    endDate: text(input.endDate, 100),
    purchaseUrl: text(input.purchaseUrl, 2_048),
    profileLinkCandidates: normalizeProfileLinkCandidates(
      input.profileLinkCandidates,
    ),
    discountInfo: text(input.discountInfo, 500),
    priceKrw: integer(input.priceKrw),
    summary: text(input.summary, 2_000),
    thumbnailUrl: text(input.thumbnailUrl, 2_048),
    mediaUrls: mediaUrls(input.mediaUrls),
    mediaItems: mediaItems(input.mediaItems),
    mediaType,
    confidence: number(input.confidence),
    postAudioUrl: text(input.postAudioUrl, 2_048),
    postAudioStartTimeMs: integer(input.postAudioStartTimeMs),
    postAudioDurationMs: integer(input.postAudioDurationMs),
    isHomeBanner: input.isHomeBanner === true,
    homeBannerStartDate: text(input.homeBannerStartDate, 100),
    homeBannerEndDate: text(input.homeBannerEndDate, 100),
  };
}

export function buildReviewedCollectionSnapshot(
  input: Record<string, unknown>,
  proposalSnapshot: unknown,
): CollectionReviewSnapshot {
  return buildCollectionReviewSnapshot({
    ...input,
    profileLinkCandidates:
      profileLinkCandidatesFromReviewSnapshot(proposalSnapshot),
  });
}

export function legacyCollectionReviewStatus(
  catalogStatus: unknown,
): CollectionReviewStatus {
  if (catalogStatus === "REVIEW_REQUIRED") return "PENDING";
  if (catalogStatus === "REJECTED") return "REJECTED";
  return "APPROVED";
}

export function reviewTransition(
  current: CollectionReviewStatus,
  requested: Exclude<CollectionReviewStatus, "PENDING">,
): CollectionReviewTransition {
  if (current === "PENDING") return "APPLY";
  return current === requested ? "IDEMPOTENT" : "CONFLICT";
}
