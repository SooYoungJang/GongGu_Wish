import { describe, expect, it } from 'vitest';

import { formatPriceKrw } from './price';

describe('formatPriceKrw', () => {
  it('formats valid won amounts for product surfaces', () => {
    expect(formatPriceKrw(25900)).toBe('25,900원');
    expect(formatPriceKrw(0)).toBe('0원');
  });

  it('returns null for missing or invalid amounts', () => {
    expect(formatPriceKrw(null)).toBeNull();
    expect(formatPriceKrw(undefined)).toBeNull();
    expect(formatPriceKrw('25900')).toBeNull();
    expect(formatPriceKrw(1.5)).toBeNull();
  });
});
