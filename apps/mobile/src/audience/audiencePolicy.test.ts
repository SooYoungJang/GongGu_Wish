import { describe, expect, it } from "vitest";

import {
  parseStoredAgeBand,
  requiresRestrictedModeCleanup,
  resolveAudiencePolicy,
} from "./audiencePolicy";

describe("resolveAudiencePolicy", () => {
  it("fails closed while the age band is unresolved", () => {
    expect(resolveAudiencePolicy(null)).toEqual({
      resolved: false,
      canUseApp: false,
      canAuthenticate: false,
      canRequestAds: false,
      canRecordBehaviorSignals: false,
    });
  });

  it("blocks users under 13 from using the app", () => {
    expect(resolveAudiencePolicy("under13")).toEqual({
      resolved: true,
      canUseApp: false,
      canAuthenticate: false,
      canRequestAds: false,
      canRecordBehaviorSignals: false,
    });
  });

  it("allows 13-year-olds to browse without auth, ads, or behavior signals", () => {
    expect(resolveAudiencePolicy("age13")).toEqual({
      resolved: true,
      canUseApp: true,
      canAuthenticate: false,
      canRequestAds: false,
      canRecordBehaviorSignals: false,
    });
  });

  it("allows normal features for users aged 14 or older", () => {
    expect(resolveAudiencePolicy("age14Plus")).toEqual({
      resolved: true,
      canUseApp: true,
      canAuthenticate: true,
      canRequestAds: true,
      canRecordBehaviorSignals: true,
    });
  });
});

describe("parseStoredAgeBand", () => {
  it.each(["under13", "age13", "age14Plus"] as const)(
    "accepts %s",
    (ageBand) => {
      expect(parseStoredAgeBand(ageBand)).toBe(ageBand);
    },
  );

  it.each([null, "", "14", "unknown"])(
    "fails closed for invalid stored value %s",
    (value) => {
      expect(parseStoredAgeBand(value)).toBeNull();
    },
  );
});

describe("requiresRestrictedModeCleanup", () => {
  it("requires cleanup when a 14+ user changes to age 13", () => {
    expect(requiresRestrictedModeCleanup("age14Plus", "age13")).toBe(true);
  });

  it("requires cleanup when a 14+ user changes to under 13", () => {
    expect(requiresRestrictedModeCleanup("age14Plus", "under13")).toBe(true);
  });

  it("does not require cleanup for unrestricted or initial selection changes", () => {
    expect(requiresRestrictedModeCleanup(null, "age13")).toBe(false);
    expect(requiresRestrictedModeCleanup("age13", "age14Plus")).toBe(false);
    expect(requiresRestrictedModeCleanup("age14Plus", "age14Plus")).toBe(false);
  });
});
