CREATE OR REPLACE FUNCTION public.search_public_influencers(
  p_query text,
  p_limit integer DEFAULT 9,
  p_after_username text DEFAULT NULL,
  p_after_id text DEFAULT NULL
)
RETURNS SETOF public.influencers
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query text := lower(regexp_replace(coalesce(p_query, ''), '[[:space:]]', '', 'g'));
BEGIN
  IF char_length(p_query) > 200 THEN
    RAISE EXCEPTION 'Search query is too long' USING ERRCODE = '22023';
  END IF;
  IF (p_after_username IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE = '22023';
  END IF;
  IF v_query = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT i.*
  FROM public.influencers i
  WHERE (p_after_username IS NULL OR (lower(i.instagram_username), i.id) > (lower(p_after_username), p_after_id))
    AND (
      strpos(lower(regexp_replace(i.instagram_username, '[[:space:]]', '', 'g')), v_query) > 0
      OR strpos(lower(regexp_replace(coalesce(i.display_name, ''), '[[:space:]]', '', 'g')), v_query) > 0
    )
  ORDER BY lower(i.instagram_username), i.id
  LIMIT least(greatest(coalesce(p_limit, 9), 1), 21);
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_influencers(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_influencers(text, integer, text, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
