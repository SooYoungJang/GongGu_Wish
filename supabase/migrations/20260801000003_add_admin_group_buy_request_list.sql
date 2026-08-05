CREATE INDEX IF NOT EXISTS group_buy_request_participations_requested_at_idx
  ON public.group_buy_request_participations (requested_at DESC, request_id);

CREATE OR REPLACE FUNCTION public.get_admin_group_buy_requests(
  p_page integer DEFAULT 1,
  p_limit_count integer DEFAULT 30,
  p_status text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_page integer := LEAST(GREATEST(COALESCE(p_page, 1), 1), 1000000);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit_count, 30), 1), 100);
  v_status text := NULLIF(upper(btrim(p_status)), 'ALL');
  v_query text := NULLIF(
    lower(regexp_replace(btrim(p_query), '[[:space:]]+', ' ', 'g')),
    ''
  );
  v_result jsonb;
BEGIN
  IF v_status IS NOT NULL AND v_status NOT IN ('OPEN', 'FULFILLED', 'HIDDEN') THEN
    RAISE EXCEPTION 'invalid_group_buy_request_status'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(v_query) > 200 THEN
    RAISE EXCEPTION 'group_buy_request_query_too_long'
      USING ERRCODE = '22023';
  END IF;

  WITH filtered_requests AS (
    SELECT
      request.id AS request_id,
      request.product_name,
      request.status,
      request.created_at
    FROM public.group_buy_requests AS request
    WHERE (v_status IS NULL OR request.status = v_status)
      AND (
        v_query IS NULL
        OR pg_catalog.strpos(request.product_name_norm, v_query) > 0
      )
  ),
  actor_rows AS (
    SELECT
      participation.request_id,
      participation.requested_at,
      CASE
        WHEN participation.user_id IS NOT NULL
          THEN 'u:' || participation.user_id::text
        ELSE 'i:' || pg_catalog.encode(participation.ip_hash, 'hex')
      END AS actor_key
    FROM filtered_requests
    JOIN public.group_buy_request_participations AS participation
      ON participation.request_id = filtered_requests.request_id
    WHERE participation.requested_at
      > pg_catalog.statement_timestamp() - interval '30 days'
  ),
  recent_counts AS (
    SELECT
      actor_rows.request_id,
      COUNT(DISTINCT actor_key)::integer AS request_count,
      pg_catalog.max(actor_rows.requested_at) AS latest_requested_at
    FROM actor_rows
    GROUP BY actor_rows.request_id
  ),
  filtered AS (
    SELECT
      request.request_id,
      request.product_name,
      request.status,
      COALESCE(recent_counts.request_count, 0) AS request_count,
      recent_counts.latest_requested_at,
      request.created_at
    FROM filtered_requests AS request
    LEFT JOIN recent_counts ON recent_counts.request_id = request.request_id
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY request_count DESC, latest_requested_at DESC NULLS LAST, request_id ASC
    LIMIT v_limit
    OFFSET (v_page - 1) * v_limit
  ),
  items AS (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', request_id,
          'productName', product_name,
          'status', status,
          'requestCount', request_count,
          'createdAt', created_at,
          'latestRequestedAt', latest_requested_at
        )
        ORDER BY request_count DESC, latest_requested_at DESC NULLS LAST, request_id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM page_rows
  )
  SELECT pg_catalog.jsonb_build_object(
    'items', items.value,
    'total', (SELECT COUNT(*) FROM filtered)
  )
  INTO v_result
  FROM items;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_group_buy_requests(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_group_buy_requests(integer, integer, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_group_buy_requests(integer, integer, text, text) TO service_role;

COMMENT ON FUNCTION public.get_admin_group_buy_requests(integer, integer, text, text)
  IS 'Service-role-only aggregate view of group-buy requests for the admin API.';
