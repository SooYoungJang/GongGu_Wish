-- Restore the feed_posts table required by the Supabase RLS migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'FeedMediaType'
  ) THEN
    CREATE TYPE public."FeedMediaType" AS ENUM ('IMAGE', 'VIDEO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.feed_posts (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  instagram_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  media_url TEXT,
  "mediaType" public."FeedMediaType",
  caption TEXT,
  account_name TEXT,
  link_url TEXT,
  open_date TIMESTAMP(3),
  close_date TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT feed_posts_pkey PRIMARY KEY (id)
);
