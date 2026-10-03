ALTER TYPE public."ParsingStatus"
  ADD VALUE IF NOT EXISTS 'NOT_KOREA';

DO $$
BEGIN
  CREATE TYPE public."RawPostCollectionSource" AS ENUM (
    'LEGACY_INSTAGRAPI',
    'PLAYWRIGHT_PUBLIC'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TYPE public."RawPostCollectionSource"
  ADD VALUE IF NOT EXISTS 'LEGACY_INSTAGRAPI';
ALTER TYPE public."RawPostCollectionSource"
  ADD VALUE IF NOT EXISTS 'PLAYWRIGHT_PUBLIC';
ALTER TYPE public."RawPostCollectionSource"
  ADD VALUE IF NOT EXISTS 'MANUAL_DISCOVERY';

ALTER TABLE public."raw_posts"
  ADD COLUMN IF NOT EXISTS "is_korea_candidate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."raw_posts"
  ADD COLUMN IF NOT EXISTS "collection_source"
  public."RawPostCollectionSource" NOT NULL DEFAULT 'LEGACY_INSTAGRAPI';

CREATE INDEX IF NOT EXISTS "raw_posts_collection_source_candidate_idx"
  ON public."raw_posts" ("collection_source", "is_candidate", "is_korea_candidate");
