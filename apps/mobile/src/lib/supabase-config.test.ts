import { describe, expect, it } from "vitest";

import { resolveDataApiUrl, resolveSupabaseUrl } from "./supabase-config";

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

describe("resolveDataApiUrl", () => {
  it("prefers the configured HTTPS proxy for normal app builds", () => {
    expect(
      resolveDataApiUrl(
        "https://project.supabase.co",
        "https://api.gongguwish.com/",
      ),
    ).toBe("https://api.gongguwish.com");
  });

  it("falls back to the Supabase origin when no proxy is configured", () => {
    expect(resolveDataApiUrl("https://project.supabase.co", "  ")).toBe(
      "https://project.supabase.co",
    );
  });

  it("keeps the local Supabase origin for automated E2E builds", () => {
    expect(
      resolveDataApiUrl("http://10.0.2.2:54321", "https://api.gongguwish.com", {
        requireLocal: true,
      }),
    ).toBe("http://10.0.2.2:54321");
  });

  it("rejects cleartext non-local proxy origins", () => {
    expect(() =>
      resolveDataApiUrl(
        "https://project.supabase.co",
        "http://api.gongguwish.com",
      ),
    ).toThrow("HTTPS API proxy origin");
  });
});
