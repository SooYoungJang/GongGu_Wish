-- Popular search terms represent products users selected from search results.
-- Free-form queries remain local recent-search history and must not be ranked.
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
    AND group_buy_id IS NOT NULL
    AND keyword_norm <> ''
  GROUP BY keyword_norm, keyword
  ORDER BY count DESC, MAX(searched_at) DESC
  LIMIT LEAST(GREATEST(limit_count, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_search_terms(int, int)
  TO anon, authenticated;
