import { afterEach, describe, expect, it } from "vitest";

import {
  canRecordBehaviorSignals,
  setAudiencePolicySnapshot,
} from "./behaviorSignalsPolicy";
import { resolveAudiencePolicy } from "./audiencePolicy";

afterEach(() => {
  setAudiencePolicySnapshot(resolveAudiencePolicy(null));
});

describe("behavior signal policy snapshot", () => {
  it("fails closed before the audience is resolved", () => {
    expect(canRecordBehaviorSignals()).toBe(false);
  });

  it.each(["under13", "age13"] as const)(
    "blocks behavior signals for %s",
    (ageBand) => {
      setAudiencePolicySnapshot(resolveAudiencePolicy(ageBand));
      expect(canRecordBehaviorSignals()).toBe(false);
    },
  );

  it("allows behavior signals only for age14Plus", () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
    expect(canRecordBehaviorSignals()).toBe(true);
  });
});
