export type HomeBannerCandidate = {
  isHomeBanner?: boolean;
  homeBannerStartDate?: string | null;
  homeBannerEndDate?: string | null;
};

type DateKey = {
  value: number;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(value: string | null | undefined): DateKey | null {
  if (!value) return null;

  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return {
    value: year * 10000 + month * 100 + day,
  };
}

function getLocalDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return {
    value: year * 10000 + month * 100 + day,
  };
}

export function isHomeBannerActive(item: HomeBannerCandidate, now = new Date()): boolean {
  if (item.isHomeBanner !== true) return false;

  const start = parseDateKey(item.homeBannerStartDate);
  const end = parseDateKey(item.homeBannerEndDate);
  if (!start || !end || start.value > end.value) return false;

  const today = getLocalDateKey(now);
  return start.value <= today.value && today.value <= end.value;
}

export function selectHomeBannerItems<T extends HomeBannerCandidate>(items: readonly T[], now = new Date()): T[] {
  return items.filter((item) => isHomeBannerActive(item, now));
}

export function formatPriceKrw(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
