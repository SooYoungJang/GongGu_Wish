import { describe, expect, it } from "vitest";

import {
  AUTOMATIC_COLLECTION_SOURCE_TYPES,
  isAutomaticCollectionSource,
} from "./automatic-collection";

describe("automatic collection sources", () => {
  it("recognizes Playwright and manual discovery sources", () => {
    expect(AUTOMATIC_COLLECTION_SOURCE_TYPES).toEqual([
      "PLAYWRIGHT_PUBLIC",
      "MANUAL_DISCOVERY",
    ]);
    expect(isAutomaticCollectionSource("PLAYWRIGHT_PUBLIC")).toBe(true);
    expect(isAutomaticCollectionSource("MANUAL_DISCOVERY")).toBe(true);
    expect(isAutomaticCollectionSource("SUBMISSION")).toBe(false);
    expect(isAutomaticCollectionSource(null)).toBe(false);
  });
});
