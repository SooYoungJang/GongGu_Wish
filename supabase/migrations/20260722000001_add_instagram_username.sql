-- Separate the influencer Instagram handle from the brand name so admins
-- can edit them independently. The mobile app already reads the handle from
-- the raw_post -> influencer join, but admin-created group buys and
-- submissions have no raw_post link, so we store the handle directly.

ALTER TABLE public.gonggu_submissions
  ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(100);

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(100);