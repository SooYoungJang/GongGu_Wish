-- Match the follow-up Prisma migration while tolerating an already-reconciled
-- production schema.
ALTER TABLE public.gonggu_submissions
  DROP CONSTRAINT IF EXISTS gonggu_submissions_group_buy_id_fkey;

ALTER TABLE public.gonggu_submissions
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN product_name SET DATA TYPE TEXT,
  ALTER COLUMN brand_name SET DATA TYPE TEXT,
  ALTER COLUMN discount_info SET DATA TYPE TEXT,
  ALTER COLUMN summary SET DATA TYPE TEXT,
  ALTER COLUMN reporter_name SET DATA TYPE TEXT,
  ALTER COLUMN reporter_contact SET DATA TYPE TEXT,
  ALTER COLUMN content_hash SET DATA TYPE TEXT,
  ALTER COLUMN updated_at DROP DEFAULT;

UPDATE public.group_buys
SET is_all_day = false
WHERE is_all_day IS NULL;

ALTER TABLE public.group_buys
  ALTER COLUMN source_type SET DATA TYPE TEXT,
  ALTER COLUMN is_all_day SET NOT NULL;
