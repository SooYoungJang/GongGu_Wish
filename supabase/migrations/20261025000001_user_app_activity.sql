-- Store only the latest authenticated app access, erased with its Auth account.
CREATE TABLE public.user_app_activity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_access_at timestamptz NOT NULL
);

ALTER TABLE public.user_app_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_app_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_app_activity TO service_role;

CREATE FUNCTION public.record_user_app_access(p_expected_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR actor::text IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'Account changed or authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_app_activity AS activity (user_id, last_access_at)
  VALUES (actor, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
  SET last_access_at = GREATEST(activity.last_access_at, EXCLUDED.last_access_at);
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_app_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_app_access(text) TO authenticated;

-- Existing successful sign-ins cover older clients; new clients also record
-- foreground returns. Batch only the IDs in the current admin page.
CREATE FUNCTION public.admin_user_access_times(p_user_ids text[])
RETURNS TABLE (user_id text, last_access_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT account.id::text,
         GREATEST(account.last_sign_in_at, activity.last_access_at)
  FROM auth.users AS account
  LEFT JOIN public.user_app_activity AS activity ON activity.user_id = account.id
  WHERE account.id = ANY (
    ARRAY(
      SELECT CASE
        WHEN requested.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN requested.id::uuid
        ELSE NULL
      END
      FROM unnest(p_user_ids) AS requested(id)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.admin_user_access_times(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_access_times(text[]) TO service_role;
