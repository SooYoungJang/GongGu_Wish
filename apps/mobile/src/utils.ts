function formatMonthDay(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Format a group-buy period as a calendar range.
 * Examples: "6월 28일 ~ 7월 4일", "기간 미정"
 */
export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const startLabel = formatMonthDay(startDate);
  const endLabel = formatMonthDay(endDate);

  if (!startLabel || !endLabel) return '기간 미정';
  return `${startLabel} ~ ${endLabel}`;
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
