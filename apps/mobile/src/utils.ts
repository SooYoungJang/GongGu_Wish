/**
 * Format a date string into a human-readable deadline label.
 * Examples: "마감됨", "오늘 마감", "내일 마감", "6월 22일 마감 (3일 남음)"
 */
export function formatEndDate(dateString: string | null | undefined): string {
  if (!dateString) return '미정';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '마감됨';
  if (diffDays === 0) return '오늘 마감';
  if (diffDays === 1) return '내일 마감';
  return `${date.getMonth() + 1}월 ${date.getDate()}일 마감 (${diffDays}일 남음)`;
}

export function normalizeOptional(value: string) {
  const trimmed = value.trim();
 return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Returns whole days remaining until the deadline (negative if past).
 * null/undefined/invalid → Infinity (treated as "no deadline").
 */
export function getDaysRemaining(dateString: string | null | undefined): number {
  if (!dateString) return Infinity;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return Infinity;
  const diffMs = date.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isValidOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createReviewForm(item: {
  productName?: string | null;
  brandName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  purchaseUrl?: string | null;
  discountInfo?: string | null;
  summary?: string | null;
}) {
  return {
    productName: item.productName ?? '',
    brandName: item.brandName ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    purchaseUrl: item.purchaseUrl ?? '',
    discountInfo: item.discountInfo ?? '',
    summary: item.summary ?? '',
  };
}
