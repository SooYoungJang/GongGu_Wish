-- Only the authenticated participant can read their own request history.
CREATE OR REPLACE FUNCTION public.list_my_group_buy_requests(
  p_expected_user_id uuid,
  p_after_requested_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 21
)
RETURNS TABLE (request_id uuid, product_name text, status text, requested_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'Account does not match' USING ERRCODE = '42501';
  END IF;
  IF (p_after_requested_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'Incomplete cursor' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH own_requests AS (
    SELECT p.request_id, max(p.requested_at) AS requested_at
    FROM public.group_buy_request_participations p
    WHERE p.user_id = p_expected_user_id
    GROUP BY p.request_id
  )
  SELECT r.id, r.product_name, r.status, own.requested_at
  FROM own_requests own JOIN public.group_buy_requests r ON r.id = own.request_id
  WHERE p_after_id IS NULL OR (own.requested_at, r.id) < (p_after_requested_at, p_after_id)
  ORDER BY own.requested_at DESC, r.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 21), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.list_my_group_buy_requests(uuid,timestamptz,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_group_buy_requests(uuid,timestamptz,uuid,integer) TO authenticated;
