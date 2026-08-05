CREATE OR REPLACE FUNCTION public.get_group_buy_request_rankings(
  p_limit_count integer DEFAULT 10
)
RETURNS TABLE (
  rank bigint,
  request_id uuid,
  product_name text,
  request_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH actor_rows AS (
    SELECT
      participation.request_id,
      participation.requested_at,
      CASE
        WHEN participation.user_id IS NOT NULL
          THEN 'u:' || participation.user_id::text
        ELSE 'i:' || pg_catalog.encode(participation.ip_hash, 'hex')
      END AS actor_key
    FROM public.group_buy_request_participations AS participation
    WHERE participation.requested_at > pg_catalog.statement_timestamp() - interval '30 days'
  ),
  eligible AS (
    SELECT
      request.id AS request_id,
      request.product_name,
      COUNT(DISTINCT actor_key) AS request_count,
      pg_catalog.max(actor_rows.requested_at) AS latest_request_at
    FROM public.group_buy_requests AS request
    JOIN actor_rows ON actor_rows.request_id = request.id
    WHERE request.status = 'OPEN'
    GROUP BY request.id, request.product_name
    HAVING COUNT(DISTINCT actor_key) >= 2
  ),
  ranked AS (
    SELECT
      pg_catalog.row_number() OVER (
        ORDER BY request_count DESC, latest_request_at DESC, request_id ASC
      ) AS rank,
      request_id,
      product_name,
      request_count,
      latest_request_at
    FROM eligible
  )
  SELECT
    ranked.rank,
    ranked.request_id,
    ranked.product_name,
    ranked.request_count
  FROM ranked
  ORDER BY request_count DESC, latest_request_at DESC, request_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit_count, 10), 1), 10);
$$;

REVOKE ALL ON FUNCTION public.get_group_buy_request_rankings(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_buy_request_rankings(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_buy_request_rankings(integer) TO service_role;
