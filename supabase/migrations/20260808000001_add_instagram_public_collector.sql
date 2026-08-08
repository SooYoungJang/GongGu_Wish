-- Public Instagram collection is disabled by default. The worker must be
-- enabled globally and per influencer after the operator has reviewed the
-- applicable Instagram/Meta terms and obtained the required authorization.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'RawPostCollectionSource'
  ) THEN
    CREATE TYPE "RawPostCollectionSource" AS ENUM (
      'LEGACY_INSTAGRAPI',
      'PLAYWRIGHT_PUBLIC'
    );
  END IF;
END
$$;

ALTER TYPE "ParsingStatus" ADD VALUE IF NOT EXISTS 'NOT_KOREA';

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS playwright_collection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS playwright_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS playwright_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS playwright_last_error text,
  ADD COLUMN IF NOT EXISTS playwright_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playwright_next_run_at timestamptz;

ALTER TABLE public.raw_posts
  ADD COLUMN IF NOT EXISTS is_korea_candidate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_source "RawPostCollectionSource" NOT NULL DEFAULT 'LEGACY_INSTAGRAPI';

CREATE INDEX IF NOT EXISTS raw_posts_collection_source_candidate_idx
  ON public.raw_posts (collection_source, is_candidate, is_korea_candidate);

CREATE INDEX IF NOT EXISTS influencers_playwright_watchlist_idx
  ON public.influencers (playwright_collection_enabled, is_active, playwright_next_run_at);
