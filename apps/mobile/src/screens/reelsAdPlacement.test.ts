import { describe, expect, it } from "vitest";

import {
  insertReelsAdSlots,
  isReelsContentItem,
  REELS_AD_GAP_MAX,
  REELS_AD_GAP_MIN,
} from "./reelsAdPlacement";

const items = Array.from({ length: 30 }, (_, index) => ({
  id: `deal-${index + 1}`,
}));

// Deterministic RNG: returns a fixed sequence of values in [0,1) so tests can
// assert exact break positions. Each call advances the cursor.
function sequenceRandom(values: number[]) {
  let cursor = 0;
  return () => {
    const value = values[cursor % values.length];
    cursor += 1;
    return value;
  };
}

describe("insertReelsAdSlots", () => {
  it("keeps content unchanged when ads are disabled", () => {
    const result = insertReelsAdSlots(items.slice(0, 12), {
      enabled: false,
      random: sequenceRandom([0.999]),
    });

    expect(result).toHaveLength(12);
    expect(result.every(isReelsContentItem)).toBe(true);
  });

  it("exposes the inclusive [2, 10] gap range", () => {
    expect(REELS_AD_GAP_MIN).toBe(2);
    expect(REELS_AD_GAP_MAX).toBe(10);
  });

  it("places the first ad after the minimum gap of 2 reels", () => {
    // floor(0 * 9) + 2 = 2 -> breaks after reel 2, then after reel 4; reel 6 is
    // the final reel so no trailing ad, leaving 6 content + 2 ads = 8 entries.
    const result = insertReelsAdSlots(items.slice(0, 6), {
      enabled: true,
      random: sequenceRandom([0]),
    });

    expect(result.map((item) => item.kind)).toEqual([
      "content",
      "content",
      "ad",
      "content",
      "content",
      "ad",
      "content",
      "content",
    ]);
  });

  it("places the first ad after the maximum gap of 10 reels", () => {
    // floor(0.999 * 9) + 2 = 10 -> first break after reel 10.
    const result = insertReelsAdSlots(items.slice(0, 11), {
      enabled: true,
      random: sequenceRandom([0.999]),
    });

    const adIndexes = result.flatMap((item, index) =>
      item.kind === "ad" ? [index] : [],
    );
    expect(adIndexes).toEqual([10]);
    expect(result).toHaveLength(12);
  });

  it("never inserts an ad after the final reel", () => {
    const result = insertReelsAdSlots(items.slice(0, 2), {
      enabled: true,
      random: sequenceRandom([0]),
    });

    expect(result.every(isReelsContentItem)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("lets callers pin fixed gaps with firstAdAfter and interval", () => {
    const result = insertReelsAdSlots(items, {
      enabled: true,
      firstAdAfter: 8,
      interval: 10,
      random: sequenceRandom([0.999]),
    });
    const adIndexes = result.flatMap((item, index) =>
      item.kind === "ad" ? [index] : [],
    );

    expect(adIndexes).toEqual([8, 19, 30]);
    expect(result.filter(isReelsContentItem)).toHaveLength(items.length);
  });

  it("creates deterministic keys without colliding with content", () => {
    const random = sequenceRandom([0, 0.5, 0.25]);
    const first = insertReelsAdSlots(items.slice(0, 20), {
      enabled: true,
      random,
    });
    const second = insertReelsAdSlots(items.slice(0, 20), {
      enabled: true,
      random: sequenceRandom([0, 0.5, 0.25]),
    });

    expect(first.map((item) => item.key)).toEqual(
      second.map((item) => item.key),
    );
    expect(new Set(first.map((item) => item.key)).size).toBe(first.length);
  });
});
