import { describe, expect, it } from 'vitest';

import { formatRankingUpdatedAt } from './types';

describe('formatRankingUpdatedAt', () => {
  const now = Date.parse('2026-07-11T12:00:00.000Z');

  it('formats recent ranking refreshes in Korean', () => {
    expect(formatRankingUpdatedAt(now - 20_000, now)).toBe('방금 업데이트');
    expect(formatRankingUpdatedAt(now - 7 * 60_000, now)).toBe('7분 전 업데이트');
    expect(formatRankingUpdatedAt(now - 3 * 60 * 60_000, now)).toBe('3시간 전 업데이트');
  });
});
