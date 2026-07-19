ALTER TABLE "users"
  ALTER COLUMN "push_enabled" SET DEFAULT false,
  ALTER COLUMN "deadline_reminders_enabled" SET DEFAULT false,
  ALTER COLUMN "new_submissions_enabled" SET DEFAULT false;
