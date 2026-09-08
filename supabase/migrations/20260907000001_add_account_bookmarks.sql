CREATE TABLE public.account_bookmarks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_buy_id text NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_buy_id)
);

ALTER TABLE public.account_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_bookmarks_owner_read ON public.account_bookmarks
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.account_bookmarks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_bookmarks TO authenticated;
GRANT ALL ON public.account_bookmarks TO service_role;

-- The server constructs the snapshot from public product fields. A caller
-- cannot upload arbitrary JSON or write on behalf of a different account.
CREATE FUNCTION public.set_my_bookmark(
  p_expected_user_id uuid,
  p_group_buy_id text,
  p_selected boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_snapshot jsonb;
BEGIN
  IF v_user_id IS NULL OR p_expected_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Account changed' USING ERRCODE = '42501';
  END IF;
  IF p_selected IS NULL OR p_group_buy_id IS NULL OR char_length(p_group_buy_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid bookmark' USING ERRCODE = '22023';
  END IF;
  IF NOT p_selected THEN
    DELETE FROM public.account_bookmarks WHERE user_id = v_user_id AND group_buy_id = p_group_buy_id;
    RETURN;
  END IF;

  SELECT (
    SELECT jsonb_object_agg(field.key, field.value)
    FROM jsonb_each(to_jsonb(gb)) field
    WHERE field.key = ANY(ARRAY[
      'id', 'product_name', 'brand_name', 'category', 'start_date', 'end_date',
      'purchase_url', 'discount_info', 'summary', 'confidence', 'price_krw',
      'thumbnail_url', 'video_url', 'media_urls', 'media_items', 'media_type',
      'post_audio_url', 'post_audio_start_time_ms', 'post_audio_duration_ms',
      'instagram_username', 'created_at', 'updated_at'
    ])
  ) || jsonb_build_object(
    'influencer_id', CASE WHEN direct_i.id IS NULL THEN NULL ELSE jsonb_build_object(
      'instagram_username', direct_i.instagram_username, 'profile_image_url', direct_i.profile_image_url
    ) END,
    'raw_post_id', CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object(
      'post_url', rp.post_url,
      'influencer_id', jsonb_build_object('instagram_username', post_i.instagram_username, 'profile_image_url', post_i.profile_image_url)
    ) END
  ) INTO v_snapshot
  FROM public.group_buys gb
  LEFT JOIN public.influencers direct_i ON direct_i.id = gb.influencer_id
  LEFT JOIN public.raw_posts rp ON rp.id = gb.raw_post_id
  LEFT JOIN public.influencers post_i ON post_i.id = rp.influencer_id
  WHERE gb.id = p_group_buy_id AND gb.status = 'APPROVED';

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Public product is unavailable' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.account_bookmarks (user_id, group_buy_id, snapshot)
  VALUES (v_user_id, p_group_buy_id, v_snapshot)
  ON CONFLICT (user_id, group_buy_id) DO UPDATE SET snapshot = EXCLUDED.snapshot;
END;
$$;

CREATE FUNCTION public.list_my_bookmarks(
  p_expected_user_id uuid,
  p_after_id text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(group_buy_id text, snapshot jsonb)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_expected_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Account changed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT b.group_buy_id, b.snapshot FROM public.account_bookmarks b
  WHERE b.user_id = auth.uid() AND (p_after_id IS NULL OR b.group_buy_id > p_after_id)
  ORDER BY b.group_buy_id
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_bookmark(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_bookmarks(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_bookmark(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_bookmarks(uuid, text, integer) TO authenticated;
