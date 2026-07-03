ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS is_monthly_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monthly_featured_rank INTEGER;

CREATE INDEX IF NOT EXISTS group_buys_monthly_featured_idx
  ON public.group_buys (is_monthly_featured, monthly_featured_rank, end_date);
