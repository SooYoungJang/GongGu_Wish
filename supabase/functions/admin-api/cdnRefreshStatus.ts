export const CDN_REFRESH_STATUSES = [
  "expired",
  "expiring",
  "healthy",
  "unknown",
  "no_cdn",
] as const;

export type CdnRefreshStatus = (typeof CDN_REFRESH_STATUSES)[number];

export type CdnRefreshStatusRow = {
  id: string;
  productName: string | null;
  brandName: string | null;
  category: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  endDate: string | null;
  updatedAt: string;
  mediaRefreshedAt: string | null;
  cdnExpiresAt: string | null;
  refreshStatus: CdnRefreshStatus;
  instagramUrl: string | null;
};

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Invalid CDN refresh row: ${field} must be a string.`);
  }
  return value;
}

function nullableString(
  row: Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(
      `Invalid CDN refresh row: ${field} must be a string or null.`,
    );
  }
  return value;
}

function refreshStatus(value: unknown): CdnRefreshStatus {
  if (
    typeof value === "string" &&
    CDN_REFRESH_STATUSES.includes(value as CdnRefreshStatus)
  ) {
    return value as CdnRefreshStatus;
  }
  throw new Error("Invalid CDN refresh row: refresh_status is invalid.");
}

export function mapCdnRefreshStatusRow(
  row: Record<string, unknown>,
): CdnRefreshStatusRow {
  return {
    id: requiredString(row, "id"),
    productName: nullableString(row, "product_name"),
    brandName: nullableString(row, "brand_name"),
    category: nullableString(row, "category"),
    videoUrl: nullableString(row, "video_url"),
    thumbnailUrl: nullableString(row, "thumbnail_url"),
    endDate: nullableString(row, "end_date"),
    updatedAt: requiredString(row, "updated_at"),
    mediaRefreshedAt: nullableString(row, "media_refreshed_at"),
    cdnExpiresAt: nullableString(row, "cdn_expires_at"),
    refreshStatus: refreshStatus(row.refresh_status),
    instagramUrl: nullableString(row, "instagram_url"),
  };
}
