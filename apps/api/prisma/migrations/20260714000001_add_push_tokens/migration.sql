ALTER TABLE "users"
  ADD COLUMN "push_token" TEXT,
  ADD COLUMN "push_provider" TEXT;

CREATE INDEX "users_push_token_idx" ON "users"("push_token");
