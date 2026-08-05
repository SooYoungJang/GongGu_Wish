CREATE TABLE public.group_buy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  product_name_norm text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_buy_requests_product_name_length_check
    CHECK (char_length(product_name) BETWEEN 2 AND 60),
  CONSTRAINT group_buy_requests_product_name_format_check
    CHECK (
      product_name !~ '[[:cntrl:]]'
      AND product_name = regexp_replace(btrim(product_name), '[[:space:]]+', ' ', 'g')
    ),
  CONSTRAINT group_buy_requests_product_name_norm_check
    CHECK (product_name_norm = lower(product_name)),
  CONSTRAINT group_buy_requests_status_check
    CHECK (status IN ('OPEN', 'FULFILLED', 'HIDDEN')),
  CONSTRAINT group_buy_requests_product_name_norm_key UNIQUE (product_name_norm)
);

CREATE TABLE public.group_buy_request_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL
    REFERENCES public.group_buy_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hashes bytea[] NOT NULL,
  ip_hash bytea NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_buy_request_participations_session_hashes_check
    CHECK (
      cardinality(session_hashes) BETWEEN 1 AND 8
      AND array_position(session_hashes, NULL::bytea) IS NULL
    )
);

CREATE TABLE public.group_buy_request_attempt_limits (
  actor_hash bytea NOT NULL,
  window_started_at timestamp with time zone NOT NULL,
  attempt_count integer NOT NULL,
  CONSTRAINT group_buy_request_attempt_limits_actor_hash_check
    CHECK (octet_length(actor_hash) = 32),
  CONSTRAINT group_buy_request_attempt_limits_count_check
    CHECK (attempt_count BETWEEN 1 AND 21),
  CONSTRAINT group_buy_request_attempt_limits_pkey
    PRIMARY KEY (actor_hash, window_started_at)
);

CREATE INDEX group_buy_request_participations_request_recent_idx
  ON public.group_buy_request_participations (request_id, requested_at DESC);

