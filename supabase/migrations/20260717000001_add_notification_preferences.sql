-- GON-229: additive, backward-compatible notification preferences.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deadline_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_submissions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_reminder_days integer[] NOT NULL
    DEFAULT ARRAY[1, 3, 7]::integer[],
  ADD COLUMN IF NOT EXISTS followed_influencers text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS followed_brands text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_notification_reminder_days_check,
  ADD CONSTRAINT users_notification_reminder_days_check CHECK (
    notification_reminder_days <@ ARRAY[1, 3, 7]::integer[]
    AND cardinality(notification_reminder_days) >= 1
    AND cardinality(notification_reminder_days) <= 3
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS users_followed_influencers_count_check,
  ADD CONSTRAINT users_followed_influencers_count_check CHECK (
    cardinality(followed_influencers) <= 50
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS users_followed_brands_count_check,
  ADD CONSTRAINT users_followed_brands_count_check CHECK (
    cardinality(followed_brands) <= 50
  ) NOT VALID;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_notification_reminder_days_check;
ALTER TABLE public.users
  VALIDATE CONSTRAINT users_followed_influencers_count_check;
ALTER TABLE public.users
  VALIDATE CONSTRAINT users_followed_brands_count_check;

CREATE OR REPLACE FUNCTION public.claim_expo_push_token(
  p_user_id text,
  p_push_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'user id is required';
  END IF;
  IF p_push_token IS NULL
    OR p_push_token !~ '^(Expo|Exponent)PushToken\[[^]]+\]$' THEN
    RAISE EXCEPTION 'valid Expo push token is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_push_token, 0));
  UPDATE public.users
  SET push_token = NULL,
      push_provider = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE push_token = p_push_token
    AND id <> p_user_id;

  UPDATE public.users
  SET push_token = p_push_token,
      push_provider = 'expo',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_expo_push_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_expo_push_token(text, text)
  TO service_role;
