-- Canonicalize legacy rows before enforcing the opt-in/date invariant.
UPDATE public.gonggu_submissions
SET
  home_banner_start_date = NULL,
  home_banner_end_date = NULL
WHERE is_home_banner = FALSE
  AND (home_banner_start_date IS NOT NULL OR home_banner_end_date IS NOT NULL);

UPDATE public.group_buys
SET
  home_banner_start_date = NULL,
  home_banner_end_date = NULL
WHERE is_home_banner = FALSE
  AND (home_banner_start_date IS NOT NULL OR home_banner_end_date IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gonggu_submissions_home_banner_opt_in_dates_check'
  ) THEN
    ALTER TABLE public.gonggu_submissions
      ADD CONSTRAINT gonggu_submissions_home_banner_opt_in_dates_check
      CHECK (
        is_home_banner
        OR (home_banner_start_date IS NULL AND home_banner_end_date IS NULL)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_buys_home_banner_opt_in_dates_check'
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_home_banner_opt_in_dates_check
      CHECK (
        is_home_banner
        OR (home_banner_start_date IS NULL AND home_banner_end_date IS NULL)
      );
  END IF;
END
$$;
