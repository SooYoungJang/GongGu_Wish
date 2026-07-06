-- ============================================================================
-- Popularity signals: deep views (30s+ watch) + bookmarks for group buys.
-- Pattern: raw event log -> server aggregation -> popularity score RPC
-- ============================================================================

-- ── Deep views: only counted after 30s+ of continuous watch ────────────────
CREATE TABLE IF NOT EXISTS public.group_buy_views (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_buy_id text        NOT NULL,
  -- "deep" = watched >= 30s; future "quick" types possible without schema change
  view_type    text        NOT NULL DEFAULT 'deep',
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id   text
);

CREATE INDEX IF NOT EXISTS group_buy_views_group_buy_viewed_at_idx
  ON public.group_buy_views (group_buy_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS group_buy_views_viewed_at_idx
  ON public.group_buy_views (viewed_at DESC);

ALTER TABLE public.group_buy_views ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) may log a deep view.
CREATE POLICY "group_buy_views_anon_insert"
  ON public.group_buy_views
  FOR INSERT
  WITH CHECK (true);

-- ── Bookmarks: server-side mirror of local bookmark state ──────────────────
CREATE TABLE IF NOT EXISTS public.group_buy_bookmarks (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_buy_id text        NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- one bookmark per (group_buy_id, session_id) to dedupe anon users
  UNIQUE (group_buy_id, session_id)
);

CREATE INDEX IF NOT EXISTS group_buy_bookmarks_group_buy_id_idx
  ON public.group_buy_bookmarks (group_buy_id);
CREATE INDEX IF NOT EXISTS group_buy_bookmarks_session_id_idx
  ON public.group_buy_bookmarks (session_id);

ALTER TABLE public.group_buy_bookmarks ENABLE ROW LEVEL SECURITY;

-- Anyone may add/remove their own bookmarks (keyed by session_id for anon).
CREATE POLICY "group_buy_bookmarks_anon_insert"
  ON public.group_buy_bookmarks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "group_buy_bookmarks_anon_delete"
  ON public.group_buy_bookmarks
  FOR DELETE
  USING (true);

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT INSERT ON public.group_buy_views TO anon, authenticated;
GRANT INSERT, DELETE ON public.group_buy_bookmarks TO anon, authenticated;

-- ============================================================================
-- get_popular_group_buys(limit int default 20, hours int default 168)
-- Returns group buys ranked by a weighted popularity score over a rolling
-- window. Score = 3 * deep_views + 2 * bookmarks.
-- (search volume is keyword-based, not group-buy-id-based, so it powers the
--  separate "인기 검색어" feature rather than this per-deal score.)
--   hours: aggregation window (168 = last 7 days by default)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_popular_group_buys(
  limit_count int DEFAULT 20,
  hours_window int DEFAULT 168
)
RETURNS TABLE (
  group_buy_id text,
  deep_views   bigint,
  bookmarks    bigint,
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
  )
  SELECT
    COALESCE(v.group_buy_id, b.group_buy_id) AS group_buy_id,
    COALESCE(v.cnt, 0) AS deep_views,
    COALESCE(b.cnt, 0) AS bookmarks,
    (3 * COALESCE(v.cnt, 0) + 2 * COALESCE(b.cnt, 0)) AS score
  FROM v
  FULL OUTER JOIN b ON v.group_buy_id = b.group_buy_id
  ORDER BY score DESC, deep_views DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_group_buys(int, int)
  TO anon, authenticated;
