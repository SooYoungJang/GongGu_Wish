ALTER TABLE "group_buys"
ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "group_buys_dedupe_key_key"
ON "group_buys"("dedupe_key");
