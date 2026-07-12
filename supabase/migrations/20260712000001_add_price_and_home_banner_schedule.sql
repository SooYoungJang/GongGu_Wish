-- Additive commerce fields used by the admin live preview and the real home banner.
ALTER TABLE public.gonggu_submissions
  ADD COLUMN IF NOT EXISTS price_krw INTEGER,
  ADD COLUMN IF NOT EXISTS is_home_banner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS home_banner_start_date DATE,
  ADD COLUMN IF NOT EXISTS home_banner_end_date DATE;

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS price_krw INTEGER,
  ADD COLUMN IF NOT EXISTS is_home_banner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS home_banner_start_date DATE,
  ADD COLUMN IF NOT EXISTS home_banner_end_date DATE;

-- Preserve today's home experience for approved, non-expired rows. Upcoming
-- deals already visible on Home must remain visible before their commerce start.
-- New rows remain opt-in.
UPDATE public.group_buys
SET
  is_home_banner = TRUE,
  home_banner_start_date = LEAST(COALESCE(start_date::DATE, CURRENT_DATE), CURRENT_DATE),
  -- A null commerce end date historically meant no automatic expiry.
  home_banner_end_date = COALESCE(end_date::DATE, DATE '9999-12-31')
WHERE status = 'APPROVED'
  AND (end_date IS NULL OR end_date::DATE >= CURRENT_DATE)
  AND is_home_banner = FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gonggu_submissions_price_krw_check'
  ) THEN
    ALTER TABLE public.gonggu_submissions
      ADD CONSTRAINT gonggu_submissions_price_krw_check
      CHECK (price_krw IS NULL OR price_krw >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_buys_price_krw_check'
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_price_krw_check
      CHECK (price_krw IS NULL OR price_krw >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gonggu_submissions_home_banner_schedule_check'
  ) THEN
    ALTER TABLE public.gonggu_submissions
      ADD CONSTRAINT gonggu_submissions_home_banner_schedule_check
      CHECK (
        (NOT is_home_banner OR (home_banner_start_date IS NOT NULL AND home_banner_end_date IS NOT NULL))
        AND (home_banner_start_date IS NULL OR home_banner_end_date IS NULL OR home_banner_start_date <= home_banner_end_date)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_buys_home_banner_schedule_check'
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_home_banner_schedule_check
      CHECK (
        (NOT is_home_banner OR (home_banner_start_date IS NOT NULL AND home_banner_end_date IS NOT NULL))
        AND (home_banner_start_date IS NULL OR home_banner_end_date IS NULL OR home_banner_start_date <= home_banner_end_date)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_buys_home_banner_schedule_idx
  ON public.group_buys (home_banner_start_date, home_banner_end_date)
  WHERE is_home_banner = TRUE;

-- Rollback (manual, only before consumers write these fields):
-- DROP INDEX IF EXISTS public.group_buys_home_banner_schedule_idx;
-- ALTER TABLE public.gonggu_submissions DROP CONSTRAINT IF EXISTS gonggu_submissions_price_krw_check,
--   DROP CONSTRAINT IF EXISTS gonggu_submissions_home_banner_schedule_check,
--   DROP COLUMN IF EXISTS price_krw, DROP COLUMN IF EXISTS is_home_banner,
--   DROP COLUMN IF EXISTS home_banner_start_date, DROP COLUMN IF EXISTS home_banner_end_date;
-- ALTER TABLE public.group_buys DROP CONSTRAINT IF EXISTS group_buys_price_krw_check,
--   DROP CONSTRAINT IF EXISTS group_buys_home_banner_schedule_check,
--   DROP COLUMN IF EXISTS price_krw, DROP COLUMN IF EXISTS is_home_banner,
--   DROP COLUMN IF EXISTS home_banner_start_date, DROP COLUMN IF EXISTS home_banner_end_date;
