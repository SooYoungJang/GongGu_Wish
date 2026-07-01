/**
 * 날짜/마감일 유틸 함수 테스트.
 *
 * formatEndDate: 사용자 친화적 마감 라벨 ("오늘 마감", "D-3" 등)
 * getDaysRemaining: 정수 일수 계산 (음수 = 마감됨)
 *
 * 타임존 독립성을 위해 setSystemTime과 마감 날짜를 같은 시각(정오)으로 맞춤.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { formatEndDate, getDaysRemaining } from '../../utils';

// 기준 시각: 2026-07-01 정오 (KST)
const NOW = '2026-07-01T12:00:00+09:00';

describe('formatEndDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('null은 "미정"을 반환한다', () => {
    expect(formatEndDate(null)).toBe('미정');
  });

  it('undefined는 "미정"을 반환한다', () => {
    expect(formatEndDate(undefined)).toBe('미정');
  });

  it('이미 지난 날짜는 "마감됨"을 반환한다', () => {
    expect(formatEndDate('2026-06-15T12:00:00+09:00')).toBe('마감됨');
  });

  it('오늘 마감인 경우 "오늘 마감"을 반환한다', () => {
    expect(formatEndDate('2026-07-01T12:00:00+09:00')).toBe('오늘 마감');
  });

  it('내일 마감인 경우 "내일 마감"을 반환한다', () => {
    expect(formatEndDate('2026-07-02T12:00:00+09:00')).toBe('내일 마감');
  });

  it('3일 남은 경우 "N일 남음" 형식을 반환한다', () => {
    expect(formatEndDate('2026-07-04T12:00:00+09:00')).toBe('7월 4일 마감 (3일 남음)');
  });

  it('잘못된 날짜 형식은 string을 반환한다', () => {
    const result = formatEndDate('invalid-date');
    expect(typeof result).toBe('string');
  });
});

describe('getDaysRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('null은 Infinity를 반환한다', () => {
    expect(getDaysRemaining(null)).toBe(Infinity);
  });

  it('undefined는 Infinity를 반환한다', () => {
    expect(getDaysRemaining(undefined)).toBe(Infinity);
  });

  it('같은 날 같은 시각이면 0을 반환한다', () => {
    expect(getDaysRemaining('2026-07-01T12:00:00+09:00')).toBe(0);
  });

  it('3일 후 같은 시각이면 3을 반환한다', () => {
    expect(getDaysRemaining('2026-07-04T12:00:00+09:00')).toBe(3);
  });

  it('과거 날짜는 음수를 반환한다', () => {
    expect(getDaysRemaining('2026-06-15T12:00:00+09:00')).toBeLessThan(0);
  });

  it('잘못된 날짜는 Infinity를 반환한다', () => {
    expect(getDaysRemaining('invalid')).toBe(Infinity);
  });

  it('마감 임계값(3일 이내)을 정확히 판별한다', () => {
    const days = getDaysRemaining('2026-07-03T12:00:00+09:00');
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(3);
  });
});

describe('마감 상태 분류 로직 (DetailScreen)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('음수 daysRemaining은 마감됨을 의미한다', () => {
    const days = getDaysRemaining('2026-06-15T12:00:00+09:00');
    const isExpired = days < 0;
    expect(isExpired).toBe(true);
  });

  it('0~3일은 긴급을 의미한다', () => {
    const days = getDaysRemaining('2026-07-03T12:00:00+09:00');
    const isUrgent = days >= 0 && days <= 3;
    expect(isUrgent).toBe(true);
  });

  it('4일 이상은 일반을 의미한다', () => {
    const days = getDaysRemaining('2026-07-10T12:00:00+09:00');
    const isNormal = days > 3;
    expect(isNormal).toBe(true);
  });

  it('null endDate는 마감 배지를 표시하지 않는다 (Infinity 처리)', () => {
    const days = getDaysRemaining(null);
    const shouldShowBadge = days !== Infinity;
    expect(shouldShowBadge).toBe(false);
  });
});
