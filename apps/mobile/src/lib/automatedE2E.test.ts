import { afterEach, describe, expect, it, vi } from "vitest";

const constants = vi.hoisted(() => ({
  expoConfig: { extra: {} as Record<string, unknown> },
}));

vi.mock("expo-constants", () => ({ default: constants }));

import { isAutomatedE2E } from "./automatedE2E";

describe("isAutomatedE2E", () => {
  afterEach(() => {
    constants.expoConfig.extra = {};
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  });

  it("uses the Expo config flag when it is embedded", () => {
    constants.expoConfig.extra = { automatedE2E: true };

    expect(isAutomatedE2E()).toBe(true);
  });

  it("falls back to the public build-time flag in release bundles", () => {
    process.env.EXPO_PUBLIC_E2E_MODE = "true";

    expect(isAutomatedE2E()).toBe(true);
  });

  it("stays disabled in ordinary production builds", () => {
    expect(isAutomatedE2E()).toBe(false);
  });
});
