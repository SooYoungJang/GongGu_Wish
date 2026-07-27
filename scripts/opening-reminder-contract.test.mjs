import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

test("per-item reminders distinguish opening and deadline intent", () => {
  const migration = read(
    "supabase/migrations/20260727000001_add_opening_reminder_preferences.sql",
  );
  const api = read("apps/mobile/src/api.ts");
  const mobilePackage = JSON.parse(read("apps/mobile/package.json"));
  const notifications = read("apps/mobile/src/services/notifications.ts");
  const picker = read(
    "apps/mobile/src/context/GroupBuyReminderPickerContext.tsx",
  );

  assert.match(migration, /ADD COLUMN IF NOT EXISTS reminder_type text/);
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS reminder_time_minutes integer/,
  );
  assert.match(migration, /reminder_type = 'OPENING'/);
  assert.match(migration, /reminder_days <@ ARRAY\[0, 1, 2, 3, 4, 5, 6, 7\]/);
  assert.match(migration, /reminder_time_minutes BETWEEN 0 AND 1439/);
  assert.match(migration, /reminder_type = 'DEADLINE'/);
  assert.match(migration, /reminder_time_minutes IS NULL/);
  assert.match(migration, /FUNCTION public\.get_my_group_buy_reminders_v2/);
  assert.match(migration, /FUNCTION public\.set_my_group_buy_reminder_v2/);
  assert.equal(
    migration.match(/#variable_conflict use_column/g)?.length,
    2,
  );
  assert.match(
    migration,
    /get_my_group_buy_reminders\(\)[\s\S]*?reminder_type = 'DEADLINE'/,
  );
  assert.match(
    migration,
    /set_my_group_buy_reminder\([\s\S]*?reminder_type = 'DEADLINE'/,
  );
  assert.match(api, /rpc\/get_my_group_buy_reminders_v2/);
  assert.match(api, /rpc\/set_my_group_buy_reminder_v2/);
  assert.equal(mobilePackage.dependencies["@expo/ui"], "~55.0.17");
  assert.match(notifications, /scheduleGroupBuyOpeningReminders/);
  assert.match(notifications, /notificationType: "opening"/);
  assert.match(notifications, /channelId: "group-buy-start"/);
  assert.match(picker, /getReminderPickerMode/);
  assert.match(picker, /@expo\/ui\/datetimepicker/);
  assert.match(picker, /DEFAULT_OPENING_REMINDER_TIME_MINUTES/);
});
