ALTER TABLE public.group_buy_requests
  ADD COLUMN fulfilled_group_buy_id text REFERENCES public.group_buys(id) ON DELETE SET NULL,
  ADD COLUMN fulfilled_at timestamptz;

CREATE TABLE public.group_buy_request_notification_preferences (
  request_id uuid NOT NULL REFERENCES public.group_buy_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (request_id, user_id)
);
ALTER TABLE public.group_buy_request_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_buy_request_notification_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.group_buy_request_notification_preferences TO service_role;

CREATE TABLE public.request_fulfillment_push_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.group_buy_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_buy_id text NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','SKIPPED','RETRYING','FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (request_id, user_id)
);
ALTER TABLE public.request_fulfillment_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_fulfillment_push_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.request_fulfillment_push_outbox TO service_role;
REVOKE ALL ON SEQUENCE public.request_fulfillment_push_outbox_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.request_fulfillment_push_outbox_id_seq TO service_role;
CREATE INDEX request_fulfillment_push_pending_idx ON public.request_fulfillment_push_outbox(status, next_attempt_at);

CREATE FUNCTION public.set_my_request_notification(p_expected_user_id uuid, p_request_id uuid, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE request_status text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'Account does not match' USING ERRCODE = '42501';
  END IF;
  SELECT r.status INTO request_status FROM public.group_buy_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF request_status IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.group_buy_request_participations p WHERE p.request_id = p_request_id AND p.user_id = p_expected_user_id
  ) THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Selection required' USING ERRCODE = '22023'; END IF;
  IF p_enabled AND request_status <> 'OPEN' THEN RAISE EXCEPTION 'Request already closed' USING ERRCODE = 'PT409'; END IF;
  INSERT INTO public.group_buy_request_notification_preferences(request_id, user_id, enabled)
  VALUES (p_request_id, p_expected_user_id, p_enabled)
  ON CONFLICT (request_id, user_id) DO UPDATE SET enabled = excluded.enabled;
  RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_request_notification(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_request_notification(uuid,uuid,boolean) TO authenticated;

CREATE FUNCTION public.fulfill_group_buy_request(p_request_id uuid, p_group_buy_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE request_row public.group_buy_requests; queued integer;
BEGIN
  SELECT * INTO request_row FROM public.group_buy_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF request_row.status = 'FULFILLED' AND request_row.fulfilled_group_buy_id = p_group_buy_id THEN
    RETURN jsonb_build_object('requestId',p_request_id,'groupBuyId',p_group_buy_id,'status','FULFILLED','queued',0);
  END IF;
  IF request_row.status = 'HIDDEN' OR request_row.fulfilled_group_buy_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request already closed' USING ERRCODE = 'PT409';
  END IF;
  PERFORM 1 FROM public.group_buys WHERE id = p_group_buy_id AND status = 'APPROVED' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved product required' USING ERRCODE = '22023'; END IF;
  UPDATE public.group_buy_requests SET status = 'FULFILLED', fulfilled_group_buy_id = p_group_buy_id, fulfilled_at = now() WHERE id = p_request_id;
  INSERT INTO public.request_fulfillment_push_outbox(request_id,user_id,group_buy_id)
  SELECT p_request_id, pref.user_id, p_group_buy_id FROM public.group_buy_request_notification_preferences pref
  WHERE pref.request_id = p_request_id AND pref.enabled
    AND EXISTS (SELECT 1 FROM public.group_buy_request_participations p WHERE p.request_id = p_request_id AND p.user_id = pref.user_id)
  ON CONFLICT (request_id,user_id) DO NOTHING;
  GET DIAGNOSTICS queued = ROW_COUNT;
  RETURN jsonb_build_object('requestId',p_request_id,'groupBuyId',p_group_buy_id,'status','FULFILLED','queued',queued);
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_group_buy_request(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_group_buy_request(uuid,text) TO service_role;

CREATE FUNCTION public.list_my_group_buy_requests_v2(
  p_expected_user_id uuid, p_after_requested_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL, p_limit integer DEFAULT 21
)
RETURNS TABLE(request_id uuid, product_name text, status text, requested_at timestamptz, group_buy_id text, notification_enabled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- The v1 function remains available to older app releases and enforces ownership.
  RETURN QUERY SELECT base.request_id, base.product_name, base.status, base.requested_at,
    CASE WHEN r.status = 'FULFILLED' AND gb.status = 'APPROVED' THEN gb.id ELSE NULL END,
    coalesce(pref.enabled, false)
  FROM public.list_my_group_buy_requests(p_expected_user_id,p_after_requested_at,p_after_id,p_limit) base
  JOIN public.group_buy_requests r ON r.id = base.request_id
  LEFT JOIN public.group_buys gb ON gb.id = r.fulfilled_group_buy_id
  LEFT JOIN public.group_buy_request_notification_preferences pref ON pref.request_id = r.id AND pref.user_id = p_expected_user_id
  ORDER BY base.requested_at DESC, base.request_id DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_my_group_buy_requests_v2(uuid,timestamptz,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_group_buy_requests_v2(uuid,timestamptz,uuid,integer) TO authenticated;

CREATE FUNCTION public.claim_request_fulfillment_push_events(p_limit integer DEFAULT 50)
RETURNS TABLE(event_id bigint, request_id uuid, user_id uuid, group_buy_id text, product_name text, attempt_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.request_fulfillment_push_outbox o SET status = 'FAILED', updated_at = now()
  WHERE o.status = 'PROCESSING' AND o.attempt_count >= 5 AND o.updated_at < now() - interval '10 minutes';
  UPDATE public.request_fulfillment_push_outbox o SET status = 'SKIPPED', updated_at = now()
  WHERE o.status IN ('PENDING','RETRYING') AND (
    NOT EXISTS (SELECT 1 FROM public.group_buy_request_notification_preferences p WHERE p.request_id = o.request_id AND p.user_id = o.user_id AND p.enabled)
    OR NOT EXISTS (SELECT 1 FROM public.group_buys gb WHERE gb.id = o.group_buy_id AND gb.status = 'APPROVED')
  );
  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM public.request_fulfillment_push_outbox o
    WHERE ((o.status IN ('PENDING','RETRYING') AND o.next_attempt_at <= now()) OR (o.status = 'PROCESSING' AND o.updated_at < now() - interval '10 minutes'))
      AND o.attempt_count < 5
    ORDER BY o.id LIMIT greatest(1,least(coalesce(p_limit,50),100)) FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.request_fulfillment_push_outbox o SET status = 'PROCESSING', attempt_count = o.attempt_count + 1, updated_at = now()
    FROM candidates c WHERE o.id = c.id RETURNING o.*
  )
  SELECT c.id,c.request_id,c.user_id,c.group_buy_id,r.product_name,c.attempt_count
  FROM claimed c JOIN public.group_buy_requests r ON r.id = c.request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_request_fulfillment_push_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_request_fulfillment_push_events(integer) TO service_role;
