import { describe, expect, it } from 'vitest';

import { formatPriceKrw, isHomeBannerActive, selectHomeBannerItems } from './homeBanner';

type HomeBannerTestItem = {
  id: string;
  isHomeBanner?: boolean;
  homeBannerStartDate?: string | null;
  homeBannerEndDate?: string | null;
};

function makeItem(overrides: Partial<HomeBannerTestItem>): HomeBannerTestItem {
  return {
    id: 'banner-test',
    isHomeBanner: true,
    homeBannerStartDate: '2026-07-02',
    homeBannerEndDate: '2026-07-04',
    ...overrides,
  };
}

describe('homeBanner', () => {
  describe('isHomeBannerActive', () => {
    it('treats start and end dates as inclusive local calendar days', () => {
      const item = makeItem({});

      expect(isHomeBannerActive(item, new Date(2026, 6, 2, 12))).toBe(true);
      expect(isHomeBannerActive(item, new Date(2026, 6, 4, 23, 59))).toBe(true);
      expect(isHomeBannerActive(item, new Date(2026, 6, 1, 23, 59))).toBe(false);
      expect(isHomeBannerActive(item, new Date(2026, 6, 5, 0))).toBe(false);
    });

    it('requires the item to be explicitly marked as a home banner', () => {
      expect(isHomeBannerActive(makeItem({ isHomeBanner: false }), new Date(2026, 6, 3))).toBe(false);
      expect(isHomeBannerActive(makeItem({ isHomeBanner: undefined }), new Date(2026, 6, 3))).toBe(false);
    });

    it('rejects missing, loose, or invalid banner date ranges', () => {
      expect(isHomeBannerActive(makeItem({ homeBannerStartDate: null }), new Date(2026, 6, 3))).toBe(false);
      expect(isHomeBannerActive(makeItem({ homeBannerEndDate: null }), new Date(2026, 6, 3))).toBe(false);
      expect(isHomeBannerActive(makeItem({ homeBannerStartDate: '2026-7-02' }), new Date(2026, 6, 3))).toBe(false);
      expect(isHomeBannerActive(makeItem({ homeBannerEndDate: '2026-02-31' }), new Date(2026, 1, 28))).toBe(false);
      expect(
        isHomeBannerActive(
          makeItem({ homeBannerStartDate: '2026-07-04', homeBannerEndDate: '2026-07-02' }),
          new Date(2026, 6, 3),
        ),
      ).toBe(false);
    });

    it('does not shift YYYY-MM-DD dates by UTC when checking an early local time', () => {
      const item = makeItem({
        homeBannerStartDate: '2026-07-02',
        homeBannerEndDate: '2026-07-02',
      });

      expect(isHomeBannerActive(item, new Date(2026, 6, 2, 0, 30))).toBe(true);
    });
  });

  describe('selectHomeBannerItems', () => {
    it('returns only active home banners while preserving input order', () => {
      const items = [
        makeItem({ id: 'inactive-flag', isHomeBanner: false }),
        makeItem({ id: 'active-1' }),
        makeItem({ id: 'expired', homeBannerEndDate: '2026-07-01' }),
        makeItem({ id: 'active-2', homeBannerStartDate: '2026-07-03', homeBannerEndDate: '2026-07-03' }),
      ];

      expect(selectHomeBannerItems(items, new Date(2026, 6, 3)).map((item) => item.id)).toEqual([
        'active-1',
        'active-2',
      ]);
    });
  });

  describe('formatPriceKrw', () => {
    it('formats nonnegative safe integers as Korean won strings', () => {
      expect(formatPriceKrw(0)).toBe('0원');
      expect(formatPriceKrw(39000)).toBe('39,000원');
    });

    it('returns null for null or invalid prices', () => {
      expect(formatPriceKrw(null)).toBeNull();
      expect(formatPriceKrw(-1)).toBeNull();
      expect(formatPriceKrw(1.5)).toBeNull();
      expect(formatPriceKrw(Number.NaN)).toBeNull();
      expect(formatPriceKrw(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
      expect(formatPriceKrw('39000')).toBeNull();
    });
  });
});
