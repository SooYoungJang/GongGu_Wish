CREATE TABLE "gonggu_submission_submitters" (
  "submission_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gonggu_submission_submitters_pkey"
    PRIMARY KEY ("submission_id", "user_id")
);

CREATE TABLE "submission_approval_push_outbox" (
  "id" BIGSERIAL NOT NULL,
  "submission_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "group_buy_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL DEFAULT 'submission_approved',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_approval_push_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gonggu_submission_submitters_user_id_idx"
  ON "gonggu_submission_submitters"("user_id", "created_at" DESC);
CREATE INDEX "submission_approval_push_outbox_pending_idx"
  ON "submission_approval_push_outbox"("status", "next_attempt_at", "created_at");
CREATE INDEX "submission_approval_push_outbox_submission_idx"
  ON "submission_approval_push_outbox"("submission_id", "created_at" DESC);
CREATE UNIQUE INDEX "submission_approval_push_outbox_event_key"
  ON "submission_approval_push_outbox"("submission_id", "user_id", "event_type");

ALTER TABLE "gonggu_submission_submitters"
  ADD CONSTRAINT "gonggu_submission_submitters_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "gonggu_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gonggu_submission_submitters"
  ADD CONSTRAINT "gonggu_submission_submitters_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_approval_push_outbox"
  ADD CONSTRAINT "submission_approval_push_outbox_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "gonggu_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_approval_push_outbox"
  ADD CONSTRAINT "submission_approval_push_outbox_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_approval_push_outbox"
  ADD CONSTRAINT "submission_approval_push_outbox_group_buy_id_fkey"
  FOREIGN KEY ("group_buy_id") REFERENCES "group_buys"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
