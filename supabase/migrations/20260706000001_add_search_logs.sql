-- ============================================================================
-- Search logs for "인기 검색어" (popular search terms) feature
-- Stores every search submission and exposes a daily aggregated ranking RPC.
-- Pattern: raw event log -> date_trunc('day') aggregation -> top-N ranking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.search_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  keyword     text        NOT NULL,
  -- normalized form (lower + collapse whitespace) for stable grouping
  keyword_norm text      GENERATED ALWAYS AS (lower(btrim(regexp_replace(keyword, '\s+', ' ', 'g')))) STORED,
  searched_at timestamptz NOT NULL DEFAULT now(),
  -- optional: link to auth user when logged in (null for anon)
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- light-weight device fingerprint to dedupe without PII
  session_id  text
);

CREATE INDEX IF NOT EXISTS search_logs_searched_at_idx
  ON public.search_logs (searched_at DESC);
CREATE INDEX IF NOT EXISTS search_logs_keyword_norm_searched_at_idx
  ON public.search_logs (keyword_norm, searched_at DESC);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) may log a search event.
CREATE POLICY IF NOT EXISTS "search_logs_anon_insert"
  ON public.search_logs
  FOR INSERT
  WITH CHECK (true);

-- No direct row reads for clients; ranking is served via RPC only.
-- (Admin/service_role bypass RLS, so they keep full access.)

-- ============================================================================
-- get_popular_search_terms(limit int default 10, days int default 1)
-- Returns the top-N search terms ranked by daily search volume.
--   limit: number of ranking entries to return (max 50)
--   hours: aggregation window in hours (24 = last 24 hours, rolling)
-- Each row: rank, keyword, count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_popular_search_terms(
  limit_count int DEFAULT 10,
  hours_window int DEFAULT 24
)
RETURNS TABLE (
  rank    int,
  keyword text,
  count   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    row_number() OVER (ORDER BY COUNT(*) DESC, MAX(searched_at) DESC) AS rank,
    keyword,
    COUNT(*) AS count
  FROM public.search_logs
  WHERE searched_at >= now() - make_interval(hours => GREATEST(hours_window, 1))
    AND keyword_norm <> ''
  GROUP BY keyword_norm, keyword
  ORDER BY count DESC, MAX(searched_at) DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 50);
$$;

-- Anonymous + authenticated users may call the ranking RPC.
GRANT EXECUTE ON FUNCTION public.get_popular_search_terms(int, int)
  TO anon, authenticated;

-- Clients only need INSERT on search_logs (RLS policies gate the rows).
GRANT INSERT ON public.search_logs TO anon, authenticated;
