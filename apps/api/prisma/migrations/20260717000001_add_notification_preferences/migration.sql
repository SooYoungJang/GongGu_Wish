ALTER TABLE "users"
  ADD COLUMN "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deadline_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "new_submissions_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notification_reminder_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 7]::INTEGER[],
  ADD COLUMN "followed_influencers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "followed_brands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "users"
  ADD CONSTRAINT "users_notification_reminder_days_check" CHECK (
    "notification_reminder_days" <@ ARRAY[1, 3, 7]::INTEGER[]
    AND cardinality("notification_reminder_days") >= 1
    AND cardinality("notification_reminder_days") <= 3
  ) NOT VALID,
  ADD CONSTRAINT "users_followed_influencers_count_check" CHECK (
    cardinality("followed_influencers") <= 50
  ) NOT VALID,
  ADD CONSTRAINT "users_followed_brands_count_check" CHECK (
    cardinality("followed_brands") <= 50
  ) NOT VALID;

ALTER TABLE "users"
  VALIDATE CONSTRAINT "users_notification_reminder_days_check";
ALTER TABLE "users"
  VALIDATE CONSTRAINT "users_followed_influencers_count_check";
ALTER TABLE "users"
  VALIDATE CONSTRAINT "users_followed_brands_count_check";

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
