ALTER TABLE "users"
  ADD COLUMN "submission_approval_notifications_enabled" BOOLEAN NOT NULL
    DEFAULT false;

UPDATE "users"
SET "submission_approval_notifications_enabled" = "new_submissions_enabled";