CREATE INDEX group_buy_request_participations_user_recent_idx
  ON public.group_buy_request_participations (user_id, requested_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX group_buy_request_participations_session_hashes_idx
  ON public.group_buy_request_participations USING gin (session_hashes);

CREATE INDEX group_buy_request_participations_ip_recent_idx
  ON public.group_buy_request_participations (ip_hash, requested_at DESC);

CREATE INDEX group_buy_request_attempt_limits_window_idx
  ON public.group_buy_request_attempt_limits (window_started_at);

ALTER TABLE public.group_buy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_request_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_request_attempt_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.group_buy_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.group_buy_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.group_buy_request_participations FROM PUBLIC;
REVOKE ALL ON TABLE public.group_buy_request_participations FROM anon, authenticated;
REVOKE ALL ON TABLE public.group_buy_request_attempt_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.group_buy_request_attempt_limits FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_buy_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_buy_request_participations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_buy_request_attempt_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_group_buy_request_attempt(
  p_actor_hash text
)
RETURNS TABLE (
  allowed boolean,
  attempt_count integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor_hash bytea;
  v_attempt_count integer;
  v_now timestamp with time zone := pg_catalog.clock_timestamp();
  v_window_started_at timestamp with time zone;
BEGIN
  IF p_actor_hash IS NULL OR p_actor_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_group_buy_request_actor' USING ERRCODE = '22023';
  END IF;

  v_actor_hash := pg_catalog.decode(p_actor_hash, 'hex');
  v_window_started_at := pg_catalog.to_timestamp(
    pg_catalog.floor(
      EXTRACT(EPOCH FROM v_now)::double precision / 600::double precision
    ) * 600::double precision
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'group-buy-request-attempt:' || p_actor_hash,
      0::bigint
    )
  );

  INSERT INTO public.group_buy_request_attempt_limits AS rate_limit (
    actor_hash,
    window_started_at,
    attempt_count
  )
  VALUES (
    v_actor_hash,
    v_window_started_at,
    1
  )
  ON CONFLICT (actor_hash, window_started_at) DO UPDATE
    SET attempt_count = LEAST(21, rate_limit.attempt_count + 1)
  RETURNING rate_limit.attempt_count INTO v_attempt_count;

  -- Keep cleanup work bounded so a request never scans or deletes the entire
  -- limiter history. Current and previous-day buckets remain available for
  -- diagnostics while older rows are drained in small batches.
  DELETE FROM public.group_buy_request_attempt_limits AS stale
  USING (
    SELECT candidate.actor_hash, candidate.window_started_at
    FROM public.group_buy_request_attempt_limits AS candidate
    WHERE candidate.window_started_at
      < v_window_started_at - interval '1 day'
    ORDER BY candidate.window_started_at ASC, candidate.actor_hash ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  ) AS expired
  WHERE stale.actor_hash = expired.actor_hash
    AND stale.window_started_at = expired.window_started_at;

  RETURN QUERY
  SELECT
    v_attempt_count <= 20,
    v_attempt_count,
    600;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_group_buy_internal(
  p_product_name text,
  p_session_hash text,
  p_ip_hash text,
  p_user_id uuid
)
RETURNS TABLE (
  request_id uuid,
  product_name text,
  request_count bigint,
  already_requested boolean,
  ranking_eligible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_product_name text;
  v_product_name_norm text;
  v_session_hash bytea;
  v_ip_hash bytea;
  v_request_id uuid;
  v_canonical_product_name text;
  v_already_requested boolean;
  v_recent_product_count bigint;
  v_request_count bigint;
  v_now timestamp with time zone := pg_catalog.clock_timestamp();
BEGIN
  IF p_product_name IS NULL OR p_product_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_group_buy_product_name' USING ERRCODE = '22023';
  END IF;

  v_product_name := pg_catalog.regexp_replace(
    pg_catalog.btrim(p_product_name),
    '[[:space:]]+',
    ' ',
    'g'
  );

  IF char_length(v_product_name) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'invalid_group_buy_product_name' USING ERRCODE = '22023';
  END IF;

  IF p_session_hash IS NULL
    OR p_session_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'invalid_group_buy_request_session' USING ERRCODE = '22023';
  END IF;

  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_group_buy_request_ip' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth.users AS app_user WHERE app_user.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'invalid_group_buy_request_user' USING ERRCODE = '22023';
  END IF;

  v_product_name_norm := pg_catalog.lower(v_product_name);
  v_session_hash := pg_catalog.decode(p_session_hash, 'hex');
  v_ip_hash := pg_catalog.decode(p_ip_hash, 'hex');

  -- Serialize the server-derived network actor first, then the installation
  -- and optional account. A guest cannot evade dedupe or quota enforcement by
  -- rotating the client-provided installation identifier.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'group-buy-request:ip:' || p_ip_hash,
      0::bigint
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'group-buy-request:session:' || p_session_hash,
      0::bigint
    )
  );
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'group-buy-request:user:' || p_user_id::text,
        0::bigint
      )
    );

    -- Reconcile the signed-in account with every recent request made by this
    -- installation, and remember the current installation on every recent
    -- request already owned by the account. This keeps both dedupe and the
    -- cross-product rate limit intact across login/logout and multiple devices.
    UPDATE public.group_buy_request_participations AS participation
    SET
      user_id = CASE
        WHEN participation.user_id IS NULL THEN p_user_id
        ELSE participation.user_id
      END,
      session_hashes = CASE
        WHEN participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
          THEN participation.session_hashes
        WHEN pg_catalog.cardinality(participation.session_hashes) < 8
          THEN pg_catalog.array_append(
          participation.session_hashes,
          v_session_hash
        )
        ELSE participation.session_hashes
      END
    WHERE participation.requested_at > v_now - interval '30 days'
      AND (
        participation.user_id = p_user_id
        OR participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
      );
  END IF;

  INSERT INTO public.group_buy_requests (
    product_name,
    product_name_norm
  )
  VALUES (
    v_product_name,
    v_product_name_norm
  )
  ON CONFLICT (product_name_norm) DO UPDATE
    SET product_name_norm = EXCLUDED.product_name_norm
  RETURNING
    public.group_buy_requests.id,
    public.group_buy_requests.product_name
  INTO v_request_id, v_canonical_product_name;

  SELECT EXISTS (
    SELECT 1
    FROM public.group_buy_request_participations AS participation
    WHERE participation.request_id = v_request_id
      AND participation.requested_at > v_now - interval '30 days'
      AND (
        participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
        OR (
          p_user_id IS NOT NULL
          AND participation.user_id = p_user_id
        )
        OR participation.ip_hash = v_ip_hash
      )
  )
  INTO v_already_requested;

  IF v_already_requested THEN
    -- A guest request becomes linked to the account after login. When the same
    -- account requests from another installation, remember that hash too so a
    -- later signed-out retry on either installation remains idempotent.
    UPDATE public.group_buy_request_participations AS participation
    SET
      user_id = CASE
        WHEN participation.user_id IS NULL THEN p_user_id
        ELSE participation.user_id
      END,
      session_hashes = CASE
        WHEN participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
          THEN participation.session_hashes
        WHEN p_user_id IS NOT NULL
          AND pg_catalog.cardinality(participation.session_hashes) < 8
          THEN pg_catalog.array_append(
          participation.session_hashes,
          v_session_hash
        )
        ELSE participation.session_hashes
      END
    WHERE participation.request_id = v_request_id
      AND participation.requested_at > v_now - interval '30 days'
      AND (
        participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
        OR (
          p_user_id IS NOT NULL
          AND participation.user_id = p_user_id
        )
      );
  ELSE
    SELECT COUNT(DISTINCT participation.request_id)
    INTO v_recent_product_count
    FROM public.group_buy_request_participations AS participation
    WHERE participation.requested_at > v_now - interval '24 hours'
      AND (
        participation.session_hashes @> ARRAY[v_session_hash]::bytea[]
        OR (
          p_user_id IS NOT NULL
          AND participation.user_id = p_user_id
        )
        OR participation.ip_hash = v_ip_hash
      );

    IF v_recent_product_count >= 5 THEN
      RAISE EXCEPTION 'group_buy_request_rate_limited' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.group_buy_request_participations (
      request_id,
      user_id,
      session_hashes,
      ip_hash,
      requested_at
    )
    VALUES (
      v_request_id,
      p_user_id,
      ARRAY[v_session_hash]::bytea[],
      v_ip_hash,
      v_now
    );
  END IF;

  WITH actor_rows AS (
    SELECT
      CASE
        WHEN participation.user_id IS NOT NULL
          THEN 'u:' || participation.user_id::text
        ELSE 'i:' || pg_catalog.encode(participation.ip_hash, 'hex')
      END AS actor_key
    FROM public.group_buy_request_participations AS participation
    WHERE participation.request_id = v_request_id
      AND participation.requested_at > v_now - interval '30 days'
  )
  SELECT COUNT(DISTINCT actor_key)
  INTO v_request_count
  FROM actor_rows;

  RETURN QUERY
  SELECT
    v_request_id,
    v_canonical_product_name,
    v_request_count,
    v_already_requested,
    v_request_count >= 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_buy_request_rankings(
  p_limit_count integer DEFAULT 3
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
  LIMIT LEAST(GREATEST(COALESCE(p_limit_count, 3), 1), 3);
$$;

REVOKE ALL ON FUNCTION public.consume_group_buy_request_attempt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_group_buy_request_attempt(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.request_group_buy_internal(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_group_buy_internal(text, text, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_group_buy_request_rankings(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_group_buy_request_rankings(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_group_buy_request_attempt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_group_buy_internal(text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_group_buy_request_rankings(integer) TO service_role;
