import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";

import {
  readStreamToBuffer,
  validateBundledSupabasePublicConfig,
  validateSupabasePublicConfig,
} from "./validate-supabase-public-config.mjs";

const supabaseUrl = "https://preview-project.supabase.co";

test("reads an Android bundle from stdin-compatible streams", async () => {
  const bundle = await readStreamToBuffer(
    Readable.from([Buffer.from("first"), Buffer.from("-second")]),
  );

  assert.equal(bundle.toString("utf8"), "first-second");
});

test("keeps Preview Supabase configuration in EAS environment variables", async () => {
  const easConfig = JSON.parse(
    await readFile(new URL("../eas.json", import.meta.url), "utf8"),
  );
  const previewProfileEnv = easConfig.build.preview.env;

  assert.equal("EXPO_PUBLIC_SUPABASE_URL" in previewProfileEnv, false);
  assert.equal("EXPO_PUBLIC_SUPABASE_ANON_KEY" in previewProfileEnv, false);
});

test("accepts a public key that the configured Supabase project recognizes", async () => {
  const publicKey = "sb_publishable_valid-preview-public-key";
  let request;

  await validateSupabasePublicConfig({
    publicKey,
    supabaseUrl,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(request.url, `${supabaseUrl}/auth/v1/settings`);
  assert.equal(request.options.headers.apikey, publicKey);
});

test("rejects a revoked public key without exposing it in the error", async () => {
  const publicKey = "sb_publishable_revoked-preview-public-key";

  await assert.rejects(
    validateSupabasePublicConfig({
      publicKey,
      supabaseUrl,
      fetchImpl: async () =>
        new Response('{"message":"Invalid API key"}', { status: 401 }),
    }),
    (error) => {
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, new RegExp(publicKey));
      return true;
    },
  );
});

test("rejects a legacy anon key issued for a different Supabase project", async () => {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "supabase", ref: "another-project", role: "anon" }),
  ).toString("base64url");
  const publicKey = `${header}.${payload}.signature`;

  await assert.rejects(
    validateSupabasePublicConfig({
      publicKey,
      supabaseUrl,
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /does not match the configured Supabase project/,
  );
});

test("rejects a modern secret key before it can be embedded in the app", async () => {
  await assert.rejects(
    validateSupabasePublicConfig({
      publicKey: "sb_secret_server-only-key",
      supabaseUrl,
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /publishable key/,
  );
});

test("accepts only the validated Supabase configuration in the Android bundle", async () => {
  const publicKey = "sb_publishable_valid-preview-public-key";

  await validateBundledSupabasePublicConfig({
    bundle: Buffer.from(`${supabaseUrl}\n${publicKey}`, "utf8"),
    expectedPublicKey: publicKey,
    expectedSupabaseUrl: supabaseUrl,
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
});

test("rejects a stale bundled key without exposing either key", async () => {
  const expectedPublicKey = "sb_publishable_current-preview-public-key";
  const bundledPublicKey = "sb_publishable_stale-preview-public-key";

  await assert.rejects(
    validateBundledSupabasePublicConfig({
      bundle: Buffer.from(`${supabaseUrl}\n${bundledPublicKey}`, "utf8"),
      expectedPublicKey,
      expectedSupabaseUrl: supabaseUrl,
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    (error) => {
      assert.match(error.message, /does not match the validated environment/);
      assert.doesNotMatch(error.message, new RegExp(expectedPublicKey));
      assert.doesNotMatch(error.message, new RegExp(bundledPublicKey));
      return true;
    },
  );
});

test("rejects a bundle that retains both current and stale public keys", async () => {
  const expectedPublicKey = "sb_publishable_current-preview-public-key";
  const stalePublicKey = "sb_publishable_stale-preview-public-key";

  await assert.rejects(
    validateBundledSupabasePublicConfig({
      bundle: Buffer.from(
        `${supabaseUrl}\n${expectedPublicKey}\n${stalePublicKey}`,
        "utf8",
      ),
      expectedPublicKey,
      expectedSupabaseUrl: supabaseUrl,
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    (error) => {
      assert.match(error.message, /exactly one Supabase public configuration/);
      assert.doesNotMatch(error.message, new RegExp(expectedPublicKey));
      assert.doesNotMatch(error.message, new RegExp(stalePublicKey));
      return true;
    },
  );
});
