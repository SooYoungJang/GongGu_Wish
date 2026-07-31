CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate_email text;
  profile_email text;
  profile_nickname text;
BEGIN
  candidate_email := NULLIF(lower(btrim(NEW.email)), '');
  profile_email := candidate_email;

  IF profile_email IS NULL OR EXISTS (
    SELECT 1
    FROM public.users AS existing_user
    WHERE lower(existing_user.email) = profile_email
      AND existing_user.id <> NEW.id::text
  ) THEN
    profile_email := NEW.id::text || '@oauth.gonggu.invalid';
  END IF;

  profile_nickname := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'nickname'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), '')
  );

  INSERT INTO public.users (
    id,
    email,
    nickname,
    created_at,
    updated_at,
    status
  )
  VALUES (
    NEW.id::text,
    profile_email,
    profile_nickname,
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP,
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO public.users (
      id,
      email,
      nickname,
      created_at,
      updated_at,
      status
    )
    VALUES (
      NEW.id::text,
      NEW.id::text || '@oauth.gonggu.invalid',
      profile_nickname,
      COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP,
      'ACTIVE'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gonggu_auth_user_profile_created ON auth.users;

CREATE TRIGGER gonggu_auth_user_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM service_role;

WITH auth_profile_candidates AS (
  SELECT
    auth_user.id,
    NULLIF(lower(btrim(auth_user.email)), '') AS candidate_email,
    COALESCE(
      NULLIF(btrim(auth_user.raw_user_meta_data ->> 'nickname'), ''),
      NULLIF(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
      NULLIF(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')
    ) AS nickname,
    auth_user.created_at,
    row_number() OVER (
      PARTITION BY NULLIF(lower(btrim(auth_user.email)), '')
      ORDER BY auth_user.created_at, auth_user.id
    ) AS email_position
  FROM auth.users AS auth_user
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users AS existing_profile
    WHERE existing_profile.id = auth_user.id::text
  )
), resolved_auth_profiles AS (
  SELECT
    candidate.id,
    CASE
      WHEN candidate.candidate_email IS NULL
        OR candidate.email_position > 1
        OR EXISTS (
          SELECT 1
          FROM public.users AS existing_user
          WHERE lower(existing_user.email) = candidate.candidate_email
            AND existing_user.id <> candidate.id::text
        )
      THEN candidate.id::text || '@oauth.gonggu.invalid'
      ELSE candidate.candidate_email
    END AS email,
    candidate.nickname,
    candidate.created_at
  FROM auth_profile_candidates AS candidate
)
INSERT INTO public.users (
  id,
  email,
  nickname,
  created_at,
  updated_at,
  status
)
SELECT
  profile.id::text,
  profile.email,
  profile.nickname,
  COALESCE(profile.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP,
  'ACTIVE'
FROM resolved_auth_profiles AS profile
ON CONFLICT (id) DO NOTHING;
