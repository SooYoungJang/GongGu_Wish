export function normalizePriceKrw(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const normalized =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed =
    typeof normalized === "number"
      ? normalized
      : typeof normalized === "string" && /^\d+$/.test(normalized)
        ? Number(normalized)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {
    throw new Error("priceKrw must be a non-negative PostgreSQL INTEGER.");
  }

  return parsed;
}

export function normalizePricePatch(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const hasCamelPrice = Object.prototype.hasOwnProperty.call(body, "priceKrw");
  const hasSnakePrice = Object.prototype.hasOwnProperty.call(body, "price_krw");
  if (!hasCamelPrice && !hasSnakePrice) return {};

  return {
    price_krw: normalizePriceKrw(
      hasCamelPrice ? body.priceKrw : body.price_krw,
    ),
  };
}

export function normalizeHomeBannerBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("isHomeBanner must be a boolean.");
  }

  return value;
}

export function normalizeHomeBannerDate(
  value: unknown,
  fieldName: string,
): string | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a real calendar date.`);
  }

  return normalized;
}

export function validateHomeBannerSchedule(schedule: {
  isHomeBanner: boolean;
  startDate: string | null;
  endDate: string | null;
}) {
  if (schedule.isHomeBanner && (!schedule.startDate || !schedule.endDate)) {
    throw new Error(
      "Home banner start and end dates are required when enabled.",
    );
  }
  if (
    schedule.startDate &&
    schedule.endDate &&
    schedule.startDate > schedule.endDate
  ) {
    throw new Error("Home banner end date must be on or after its start date.");
  }
}

export type HomeBannerSchedule = {
  isHomeBanner: boolean;
  startDate: string | null;
  endDate: string | null;
};

export function mergeHomeBannerSchedule(
  patch: Partial<HomeBannerSchedule>,
  existing: HomeBannerSchedule,
): HomeBannerSchedule {
  const merged = { ...existing, ...patch };
  validateHomeBannerSchedule(merged);
  return merged;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

/**
 * Normalize commerce fields once for both the submission and group-buy tables.
 * The database row passed as `existing` uses snake_case column names.
 */
export function normalizeCommercePatch(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = normalizePricePatch(body);

  const scheduleTouched = [
    "isHomeBanner",
    "homeBannerStartDate",
    "homeBannerEndDate",
  ].some((key) => hasOwn(body, key));
  if (!scheduleTouched) return patch;

  const merged = mergeHomeBannerSchedule(
    compact({
      isHomeBanner: hasOwn(body, "isHomeBanner")
        ? normalizeHomeBannerBoolean(body.isHomeBanner)
        : undefined,
      startDate: hasOwn(body, "homeBannerStartDate")
        ? normalizeHomeBannerDate(
            body.homeBannerStartDate,
            "homeBannerStartDate",
          )
        : undefined,
      endDate: hasOwn(body, "homeBannerEndDate")
        ? normalizeHomeBannerDate(body.homeBannerEndDate, "homeBannerEndDate")
        : undefined,
    }),
    {
      isHomeBanner: existing.is_home_banner === true,
      startDate:
        typeof existing.home_banner_start_date === "string"
          ? existing.home_banner_start_date
          : null,
      endDate:
        typeof existing.home_banner_end_date === "string"
          ? existing.home_banner_end_date
          : null,
    },
  );

  if (hasOwn(body, "isHomeBanner")) patch.is_home_banner = merged.isHomeBanner;
  if (hasOwn(body, "homeBannerStartDate"))
    patch.home_banner_start_date = merged.startDate;
  if (hasOwn(body, "homeBannerEndDate"))
    patch.home_banner_end_date = merged.endDate;

  return patch;
}
