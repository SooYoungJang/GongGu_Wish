import { describe, expect, it } from "vitest";

import {
  insertReelsAdSlots,
  isReelsContentItem,
} from "./reelsAdPlacement";

const items = Array.from({ length: 30 }, (_, index) => ({
  id: `deal-${index + 1}`,
}));

describe("insertReelsAdSlots", () => {
  it("keeps content unchanged when ads are disabled", () => {
    const result = insertReelsAdSlots(items.slice(0, 12), { enabled: false });

    expect(result).toHaveLength(12);
    expect(result.every(isReelsContentItem)).toBe(true);
  });

  it("does not place an ad before there is content after the first break", () => {
    expect(insertReelsAdSlots(items.slice(0, 8), { enabled: true })).toHaveLength(
      8,
    );
  });

  it("places the first ad after eight organic Reels", () => {
    const result = insertReelsAdSlots(items.slice(0, 9), { enabled: true });

    expect(result.map((item) => item.kind)).toEqual([
      "content",
      "content",
      "content",
      "content",
      "content",
      "content",
      "content",
      "content",
      "ad",
      "content",
    ]);
  });

  it("adds another ad after every ten additional organic Reels", () => {
    const result = insertReelsAdSlots(items, { enabled: true });
    const adIndexes = result.flatMap((item, index) =>
      item.kind === "ad" ? [index] : [],
    );

    expect(adIndexes).toEqual([8, 19, 30]);
    expect(result.filter(isReelsContentItem)).toHaveLength(items.length);
  });

  it("creates deterministic keys without colliding with content", () => {
    const first = insertReelsAdSlots(items.slice(0, 20), { enabled: true });
    const second = insertReelsAdSlots(items.slice(0, 20), { enabled: true });

    expect(first.map((item) => item.key)).toEqual(
      second.map((item) => item.key),
    );
    expect(new Set(first.map((item) => item.key)).size).toBe(first.length);
  });
});
