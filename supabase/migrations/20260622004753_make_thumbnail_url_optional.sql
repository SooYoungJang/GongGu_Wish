-- Feed posts may be video-only, so a thumbnail is optional.
ALTER TABLE public.feed_posts
  ALTER COLUMN thumbnail_url DROP NOT NULL;
