-- Make mobile deep-view retries safe when the server accepted a request but
-- the client did not receive the response. Existing clients may omit the key.

ALTER TABLE public.group_buy_views
  ADD COLUMN IF NOT EXISTS client_event_id text;

ALTER TABLE public.group_buy_views
  DROP CONSTRAINT IF EXISTS group_buy_views_client_event_id_format;
ALTER TABLE public.group_buy_views
  ADD CONSTRAINT group_buy_views_client_event_id_format
  CHECK (
    client_event_id IS NULL
    OR (length(client_event_id) BETWEEN 1 AND 256)
  );

ALTER TABLE public.group_buy_views
  DROP CONSTRAINT IF EXISTS group_buy_views_client_event_id_key;
ALTER TABLE public.group_buy_views
  ADD CONSTRAINT group_buy_views_client_event_id_key
  UNIQUE (client_event_id);

-- Keep legacy clients insert-compatible without allowing direct writes to the
-- idempotency key or event timestamp. New clients use the validated RPC below.
REVOKE INSERT ON public.group_buy_views FROM anon, authenticated;
GRANT INSERT (group_buy_id, view_type, session_id)
  ON public.group_buy_views TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_group_buy_deep_view(
  p_group_buy_id text,
  p_session_id text,
  p_client_event_id text,
  p_viewed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_group_buy_id IS NULL
    OR length(p_group_buy_id) NOT BETWEEN 1 AND 256
    OR p_session_id IS NULL
    OR length(p_session_id) NOT BETWEEN 1 AND 256
    OR p_client_event_id IS NULL
    OR length(p_client_event_id) NOT BETWEEN 1 AND 256
  THEN
    RAISE EXCEPTION 'invalid popularity signal identifier'
      USING ERRCODE = '22023';
  END IF;

  IF p_viewed_at IS NULL
    OR p_viewed_at < now() - interval '30 days'
    OR p_viewed_at > now() + interval '5 minutes'
  THEN
    RAISE EXCEPTION 'invalid popularity signal timestamp'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.group_buy_views (
    group_buy_id,
    view_type,
    viewed_at,
    session_id,
    client_event_id
  ) VALUES (
    p_group_buy_id,
    'deep',
    p_viewed_at,
    p_session_id,
    p_client_event_id
  )
  ON CONFLICT (client_event_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_group_buy_deep_view(
  text,
  text,
  text,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_group_buy_deep_view(
  text,
  text,
  text,
  timestamptz
) TO anon, authenticated;

-- The bookmark table also has no public SELECT policy, so its conflict-safe
-- write is exposed through a narrow function instead of a REST upsert.
REVOKE INSERT ON public.group_buy_bookmarks FROM anon, authenticated;
GRANT INSERT (group_buy_id, session_id)
  ON public.group_buy_bookmarks TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_group_buy_bookmark(
  p_group_buy_id text,
  p_session_id text,
  p_selected boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_group_buy_id IS NULL
    OR length(p_group_buy_id) NOT BETWEEN 1 AND 256
    OR p_session_id IS NULL
    OR length(p_session_id) NOT BETWEEN 1 AND 256
    OR p_selected IS NULL
  THEN
    RAISE EXCEPTION 'invalid bookmark signal'
      USING ERRCODE = '22023';
  END IF;

  IF p_selected THEN
    INSERT INTO public.group_buy_bookmarks (group_buy_id, session_id)
    VALUES (p_group_buy_id, p_session_id)
    ON CONFLICT (group_buy_id, session_id) DO NOTHING;
  ELSE
    DELETE FROM public.group_buy_bookmarks
    WHERE group_buy_id = p_group_buy_id
      AND session_id = p_session_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_buy_bookmark(
  text,
  text,
  boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_group_buy_bookmark(
  text,
  text,
  boolean
) TO anon, authenticated;
