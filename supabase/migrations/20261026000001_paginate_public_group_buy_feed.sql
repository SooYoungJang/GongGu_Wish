-- Filtering precedes the keyset limit, including legacy seller/category data.
-- Return the table type so PostgREST retains its public FK relationships.
CREATE OR REPLACE FUNCTION public.list_public_group_buys(
  p_limit integer DEFAULT 21,
  p_before_created_at timestamp without time zone DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date
)
RETURNS SETOF public.group_buys
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text := nullif(lower(ltrim(btrim(p_username), '@')), '');
BEGIN
  IF (p_before_created_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE = '22023';
  END IF;
  IF (p_from IS NULL) <> (p_to IS NULL) OR p_from > p_to THEN
    RAISE EXCEPTION 'A valid date range is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT gb.*
  FROM public.group_buys gb
  LEFT JOIN public.influencers direct_i ON direct_i.id = gb.influencer_id
  LEFT JOIN public.raw_posts rp ON rp.id = gb.raw_post_id
  LEFT JOIN public.influencers post_i ON post_i.id = rp.influencer_id
  WHERE gb.status = 'APPROVED'
    AND (gb.end_date IS NULL OR gb.end_date::date >= coalesce(p_today, (now() AT TIME ZONE 'Asia/Seoul')::date))
    AND (p_before_created_at IS NULL OR (gb.created_at, gb.id) < (p_before_created_at, p_before_id))
    AND (p_category IS NULL OR p_category = 'all' OR
      CASE gb.category WHEN 'lifestyle' THEN 'living' WHEN 'digital' THEN 'electronics' ELSE gb.category END =
      CASE p_category WHEN 'lifestyle' THEN 'living' WHEN 'digital' THEN 'electronics' ELSE p_category END)
    AND (v_username IS NULL OR v_username = lower(ltrim(coalesce(
      nullif(btrim(gb.instagram_username), ''),
      nullif(btrim(direct_i.instagram_username), ''),
      nullif(btrim(post_i.instagram_username), '')
    ), '@')))
    AND (p_from IS NULL OR (
      (gb.start_date IS NOT NULL OR gb.end_date IS NOT NULL)
      AND (gb.start_date IS NULL OR gb.start_date::date <= p_to)
      AND (gb.end_date IS NULL OR gb.end_date::date >= p_from)
    ))
  ORDER BY gb.created_at DESC, gb.id DESC
  LIMIT least(greatest(coalesce(p_limit, 21), 1), 51);
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_group_buys(integer, timestamp without time zone, text, text, text, date, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_group_buys(integer, timestamp without time zone, text, text, text, date, date, date) TO anon, authenticated;

-- The existing group_buys_public_search_cursor_idx also covers this traversal.
NOTIFY pgrst, 'reload schema';
