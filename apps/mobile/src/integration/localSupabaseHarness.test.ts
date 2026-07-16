import { afterEach, describe, expect, it } from "vitest";

import { requireLocalSupabaseConfig } from "./localSupabaseHarness";

const ENV_KEYS = [
  "LOCAL_SUPABASE_URL",
  "LOCAL_SUPABASE_ANON_KEY",
  "LOCAL_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("requireLocalSupabaseConfig", () => {
  it("fails clearly when a dedicated integration run has no local stack", () => {
    for (const key of ENV_KEYS) delete process.env[key];

    expect(() => requireLocalSupabaseConfig()).toThrow(
      "LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, and LOCAL_SUPABASE_SERVICE_ROLE_KEY are required",
    );
  });
});
