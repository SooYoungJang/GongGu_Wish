-- The legacy popularity RPC is public and SECURITY DEFINER. Keep its response
-- shape, but only return identifiers that are visible to public readers.
CREATE OR REPLACE FUNCTION public.get_popular_group_buys(
  limit_count int DEFAULT 20,
  hours_window int DEFAULT 168
)
RETURNS TABLE (
  group_buy_id   text,
  deep_views     bigint,
  bookmarks      bigint,
  notifications  bigint,
  search_clicks  bigint,
  score          numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH window_start AS (
    SELECT now() - make_interval(hours => GREATEST(hours_window, 1)) AS s
  ),
  v AS (
    SELECT group_buy_id, COUNT(*) AS cnt
    FROM public.group_buy_views, window_start
    WHERE viewed_at >= window_start.s AND view_type = 'deep'
    GROUP BY group_buy_id
  ),
  b AS (
    SELECT group_buy_id, COUNT(*) AS cnt
    FROM public.group_buy_bookmarks, window_start
    WHERE created_at >= window_start.s
    GROUP BY group_buy_id
  ),
  n AS (
    SELECT group_buy_id, COUNT(*) AS cnt
    FROM public.group_buy_notifications, window_start
    WHERE created_at >= window_start.s
    GROUP BY group_buy_id
  ),
  sc AS (
    SELECT group_buy_id, COUNT(*) AS cnt
    FROM public.search_logs, window_start
    WHERE searched_at >= window_start.s AND group_buy_id IS NOT NULL
    GROUP BY group_buy_id
  ),
  signals AS (
    SELECT
      COALESCE(v.group_buy_id, b.group_buy_id, n.group_buy_id, sc.group_buy_id) AS group_buy_id,
      COALESCE(v.cnt, 0) AS deep_views,
      COALESCE(b.cnt, 0) AS bookmarks,
      COALESCE(n.cnt, 0) AS notifications,
      COALESCE(sc.cnt, 0) AS search_clicks,
      (3 * COALESCE(v.cnt, 0)
        + 2 * COALESCE(b.cnt, 0)
        + 2 * COALESCE(n.cnt, 0)
        + COALESCE(sc.cnt, 0)) AS score
    FROM v
    FULL OUTER JOIN b ON v.group_buy_id = b.group_buy_id
    FULL OUTER JOIN n ON COALESCE(v.group_buy_id, b.group_buy_id) = n.group_buy_id
    FULL OUTER JOIN sc ON COALESCE(v.group_buy_id, b.group_buy_id, n.group_buy_id) = sc.group_buy_id
  )
  SELECT
    signals.group_buy_id,
    signals.deep_views,
    signals.bookmarks,
    signals.notifications,
    signals.search_clicks,
    signals.score
  FROM signals
  JOIN public.group_buys AS group_buy
    ON group_buy.id = signals.group_buy_id
  WHERE group_buy.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
    OR (
      group_buy.collection_review_status = 'APPROVED'
      AND group_buy.status IN ('APPROVED', 'EXPIRED')
    )
  ORDER BY signals.score DESC, signals.deep_views DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_group_buys(int, int)
  TO anon, authenticated;
