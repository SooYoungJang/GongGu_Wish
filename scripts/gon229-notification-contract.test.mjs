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
  const authScreen = read("apps/mobile/src/screens/AuthScreen.tsx");
  const notifications = read("apps/mobile/src/services/notifications.ts");
  const notificationPayload = read(
    "apps/mobile/src/services/notificationPayload.ts",
  );
  const flow = read(".maestro/gon-229-notification-tap.yaml");
  const preferencesFlow = read(
    ".maestro/gon-229-notification-preferences.yaml",
  );
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
  assert.match(preferencesFlow, /text: "공구위시 로그인 화면"/);
  assert.match(preferencesFlow, /id: "fl-input-email"/);
  assert.match(preferencesFlow, /id: "fl-input-password"/);
  assert.match(preferencesFlow, /id: "auth-login-submit"/);
  assert.match(authScreen, /testID="auth-login-submit"/);
  assert.match(flow, /id: "follow-influencer-notifications"/);
  assert.match(flow, /text: "@gon263_price ×"/);
  assert.match(runner, /cmd statusbar expand-notifications/);
  assert.match(runner, /auth\/v1\/signup/);
  assert.match(runner, /gon229\.e2e@example\.com/);
  assert.match(windowsBuild, /\[switch\]\$AutomatedE2E/);
  assert.match(windowsBuild, /EXPO_PUBLIC_E2E_MODE = "true"/);
  assert.match(read("apps/mobile/app.config.js"), /e2eSupabaseUrl/);
  assert.match(windowsBuild, /\[string\]\$BuildVariant = "Release"/);
  assert.match(windowsBuild, /\[string\]\$EnvFile = ""/);
  assert.match(windowsBuild, /\[IO\.Path\]::GetFullPath\(\$BuildRoot\)/);
  assert.match(windowsBuild, /\[StringComparison\]::OrdinalIgnoreCase/);
  assert.match(windowsBuild, /\^\[A-Za-z_\]\[A-Za-z0-9_\]\*\$/);
  assert.match(
    windowsBuild,
    /SetEnvironmentVariable\(\$name, \$value, "Process"\)/,
  );
  assert.match(windowsBuild, /\$installTask = "install\$BuildVariant"/);
  assert.match(windowsBuild, /\$env:NODE_ENV = "production"/);
  assert.match(windowsBuild, /gradlew\.bat \$installTask[^\n]*--no-daemon/);
  assert.match(windowsBuild, /Gradle \$installTask failed with exit code/);
  assert.match(orchestrator, /run-gon229-android-notifications\.sh/);
  assert.match(workflow, /gon229-notification-state\.txt/);
  assert.match(ciWorkflow, /supabase functions deploy register-push-token/);
  assert.doesNotMatch(workflow, /gon229[^\n]*ios/i);
});

test("Android push registration is wired to Firebase and reports failures", () => {
  const appConfig = JSON.parse(read("apps/mobile/app.json"));
  const googleServices = JSON.parse(read("apps/mobile/google-services.json"));
  const settings = read("apps/mobile/src/screens/SettingsScreen.tsx");
  const notifications = read("apps/mobile/src/services/notifications.ts");
  const gitignore = read(".gitignore");
  const androidClient = googleServices.client.find(
    (client) =>
      client.client_info?.android_client_info?.package_name ===
      appConfig.expo.android.package,
  );

  assert.equal(
    appConfig.expo.android.googleServicesFile,
    "./google-services.json",
  );
  assert.equal(
    googleServices.project_info.project_id,
    "gonggu-wish-7425b02f-2026",
  );
  assert.ok(androidClient, "Firebase config must include com.gonggu.wish");
  assert.match(settings, /registerForPushNotifications/);
  assert.match(settings, /requestPermission:\s*false/);
  assert.match(
    settings,
    /e2eTokenOverride:\s*"ExpoPushToken\[gon229-local-e2e\]"/,
  );
  assert.match(settings, /session\?\.access_token/);
  assert.match(notifications, /extra\?\.automatedE2E === true/);
  assert.match(notifications, /options\.e2eTokenOverride/);
  assert.match(notifications, /console\.warn\(/);
  assert.match(
    read("supabase/migrations/20260719000001_disable_notification_defaults.sql"),
    /GRANT SELECT, INSERT, UPDATE ON TABLE public\.users TO service_role/,
  );
  assert.match(gitignore, /\*-firebase-adminsdk-\*\.json/);
});

test("notification and bookmark actions require authentication", () => {
  const defaults = read("apps/mobile/src/services/notificationPreferences.ts");
  const edgeContract = read(
    "supabase/functions/register-push-token/contract.ts",
  );
  const authGate = read("apps/mobile/src/hooks/useAuthGate.ts");
  const detail = read("apps/mobile/src/screens/DetailScreen.tsx");
  const store = read("apps/mobile/src/screens/StoreScreen.tsx");
  const settings = read("apps/mobile/src/screens/SettingsScreen.tsx");
  const myPage = read("apps/mobile/src/screens/MyPageScreen.tsx");
  const migration = read(
    "supabase/migrations/20260719000001_disable_notification_defaults.sql",
  );

  for (const source of [defaults, edgeContract]) {
    assert.match(source, /pushEnabled:\s*false/);
    assert.match(source, /deadlineRemindersEnabled:\s*false/);
    assert.match(source, /newSubmissionsEnabled:\s*false/);
  }
  assert.match(authGate, /navigation\.navigate\("Login"\)/);
  assert.match(authGate, /isAuthenticated/);
  assert.match(detail, /const handleBookmarkPress/);
  assert.match(detail, /if \(!requireAuth\(\)\) return/);
  assert.match(detail, /onPress=\{handleBookmarkPress\}/);
  assert.match(detail, /handleInfluencerFollowPress/);
  assert.match(detail, /handleBrandFollowPress/);
  assert.match(store, /handleToggleNotification/);
  assert.match(store, /if \(!requireAuth\(\)\) return/);
  assert.match(settings, /const pushEnabled = isAuthenticated/);
  assert.match(settings, /const handleFollowInfluencerPress/);
  assert.match(settings, /const handleFollowBrandPress/);
  assert.match(
    myPage,
    /const handleRemoveBookmark[\s\S]*?if \(!requireAuth\(\)\) return;[\s\S]*?removeBookmark\(item\.id\)/,
  );
  assert.match(
    myPage,
    /const handleRemoveNotification[\s\S]*?if \(!requireAuth\(\)\) return;[\s\S]*?removeNotification\(item\.id\)/,
  );
  assert.match(migration, /ALTER COLUMN push_enabled SET DEFAULT false/);
  assert.match(
    migration,
    /ALTER COLUMN deadline_reminders_enabled SET DEFAULT false/,
  );
  assert.match(
    migration,
    /ALTER COLUMN new_submissions_enabled SET DEFAULT false/,
  );
});
