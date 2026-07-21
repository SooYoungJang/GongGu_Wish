-- Add media columns to gonggu_submissions to match the public-submission
-- edge function which inserts media_type, media_items, media_urls,
-- thumbnail_url, and video_url.

ALTER TABLE public.gonggu_submissions
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS media_items JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS media_type TEXT;