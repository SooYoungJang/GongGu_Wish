-- Marketing push consent is separate from service notification preferences.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_push_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_push_consent_version text,
  ADD COLUMN IF NOT EXISTS marketing_push_consent_source text,
  ADD COLUMN IF NOT EXISTS marketing_push_withdrawn_at timestamptz;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_marketing_push_consent_source_check,
  ADD CONSTRAINT users_marketing_push_consent_source_check CHECK (
    marketing_push_consent_source IS NULL
    OR marketing_push_consent_source IN ('signup', 'settings')
  ) NOT VALID;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_marketing_push_consent_fields_check,
  ADD CONSTRAINT users_marketing_push_consent_fields_check CHECK (
    marketing_push_enabled = false
    OR (
      marketing_push_consent_at IS NOT NULL
      AND marketing_push_consent_version IS NOT NULL
      AND marketing_push_consent_source IS NOT NULL
    )
  ) NOT VALID;

-- Preserve the explicit signup choice already stored in Supabase Auth metadata.
UPDATE public.users AS profile
SET marketing_push_enabled = true,
    marketing_push_consent_at = COALESCE(auth_user.created_at, CURRENT_TIMESTAMP),
    marketing_push_consent_version = '2026-08-04',
    marketing_push_consent_source = 'signup',
    marketing_push_withdrawn_at = NULL,
    updated_at = CURRENT_TIMESTAMP
FROM auth.users AS auth_user
WHERE auth_user.id::text = profile.id
  AND lower(btrim(COALESCE(auth_user.raw_user_meta_data ->> 'marketing_opt_in', 'false'))) = 'true'
  AND profile.marketing_push_enabled = false;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_marketing_push_consent_source_check;
ALTER TABLE public.users
  VALIDATE CONSTRAINT users_marketing_push_consent_fields_check;

CREATE INDEX IF NOT EXISTS users_marketing_push_enabled_idx
  ON public.users (marketing_push_enabled)
  WHERE marketing_push_enabled = true;

CREATE OR REPLACE FUNCTION public.handle_auth_user_marketing_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'marketing_opt_in', 'false'))) = 'true' THEN
    UPDATE public.users
    SET marketing_push_enabled = true,
        marketing_push_consent_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        marketing_push_consent_version = '2026-08-04',
        marketing_push_consent_source = 'signup',
        marketing_push_withdrawn_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id::text
      AND marketing_push_enabled = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gonggu_auth_user_profile_marketing_consent
  ON auth.users;

CREATE TRIGGER gonggu_auth_user_profile_marketing_consent
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_marketing_consent();

REVOKE ALL ON FUNCTION public.handle_auth_user_marketing_consent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_auth_user_marketing_consent() FROM anon;
REVOKE ALL ON FUNCTION public.handle_auth_user_marketing_consent() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_user_marketing_consent() FROM service_role;
