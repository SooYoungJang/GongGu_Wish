import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./env";

describe("getSupabaseConfig", () => {
  it("removes surrounding whitespace and a BOM from both values", () => {
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: " \uFEFFhttps://preview-project.supabase.co\r\n",
        VITE_SUPABASE_ANON_KEY: " \uFEFFpreview-anon-key\r\n",
      })
    ).toEqual({
      supabaseUrl: "https://preview-project.supabase.co",
      supabaseAnonKey: "preview-anon-key",
    });
  });

  it("rejects values that are empty after normalization", () => {
    expect(() =>
      getSupabaseConfig({
        VITE_SUPABASE_URL: "\uFEFF ",
        VITE_SUPABASE_ANON_KEY: "preview-anon-key",
      })
    ).toThrow(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env"
    );
  });
});
