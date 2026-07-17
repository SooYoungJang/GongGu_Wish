import { describe, expect, it } from 'vitest';

import type { GroupBuy } from '../types';
import {
  doesGroupBuyOverlapRange,
  filterActiveGroupBuys,
  formatDateKey,
  isGroupBuyActiveOnDate,
  parseDateKey,
} from './groupBuyDates';

function makeGroupBuy(overrides: Partial<GroupBuy>): GroupBuy {
  return {
    id: 'gb-date-test',
    productName: '거제 소노캄',
    brandName: null,
    category: 'living',
    startDate: null,
    endDate: null,
    purchaseUrl: null,
    discountInfo: null,
    summary: null,
    confidence: 1,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://www.instagram.com/p/test',
      influencer: {
        instagramUsername: 'test_user',
      },
    },
    ...overrides,
  };
}

describe('groupBuyDates', () => {
  it('parses date keys as local calendar dates without shifting the day', () => {
    const date = parseDateKey('2026-07-02');

    expect(date).not.toBeNull();
    expect(formatDateKey(date!)).toBe('2026-07-02');
  });

  it('rejects invalid date keys', () => {
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('2026-7-2')).toBeNull();
  });

  it('treats a group buy as active between startDate and endDate', () => {
    const item = makeGroupBuy({
      startDate: '2026-07-01T00:00:00',
      endDate: '2026-12-31T00:00:00',
    });

    expect(isGroupBuyActiveOnDate(item, new Date('2026-07-03T12:00:00'))).toBe(true);
  });

  it('does not include dates outside the group buy range', () => {
    const item = makeGroupBuy({
      startDate: '2026-07-01T00:00:00',
      endDate: '2026-12-31T00:00:00',
    });

    expect(isGroupBuyActiveOnDate(item, new Date('2026-06-30T12:00:00'))).toBe(false);
    expect(isGroupBuyActiveOnDate(item, new Date('2027-01-01T12:00:00'))).toBe(false);
  });

  it('filters group buys that ended before the current local day', () => {
    const asOf = new Date(2026, 6, 18, 12);
    const expired = makeGroupBuy({
      id: 'gb-expired',
      endDate: '2026-07-16T23:59:59',
    });
    const endingToday = makeGroupBuy({
      id: 'gb-ending-today',
      endDate: '2026-07-18T00:00:00',
    });
    const noDeadline = makeGroupBuy({ id: 'gb-no-deadline' });

    expect(filterActiveGroupBuys([expired, endingToday, noDeadline], asOf).map((item) => item.id)).toEqual([
      'gb-ending-today',
      'gb-no-deadline',
    ]);
  });

  it('includes group buys that overlap the selected week', () => {
    const item = makeGroupBuy({
      startDate: '2026-07-01T00:00:00',
      endDate: '2026-12-31T00:00:00',
    });

    expect(
      doesGroupBuyOverlapRange(
        item,
        new Date('2026-06-29T00:00:00'),
        new Date('2026-07-05T23:59:59'),
      ),
    ).toBe(true);
  });

  it('includes a mid-week group buy in the week that starts before it opens', () => {
    const item = makeGroupBuy({
      productName: '미디어테스트 20260702T163723Z',
      startDate: '2026-07-02T00:00:00',
      endDate: '2026-07-04T00:00:00',
    });

    expect(
      doesGroupBuyOverlapRange(
        item,
        new Date('2026-06-29T00:00:00'),
        new Date('2026-07-05T23:59:59'),
      ),
    ).toBe(true);
    expect(isGroupBuyActiveOnDate(item, new Date('2026-06-30T12:00:00'))).toBe(false);
  });
});
