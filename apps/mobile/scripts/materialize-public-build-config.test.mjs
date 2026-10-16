import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderPublicBuildConfig } from "./materialize-public-build-config.mjs";

test("materializes public configuration inside the EAS build workspace", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    packageJson.scripts["eas-build-post-install"],
    "node scripts/validate-supabase-public-config.mjs && node scripts/materialize-public-build-config.mjs",
  );
});

test("renders validated public values without leaving process.env lookups", () => {
  const values = {
    apiProxyUrl: "https://api.example.test",
    supabaseAnonKey: 'sb_publishable_key-with-"quote',
    supabaseUrl: "https://preview-project.supabase.co",
  };

  const source = renderPublicBuildConfig(values);

  assert.match(source, /export const publicBuildConfig/);
  assert.doesNotMatch(source, /process\.env/);
  assert.ok(source.includes(JSON.stringify(values.apiProxyUrl)));
  assert.ok(source.includes(JSON.stringify(values.supabaseAnonKey)));
  assert.ok(source.includes(JSON.stringify(values.supabaseUrl)));
});

test("rejects an incomplete public build configuration", () => {
  assert.throws(
    () =>
      renderPublicBuildConfig({
        apiProxyUrl: "",
        supabaseAnonKey: "sb_publishable_key",
        supabaseUrl: "https://preview-project.supabase.co",
      }),
    /public build configuration is incomplete/,
  );
});

test("bakes each Production release number into the exported app configuration", () => {
  const values = {
    apiProxyUrl: "https://api.example.test",
    supabaseAnonKey: "sb_publishable_key",
    supabaseUrl: "https://preview-project.supabase.co",
    appVariant: "production",
  };

  for (const releaseNumber of ["18", "19"]) {
    const source = renderPublicBuildConfig({ ...values, releaseNumber });
    assert.ok(source.includes(`"releaseNumber": "${releaseNumber}"`));
    assert.doesNotMatch(source, /process\.env/);
  }
});

test("rejects missing or invalid Production release numbers", () => {
  for (const releaseNumber of [
    undefined,
    "",
    "0",
    "-1",
    "1.5",
    "9007199254740992",
  ]) {
    assert.throws(
      () =>
        renderPublicBuildConfig({
          apiProxyUrl: "https://api.example.test",
          supabaseAnonKey: "sb_publishable_key",
          supabaseUrl: "https://preview-project.supabase.co",
          appVariant: "production",
          releaseNumber,
        }),
      /Production release number/,
    );
  }
});

test("Preview does not inherit a Production release number", () => {
  const source = renderPublicBuildConfig({
    apiProxyUrl: "https://api.example.test",
    supabaseAnonKey: "sb_publishable_key",
    supabaseUrl: "https://preview-project.supabase.co",
    appVariant: "preview",
    releaseNumber: "19",
  });
  assert.ok(source.includes('"releaseNumber": null'));
});
