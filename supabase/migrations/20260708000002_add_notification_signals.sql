-- ============================================================================
-- Notification signals: add group_buy_notifications table and fold into score.
-- Score = 3 * deep_views + 2 * bookmarks + 2 * notifications + 1 * search_clicks
-- ============================================================================

-- Notification opt-in: one row per (group_buy_id, session_id)
CREATE TABLE IF NOT EXISTS public.group_buy_notifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_buy_id text        NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_buy_id, session_id)
);

CREATE INDEX IF NOT EXISTS group_buy_notifications_group_buy_id_idx
  ON public.group_buy_notifications (group_buy_id);
CREATE INDEX IF NOT EXISTS group_buy_notifications_created_at_idx
  ON public.group_buy_notifications (created_at DESC);

ALTER TABLE public.group_buy_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_buy_notifications_anon_insert"
  ON public.group_buy_notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "group_buy_notifications_anon_delete"
  ON public.group_buy_notifications
  FOR DELETE
  USING (true);

GRANT INSERT, DELETE ON public.group_buy_notifications TO anon, authenticated;

-- ============================================================================
-- Update get_popular_group_buys to include notification count.
-- Score = 3 * deep_views + 2 * bookmarks + 2 * notifications + 1 * search_clicks
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_popular_group_buys(int, int);

CREATE OR REPLACE FUNCTION public.get_popular_group_buys(
  limit_count int DEFAULT 20,
  hours_window int DEFAULT 168
)
RETURNS TABLE (
  group_buy_id   text,
  deep_views     bigint,
  bookmarks     bigint,
  notifications  bigint,
  search_clicks  bigint,
  score          numeric
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
  )
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
  ORDER BY score DESC, deep_views DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_group_buys(int, int)
  TO anon, authenticated;
