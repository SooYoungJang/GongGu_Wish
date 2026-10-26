import { describe, expect, it } from "vitest";
import { isFeedAppend, mergeShuffledPageItems } from "./appendStable";

describe("append-only feed identity", () => {
  it("distinguishes appended pages from a reordered or replaced first page", () => {
    expect(isFeedAppend(["a", "b"], ["a", "b", "c"])).toBe(true);
    expect(isFeedAppend(["a", "b"], ["b", "a", "c"])).toBe(false);
    expect(isFeedAppend(["a", "b"], ["a"])).toBe(false);
  });

  it("shuffles only new items and refreshes metadata without moving watched items", () => {
    const previous = { sourceIds: ["a", "b"], items: [{ id: "b", value: 1 }, { id: "a", value: 1 }] };
    const result = mergeShuffledPageItems(previous, [
      { id: "a", value: 2 }, { id: "b", value: 2 }, { id: "c", value: 2 }, { id: "d", value: 2 },
    ], items => items.reverse());
    expect(result.items.map(item => item.id)).toEqual(["b", "a", "d", "c"]);
    expect(result.items.map(item => item.value)).toEqual([2, 2, 2, 2]);
    expect(previous.items[0].value).toBe(1);
  });
});
