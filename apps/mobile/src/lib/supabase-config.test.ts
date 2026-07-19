import { describe, expect, it } from "vitest";

import {
  resolveDataApiUrl,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "./supabase-config";

describe("resolveSupabaseAnonKey", () => {
  it("requires an explicit anon key", () => {
    expect(() => resolveSupabaseAnonKey(undefined)).toThrow(
      "Supabase anon key must be configured",
    );
    expect(() => resolveSupabaseAnonKey("  ")).toThrow(
      "Supabase anon key must be configured",
    );
  });

  it("normalizes a configured anon key", () => {
    expect(resolveSupabaseAnonKey(" anon-key ")).toBe("anon-key");
  });
});

describe("resolveSupabaseUrl", () => {
  it("requires an explicit Supabase origin for normal app builds", () => {
    expect(() => resolveSupabaseUrl(undefined)).toThrow(
      "Supabase origin must be configured",
    );
  });

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

  it("requires an explicit proxy for normal app builds", () => {
    expect(() =>
      resolveDataApiUrl("https://project.supabase.co", "  "),
    ).toThrow("API proxy origin must be configured");
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
