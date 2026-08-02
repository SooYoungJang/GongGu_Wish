-- Allow one actor to request up to fifteen distinct products in a rolling day.
-- Keep the existing deduplication, request-attempt limiter, and service-only
-- execution boundary unchanged.
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

    IF v_recent_product_count >= 15 THEN
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

REVOKE ALL ON FUNCTION public.request_group_buy_internal(text, text, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_group_buy_internal(text, text, text, uuid)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_group_buy_internal(text, text, text, uuid)
  TO service_role;
