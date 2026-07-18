import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

test("notification preference schema stays additive and consistent", () => {
  const migration = read(
    "supabase/migrations/20260717000001_add_notification_preferences.sql",
  );
  const prismaMigration = read(
    "apps/api/prisma/migrations/20260717000001_add_notification_preferences/migration.sql",
  );
  const schema = read("apps/api/prisma/schema.prisma");
  const columns = [
    "push_enabled",
    "deadline_reminders_enabled",
    "new_submissions_enabled",
    "notification_reminder_days",
    "followed_influencers",
    "followed_brands",
  ];

  for (const column of columns) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
    assert.match(prismaMigration, new RegExp(`ADD COLUMN "${column}"`));
    assert.match(schema, new RegExp(`@map\\("${column}"\\)`));
  }
  assert.match(migration, /DEFAULT ARRAY\[1, 3, 7\]::integer\[\]/);
  assert.match(migration, /cardinality\(notification_reminder_days\) >= 1/);
  assert.match(migration, /FUNCTION public\.claim_expo_push_token/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.doesNotMatch(migration, /users_followed_influencers_idx/);
  assert.match(
    prismaMigration,
    /cardinality\("notification_reminder_days"\) >= 1/,
  );
});

test("authenticated preference reads cannot mutate or leak push tokens", () => {
  const contract = read("supabase/functions/register-push-token/contract.ts");
  const handler = read("supabase/functions/register-push-token/index.ts");

  assert.match(contract, /value\.action === "read"/);
  assert.match(contract, /readOnly: true/);
  assert.match(contract, /value\.reminderDays\.length === 0/);
  assert.match(handler, /notification_preferences_read/);
  assert.match(handler, /registered: Boolean\(existing\?\.push_token\)/);
  assert.match(handler, /push_token: null, push_provider: null/);
  assert.match(handler, /\.rpc\(\s*"claim_expo_push_token"/);
  assert.doesNotMatch(handler, /return json\(\{ error: message \}, 500\)/);
});

test("Android notification runtime covers consent, deep links, and persistence", () => {
  const easConfig = JSON.parse(read("apps/mobile/eas.json"));
  const app = read("apps/mobile/src/App.tsx");
  const settings = read("apps/mobile/src/screens/SettingsScreen.tsx");
  const notifications = read("apps/mobile/src/services/notifications.ts");
  const notificationPayload = read(
    "apps/mobile/src/services/notificationPayload.ts",
  );
  const flow = read(".maestro/gon-229-notification-tap.yaml");
  const runner = read("scripts/run-gon229-android-notifications.sh");
  const windowsBuild = read("scripts/android-build-install.ps1");
  const orchestrator = read("scripts/run-gon263-android-e2e.sh");
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");
  const ciWorkflow = read(".github/workflows/ci.yml");
  const supabaseSeed = read("supabase/seed.sql");
  const localFixtureServer = read("scripts/mobile-e2e-api-server.mjs");
  const sharedFixtureId = "gon263-e2e-price-200000";

  assert.equal(easConfig.build.development.environment, "development");
  assert.match(app, /requestPermission: false/);
  assert.match(app, /Constants\.expoConfig\?\.extra\?\.e2eSupabaseUrl/);
  assert.match(settings, /testID="push-notification-toggle"/);
  assert.match(settings, /Constants\.expoConfig\?\.extra\?\.automatedE2E/);
  assert.match(settings, new RegExp(sharedFixtureId));
  assert.match(supabaseSeed, new RegExp(sharedFixtureId));
  assert.match(localFixtureServer, new RegExp(sharedFixtureId));
  assert.match(settings, /testID=\{`deadline-reminder-day-\$\{day\}`\}/);
  assert.match(notifications, /clearLastNotificationResponseAsync/);
  assert.match(notifications, /buildGroupBuyNotificationUrl/);
  assert.match(notificationPayload, /gongguwish:\/\/group-buy\//);
  assert.match(flow, /text: "\.\*푸시 테스트\.\*"/);
  assert.match(flow, /id: "follow-influencer-notifications"/);
  assert.match(flow, /text: "@gon263_price ×"/);
  assert.match(runner, /cmd statusbar expand-notifications/);
  assert.match(windowsBuild, /\[switch\]\$AutomatedE2E/);
  assert.match(windowsBuild, /EXPO_PUBLIC_E2E_MODE = "true"/);
  assert.match(read("apps/mobile/app.config.js"), /e2eSupabaseUrl/);
  assert.match(windowsBuild, /gradlew\.bat installDebug[^\n]*--no-daemon/);
  assert.match(orchestrator, /run-gon229-android-notifications\.sh/);
  assert.match(workflow, /gon229-notification-state\.txt/);
  assert.match(ciWorkflow, /supabase functions deploy register-push-token/);
  assert.doesNotMatch(workflow, /gon229[^\n]*ios/i);
});
