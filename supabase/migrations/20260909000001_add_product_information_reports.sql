CREATE TABLE public.product_information_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_buy_id text NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('PRICE', 'SOLD_OUT', 'ENDED', 'LINK')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  review_note text CHECK (char_length(review_note) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_information_reports_open_unique
  ON public.product_information_reports(user_id, group_buy_id, reason) WHERE status = 'OPEN';
CREATE INDEX product_information_reports_queue ON public.product_information_reports(status, created_at DESC);
CREATE INDEX product_information_reports_actor_time ON public.product_information_reports(user_id, created_at DESC);
ALTER TABLE public.product_information_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_information_reports_owner_read ON public.product_information_reports
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.product_information_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, group_buy_id, reason, status, created_at) ON public.product_information_reports TO authenticated;
GRANT ALL ON public.product_information_reports TO service_role;

CREATE FUNCTION public.submit_product_report(p_expected_user_id uuid, p_group_buy_id text, p_reason text)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL OR p_expected_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Account changed' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('PRICE', 'SOLD_OUT', 'ENDED', 'LINK') THEN
    RAISE EXCEPTION 'Invalid report reason' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_buys gb WHERE gb.id = p_group_buy_id AND gb.status = 'APPROVED') THEN
    RAISE EXCEPTION 'Public product is unavailable' USING ERRCODE = 'P0002';
  END IF;
  -- Serialize per-account submissions so concurrent requests cannot bypass the cap.
  PERFORM pg_advisory_xact_lock(hashtextextended('product-report:' || v_user_id::text, 0));
  SELECT r.id INTO v_id FROM public.product_information_reports r
    WHERE r.user_id = v_user_id AND r.group_buy_id = p_group_buy_id AND r.reason = p_reason AND r.status = 'OPEN';
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, 'OPEN'::text;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.product_information_reports r
      WHERE r.user_id = v_user_id AND r.created_at > now() - interval '24 hours') >= 15 THEN
    RAISE EXCEPTION 'Too many reports; try again later' USING ERRCODE = 'PT429';
  END IF;
  INSERT INTO public.product_information_reports(user_id, group_buy_id, reason)
    VALUES (v_user_id, p_group_buy_id, p_reason) RETURNING product_information_reports.id INTO v_id;
  RETURN QUERY SELECT v_id, 'OPEN'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_product_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_product_report(uuid, text, text) TO authenticated;
