import { describe, expect, it } from 'vitest';

import { getRandomReelIndex } from './reelNavigation';

describe('getRandomReelIndex', () => {
  it('returns the only available index for a one-item feed', () => {
    expect(getRandomReelIndex(1, 0, () => 0.5)).toBe(0);
  });

  it('selects a different index without depending on random retries', () => {
    expect(getRandomReelIndex(4, 1, () => 0)).toBe(0);
    expect(getRandomReelIndex(4, 1, () => 0.99)).toBe(3);
  });

  it('clamps an invalid random value to the valid index range', () => {
    expect(getRandomReelIndex(3, 0, () => 1)).toBe(2);
  });
});
