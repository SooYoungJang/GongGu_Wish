import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./env";

describe("getSupabaseConfig", () => {
  it("removes surrounding whitespace and a BOM from both values", () => {
    expect(
      getSupabaseConfig({
        VITE_APP_ENV: "development",
        VITE_COMMIT_SHA: "local",
        VITE_SUPABASE_URL: " \uFEFFhttps://preview-project.supabase.co\r\n",
        VITE_SUPABASE_ANON_KEY: " \uFEFFpreview-anon-key\r\n",
      }),
    ).toEqual({
      supabaseUrl: "https://preview-project.supabase.co",
      supabaseAnonKey: "preview-anon-key",
      appEnvironment: "development",
      commitSha: "local",
      gitRef: "local",
      projectRef: "preview-project",
      adminApiOrigin:
        "https://preview-project.supabase.co/functions/v1/admin-api",
    });
  });

  it("rejects values that are empty after normalization", () => {
    expect(() =>
      getSupabaseConfig({
        VITE_APP_ENV: "development",
        VITE_COMMIT_SHA: "local",
        VITE_SUPABASE_URL: "\uFEFF ",
        VITE_SUPABASE_ANON_KEY: "preview-anon-key",
      }),
    ).toThrow(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env",
    );
  });

  it("binds Preview builds to the Preview Supabase project and commit", () => {
    expect(
      getSupabaseConfig({
        VITE_APP_ENV: "preview",
        VITE_COMMIT_SHA: "a".repeat(40),
        VITE_GIT_REF: "develop",
        VITE_SUPABASE_URL: "https://xwblovggtvbpiusjfokq.supabase.co",
        VITE_SUPABASE_ANON_KEY: "preview-anon-key",
      }),
    ).toMatchObject({
      appEnvironment: "preview",
      commitSha: "a".repeat(40),
      projectRef: "xwblovggtvbpiusjfokq",
    });
  });

  it("rejects a Preview build pointed at Production", () => {
    expect(() =>
      getSupabaseConfig({
        VITE_APP_ENV: "preview",
        VITE_COMMIT_SHA: "a".repeat(40),
        VITE_GIT_REF: "develop",
        VITE_SUPABASE_URL: "https://iosdoheblabfimkjnvfj.supabase.co",
        VITE_SUPABASE_ANON_KEY: "production-anon-key",
      }),
    ).toThrow(/Preview.*Supabase/i);
  });

  it("rejects deployed builds without an exact Git commit SHA", () => {
    expect(() =>
      getSupabaseConfig({
        VITE_APP_ENV: "preview",
        VITE_COMMIT_SHA: "latest",
        VITE_GIT_REF: "develop",
        VITE_SUPABASE_URL: "https://xwblovggtvbpiusjfokq.supabase.co",
        VITE_SUPABASE_ANON_KEY: "preview-anon-key",
      }),
    ).toThrow(/commit SHA/i);
  });

  it("rejects a Production Vercel build from any branch except main", () => {
    expect(() =>
      getSupabaseConfig({
        VITE_APP_ENV: "production",
        VITE_COMMIT_SHA: "a".repeat(40),
        VITE_GIT_REF: "develop",
        VITE_SUPABASE_URL: "https://iosdoheblabfimkjnvfj.supabase.co",
        VITE_SUPABASE_ANON_KEY: "production-anon-key",
      }),
    ).toThrow(/main branch/i);
  });
});
