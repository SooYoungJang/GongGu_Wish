import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Android E2E uses verified adb-reversed localhost origins", () => {
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");
  const seed = read("supabase/seed.sql");
  const runner = read("scripts/run-gon263-android-e2e.sh");

  assert.match(workflow, /EXPO_PUBLIC_SUPABASE_URL=http:\/\/localhost:54321/);
  assert.doesNotMatch(seed, /127\.0\.0\.1:58080/);
  assert.match(seed, /http:\/\/localhost:58080\/media\/fixture\.mp4/);
  assert.match(runner, /adb-reverse-after-install\.txt/);
  assert.match(runner, /device-supabase-probe\.txt/);
  assert.match(runner, /device-media-probe\.txt/);
  assert.match(runner, /toybox nc/);
});
