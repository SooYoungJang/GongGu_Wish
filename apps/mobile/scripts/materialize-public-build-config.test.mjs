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
    "node scripts/materialize-public-build-config.mjs",
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
