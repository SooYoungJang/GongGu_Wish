-- Keep the Supabase migration chain aligned with the API Prisma history.
-- This is idempotent because some production databases already contain these
-- moderation columns from the API migration.
ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP(3);
