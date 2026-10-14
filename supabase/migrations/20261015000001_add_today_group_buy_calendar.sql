-- Public editorial feed. UTC-naive persisted timestamps are displayed in KST,
-- matching the mobile Date parser. No caller-controlled date/filter/projection.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('group_buys', 'raw_posts', 'influencers')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Today calendar requires RLS on group_buys, raw_posts and influencers';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_today_group_buy_calendar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Re-check at each uncached call: later RLS drift must fail closed as well.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('group_buys', 'raw_posts', 'influencers')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Today calendar source RLS is disabled';
  END IF;
  WITH day AS (
    SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS kst_date
  ), eligible AS MATERIALIZED (
    SELECT gb.id, gb.product_name,
      coalesce(nullif(btrim(gb.instagram_username), ''),
        nullif(btrim(direct_i.instagram_username), ''),
        nullif(btrim(post_i.instagram_username), '')) AS seller_name,
      ((gb.start_date AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS start_date,
      ((gb.end_date AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS end_date
    FROM public.group_buys gb
    CROSS JOIN day
    LEFT JOIN public.influencers direct_i ON direct_i.id = gb.influencer_id
    LEFT JOIN public.raw_posts rp ON rp.id = gb.raw_post_id
    LEFT JOIN public.influencers post_i ON post_i.id = rp.influencer_id
    WHERE gb.status = 'APPROVED'
      AND (gb.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
        OR gb.collection_review_status = 'APPROVED')
      AND gb.start_date >= ((day.kst_date::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC')
      AND gb.start_date < (((day.kst_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC')
      AND (gb.end_date IS NULL OR
        ((gb.end_date AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date >= day.kst_date)
  ), selected AS (
    SELECT * FROM eligible ORDER BY product_name ASC NULLS LAST, id ASC LIMIT 3
  )
  SELECT jsonb_build_object(
    'date', day.kst_date::text,
    'timezone', 'Asia/Seoul',
    'count', (SELECT count(*) FROM eligible),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'productName', product_name, 'sellerName', seller_name,
      'startDate', start_date::text, 'endDate', end_date::text
    ) ORDER BY product_name ASC NULLS LAST, id ASC) FROM selected), '[]'::jsonb)
  ) INTO result FROM day;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_today_group_buy_calendar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_today_group_buy_calendar() TO anon;
CREATE INDEX IF NOT EXISTS group_buys_today_calendar_idx
  ON public.group_buys (start_date) WHERE status = 'APPROVED';
