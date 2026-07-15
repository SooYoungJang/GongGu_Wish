-- Restore the submission tables that predate the Supabase RLS migration.
-- The production database may already contain these objects, so every object
-- that can be reconciled safely is created idempotently.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'SubmissionStatus'
  ) THEN
    CREATE TYPE public."SubmissionStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED',
      'DUPLICATE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gonggu_submissions (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  product_name VARCHAR(100) NOT NULL,
  brand_name VARCHAR(50),
  start_date TIMESTAMP(3),
  end_date TIMESTAMP(3),
  purchase_url TEXT,
  discount_info VARCHAR(200),
  summary VARCHAR(500),
  instagram_url TEXT,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  reporter_name VARCHAR(30),
  reporter_contact VARCHAR(100),
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  content_hash VARCHAR(64) NOT NULL,
  status public."SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  admin_memo TEXT,
  reviewed_at TIMESTAMP(3),
  reviewed_by TEXT,
  group_buy_id TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT gonggu_submissions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS gonggu_submissions_status_idx
  ON public.gonggu_submissions (status);
CREATE INDEX IF NOT EXISTS gonggu_submissions_created_at_idx
  ON public.gonggu_submissions (created_at);
CREATE INDEX IF NOT EXISTS gonggu_submissions_product_name_idx
  ON public.gonggu_submissions (product_name);
CREATE UNIQUE INDEX IF NOT EXISTS gonggu_submissions_content_hash_key
  ON public.gonggu_submissions (content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS gonggu_submissions_group_buy_id_key
  ON public.gonggu_submissions (group_buy_id);

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'CRAWLED',
  ADD COLUMN IF NOT EXISTS submission_id TEXT,
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS group_buys_source_type_idx
  ON public.group_buys (source_type);
CREATE UNIQUE INDEX IF NOT EXISTS group_buys_submission_id_key
  ON public.group_buys (submission_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gonggu_submissions'::regclass
      AND conname = 'gonggu_submissions_group_buy_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.gonggu_submissions AS submission
    LEFT JOIN public.group_buys AS group_buy
      ON group_buy.id = submission.group_buy_id
    WHERE submission.group_buy_id IS NOT NULL
      AND group_buy.id IS NULL
  ) THEN
    ALTER TABLE public.gonggu_submissions
      ADD CONSTRAINT gonggu_submissions_group_buy_id_fkey
      FOREIGN KEY (group_buy_id)
      REFERENCES public.group_buys (id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.group_buys'::regclass
      AND conname = 'group_buys_submission_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.group_buys AS group_buy
    LEFT JOIN public.gonggu_submissions AS submission
      ON submission.id = group_buy.submission_id
    WHERE group_buy.submission_id IS NOT NULL
      AND submission.id IS NULL
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_submission_id_fkey
      FOREIGN KEY (submission_id)
      REFERENCES public.gonggu_submissions (id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
