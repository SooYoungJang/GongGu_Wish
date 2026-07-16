import { describe, expect, it } from "vitest";

import { resolveSupabaseUrl } from "./supabase-config";

describe("resolveSupabaseUrl", () => {
  it("accepts simulator loopback origins for an E2E build", () => {
    expect(
      resolveSupabaseUrl("http://10.0.2.2:54321/", { requireLocal: true }),
    ).toBe("http://10.0.2.2:54321");
    expect(
      resolveSupabaseUrl("http://127.0.0.1:54321", { requireLocal: true }),
    ).toBe("http://127.0.0.1:54321");
    expect(
      resolveSupabaseUrl("http://localhost:54321", { requireLocal: true }),
    ).toBe("http://localhost:54321");
  });

  it("refuses a default or remote Supabase origin for an E2E build", () => {
    expect(() => resolveSupabaseUrl(undefined, { requireLocal: true })).toThrow(
      "local Supabase origin",
    );
    expect(() =>
      resolveSupabaseUrl("https://example.supabase.co", {
        requireLocal: true,
      }),
    ).toThrow("local Supabase origin");
  });
});
