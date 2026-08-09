import type { CollectionReviewStatus } from "../_shared/automaticCollectionReview.ts";

const INSTAGRAM_POST_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
]);
const REVIEWED_DATA_FIELDS = [
  "productName",
  "brandName",
  "instagramUsername",
  "profileImageUrl",
  "category",
  "startDate",
  "endDate",
  "purchaseUrl",
  "discountInfo",
  "priceKrw",
  "summary",
  "thumbnailUrl",
  "videoUrl",
  "mediaUrls",
  "mediaItems",
  "mediaType",
  "postAudioUrl",
  "postAudioStartTimeMs",
  "postAudioDurationMs",
  "isAllDay",
  "isMonthlyFeatured",
  "monthlyFeaturedRank",
  "isHomeBanner",
  "homeBannerStartDate",
  "homeBannerEndDate",
] as const;

export class CollectionReviewContractError extends Error {}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new CollectionReviewContractError(`${label}을(를) 입력해주세요.`);
  }
  return normalized;
}

export function automaticInstagramPostUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (!INSTAGRAM_POST_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.search || url.hash) return null;
    if (!/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/u.test(url.pathname)) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function collectionReviewFilter(
  value: unknown,
): CollectionReviewStatus | null {
  if (value === undefined || value === null || value === "" || value === "ALL") {
    return null;
  }
  if (value === "PENDING" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  throw new CollectionReviewContractError(
    "자동수집 검수 상태가 올바르지 않습니다.",
  );
}

export function reviewedData(body: Record<string, unknown>) {
  const input = record(body.reviewedData);
  if (!input) {
    throw new CollectionReviewContractError("검수 데이터를 입력해주세요.");
  }
  return Object.fromEntries(
    REVIEWED_DATA_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(input, field)
    ).map((field) => [field, input[field]]),
  );
}

export function protectPendingAutomaticCatalogPatch(
  sourceType: unknown,
  reviewStatus: CollectionReviewStatus,
  patch: Record<string, unknown>,
) {
  if (sourceType !== "PLAYWRIGHT_PUBLIC" || reviewStatus !== "PENDING") {
    return patch;
  }
  const protectedPatch = { ...patch };
  delete protectedPatch.status;
  return protectedPatch;
}

export function validateApprovalData(data: Record<string, unknown>) {
  const productName = requiredText(data.productName, "제품명");
  if (productName.length < 2) {
    throw new CollectionReviewContractError(
      "제품명은 두 글자 이상 입력해주세요.",
    );
  }
  requiredText(data.category, "카테고리");
  const purchaseUrl = requiredText(data.purchaseUrl, "구매 URL");
  try {
    const url = new URL(purchaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    throw new CollectionReviewContractError("구매 URL이 올바르지 않습니다.");
  }
  const startDate = optionalDate(data.startDate, "시작일");
  const endDate = optionalDate(data.endDate, "종료일");
  if (!startDate && !endDate) {
    throw new CollectionReviewContractError(
      "시작일 또는 종료일 중 하나를 입력해주세요.",
    );
  }
  if (startDate && endDate && startDate > endDate) {
    throw new CollectionReviewContractError(
      "종료일은 시작일과 같거나 이후여야 합니다.",
    );
  }
}

function optionalDate(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new CollectionReviewContractError(`${label}이(가) 올바르지 않습니다.`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new CollectionReviewContractError(`${label}이(가) 올바르지 않습니다.`);
  }
  return normalized;
}

export function normalizeRejectionReason(body: Record<string, unknown>) {
  return requiredText(body.reason, "반려 사유").slice(0, 500);
}
