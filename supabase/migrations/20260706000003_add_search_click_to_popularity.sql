-- ============================================================================
-- Extend search_logs with the group buy a user clicked after searching,
-- and fold search-click volume into the per-deal popularity score.
-- ============================================================================

-- ── Add optional group_buy_id to search_logs ───────────────────────────────
-- Null = search typed but no result clicked; non-null = search converted to a deal view.
ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS group_buy_id text;

CREATE INDEX IF NOT EXISTS search_logs_group_buy_id_searched_at_idx
  ON public.search_logs (group_buy_id, searched_at DESC)
  WHERE group_buy_id IS NOT NULL;

-- ============================================================================
-- get_popular_group_buys — now includes search-click volume.
-- Score = 3 * deep_views + 2 * bookmarks + 1 * search_clicks
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_popular_group_buys(int, int);

CREATE OR REPLACE FUNCTION public.get_popular_group_buys(
  limit_count int DEFAULT 20,
  hours_window int DEFAULT 168
)
RETURNS TABLE (
  group_buy_id text,
  deep_views   bigint,
  bookmarks    bigint,
  search_clicks bigint,
  score        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  sc AS (
    -- only count searches that converted to a deal click
    SELECT group_buy_id, COUNT(*) AS cnt
    FROM public.search_logs, window_start
    WHERE searched_at >= window_start.s AND group_buy_id IS NOT NULL
    GROUP BY group_buy_id
  )
  SELECT
    COALESCE(v.group_buy_id, b.group_buy_id, sc.group_buy_id) AS group_buy_id,
    COALESCE(v.cnt, 0) AS deep_views,
    COALESCE(b.cnt, 0) AS bookmarks,
    COALESCE(sc.cnt, 0) AS search_clicks,
    (3 * COALESCE(v.cnt, 0) + 2 * COALESCE(b.cnt, 0) + COALESCE(sc.cnt, 0)) AS score
  FROM v
  FULL OUTER JOIN b ON v.group_buy_id = b.group_buy_id
  FULL OUTER JOIN sc ON COALESCE(v.group_buy_id, b.group_buy_id) = sc.group_buy_id
  ORDER BY score DESC, deep_views DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_group_buys(int, int)
  TO anon, authenticated;
