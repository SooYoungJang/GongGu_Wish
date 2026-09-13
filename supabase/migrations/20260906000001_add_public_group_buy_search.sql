-- Keyset search returns the table row type so PostgREST can embed its public
-- influencer/raw-post relationships without duplicating the public projection.
CREATE OR REPLACE FUNCTION public.search_public_group_buys(
  p_query text,
  p_limit integer DEFAULT 21,
  p_before_created_at timestamp without time zone DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date
)
RETURNS SETOF public.group_buys
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query text := lower(regexp_replace(coalesce(p_query, ''), '[[:space:]]', '', 'g'));
BEGIN
  IF char_length(p_query) > 200 THEN
    RAISE EXCEPTION 'Search query is too long' USING ERRCODE = '22023';
  END IF;
  IF (p_before_created_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE = '22023';
  END IF;
  IF v_query = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT gb.*
  FROM public.group_buys gb
  LEFT JOIN public.influencers direct_i ON direct_i.id = gb.influencer_id
  LEFT JOIN public.raw_posts rp ON rp.id = gb.raw_post_id
  LEFT JOIN public.influencers post_i ON post_i.id = rp.influencer_id
  WHERE gb.status = 'APPROVED'
    AND (gb.end_date IS NULL OR gb.end_date::date >= coalesce(p_today, (now() AT TIME ZONE 'Asia/Seoul')::date))
    AND (p_before_created_at IS NULL OR (gb.created_at, gb.id) < (p_before_created_at, p_before_id))
    AND strpos(lower(regexp_replace(concat_ws(' ',
      gb.product_name, gb.brand_name, gb.category,
      CASE gb.category
        WHEN 'food' THEN '식품 푸드' WHEN 'living' THEN '생활용품 라이프'
        WHEN 'lifestyle' THEN '생활용품 라이프' WHEN 'beauty' THEN '뷰티'
        WHEN 'fashion' THEN '패션' WHEN 'home' THEN '홈인테리어'
        WHEN 'kitchen' THEN '주방용품' WHEN 'electronics' THEN '전자제품 디지털'
        WHEN 'digital' THEN '전자제품 디지털' WHEN 'pet' THEN '반려동물'
        WHEN 'auto' THEN '자동차용품' WHEN 'hobby' THEN '취미'
        WHEN 'baby' THEN '육아' WHEN 'sports' THEN '스포츠'
        WHEN 'stationery' THEN '문구' WHEN 'books' THEN '도서'
        WHEN 'media' THEN '음반-DVD' WHEN 'travel' THEN '여행'
      END,
      gb.instagram_username, direct_i.instagram_username, direct_i.display_name,
      post_i.instagram_username, post_i.display_name
    ), '[[:space:]]', '', 'g')), v_query) > 0
  ORDER BY gb.created_at DESC, gb.id DESC
  LIMIT least(greatest(coalesce(p_limit, 21), 1), 51);
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_group_buys(text, integer, timestamp without time zone, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_group_buys(text, integer, timestamp without time zone, text, date) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS group_buys_public_search_cursor_idx
  ON public.group_buys (created_at DESC, id DESC)
  WHERE status = 'APPROVED';
