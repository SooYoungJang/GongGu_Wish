ALTER TABLE public.gonggu_submissions
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gonggu_submissions_category_check'
  ) THEN
    ALTER TABLE public.gonggu_submissions
      ADD CONSTRAINT gonggu_submissions_category_check
      CHECK (
        category IS NULL
        OR category IN ('beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_buys_category_check'
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_category_check
      CHECK (
        category IS NULL
        OR category IN ('beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gonggu_submissions_category_idx
  ON public.gonggu_submissions (category);

CREATE INDEX IF NOT EXISTS group_buys_category_idx
  ON public.group_buys (category);
