import { describe, expect, it } from "vitest";

import { isAdsRuntimeSmokeEnabled } from "./AdsRuntimeSmokeProbe";

describe("isAdsRuntimeSmokeEnabled", () => {
  it("requires an explicit build-time boolean flag", () => {
    expect(isAdsRuntimeSmokeEnabled({ adsRuntimeSmoke: true })).toBe(true);
    expect(isAdsRuntimeSmokeEnabled({ adsRuntimeSmoke: "true" })).toBe(false);
    expect(isAdsRuntimeSmokeEnabled({})).toBe(false);
  });
});
