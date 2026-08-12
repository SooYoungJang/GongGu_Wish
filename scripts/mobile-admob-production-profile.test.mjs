import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Production APK requests verified AdMob ads", () => {
  const eas = JSON.parse(readFileSync("apps/mobile/eas.json", "utf8"));
  const production = eas.build.production;
  const productionApk = eas.build["production-apk"];

  assert.equal(production.env.EXPO_PUBLIC_ADMOB_MODE, "production");
  assert.equal(production.env.EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED, "true");
  assert.equal(productionApk.extends, "production");
});
