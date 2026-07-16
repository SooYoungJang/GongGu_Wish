-- Deterministic public rows used only by local native E2E runners. Contract
-- tests add and remove their own isolated fixtures around these baseline rows.

INSERT INTO public.influencers (
  id,
  instagram_username,
  display_name,
  updated_at
) VALUES
  ('gon263-e2e-influencer-price', 'gon263_price', 'GON-263 Price', now()),
  ('gon263-e2e-influencer-banner', 'gon263_banner', 'GON-263 Banner', now()),
  ('gon263-e2e-influencer-recent', 'gon263_recent', 'GON-263 Recent', now()),
  ('gon263-e2e-influencer-beauty', 'gon263_beauty', 'GON-263 Beauty', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.raw_posts (
  id,
  instagram_post_id,
  influencer_id,
  caption,
  post_url,
  taken_at,
  content_hash,
  is_candidate,
  collected_at,
  updated_at
) VALUES
  (
    'gon263-e2e-post-price',
    'gon263-e2e-instagram-price',
    'gon263-e2e-influencer-price',
    'GON-263 local price fixture',
    'https://instagram.com/p/gon263-price',
    now() - interval '4 hours',
    'gon263-e2e-hash-price',
    true,
    now(),
    now()
  ),
  (
    'gon263-e2e-post-banner',
    'gon263-e2e-instagram-banner',
    'gon263-e2e-influencer-banner',
    'GON-263 local banner fixture',
    'https://instagram.com/p/gon263-banner',
    now() - interval '3 hours',
    'gon263-e2e-hash-banner',
    true,
    now(),
    now()
  ),
  (
    'gon263-e2e-post-recent',
    'gon263-e2e-instagram-recent',
    'gon263-e2e-influencer-recent',
    'GON-263 local canonical fixture',
    'https://instagram.com/p/gon263-recent',
    now() - interval '2 hours',
    'gon263-e2e-hash-recent',
    true,
    now(),
    now()
  ),
  (
    'gon263-e2e-post-beauty',
    'gon263-e2e-instagram-beauty',
    'gon263-e2e-influencer-beauty',
    'GON-263 local beauty fixture',
    'https://instagram.com/p/gon263-beauty',
    now() - interval '1 hour',
    'gon263-e2e-hash-beauty',
    true,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_buys (
  id,
  raw_post_id,
  product_name,
  brand_name,
  category,
  start_date,
  end_date,
  purchase_url,
  discount_info,
  price_krw,
  summary,
  confidence,
  video_url,
  media_urls,
  media_type,
  status,
  is_home_banner,
  home_banner_start_date,
  home_banner_end_date,
  created_at,
  updated_at
) VALUES
  (
    'gon263-e2e-price-200000',
    'gon263-e2e-post-price',
    'GON-263 기준 공구',
    'GON-263 Brand',
    'food',
    now() - interval '1 hour',
    now() + interval '2 days',
    'https://example.test/gon263/price',
    '20% 할인',
    200000,
    'GON-263 canonical price summary',
    0.99,
    'http://10.0.2.2:58080/media/fixture.mp4',
    ARRAY['http://10.0.2.2:58080/media/fixture.mp4']::text[],
    'VIDEO',
    'APPROVED',
    false,
    NULL,
    NULL,
    now() - interval '4 hours',
    now()
  ),
  (
    'gon263-e2e-banner-visible',
    'gon263-e2e-post-banner',
    'GON-263 공개 배너 공구',
    'GON-263 Brand',
    'food',
    now() - interval '1 hour',
    now() + interval '3 days',
    'https://example.test/gon263/banner',
    '25% 할인',
    35000,
    'GON-263 visible banner summary',
    0.99,
    'http://10.0.2.2:58080/media/fixture.mp4',
    ARRAY['http://10.0.2.2:58080/media/fixture.mp4']::text[],
    'VIDEO',
    'APPROVED',
    true,
    current_date - 1,
    current_date + 7,
    now() - interval '3 hours',
    now()
  ),
  (
    'gon263-e2e-canonical-recent',
    'gon263-e2e-post-recent',
    'GON-263 canonical 상세',
    'GON-263 Brand',
    'food',
    now() - interval '1 hour',
    now() + interval '2 days',
    'https://example.test/gon263/recent',
    '30% 할인',
    48000,
    'GON-263 canonical recent summary',
    0.99,
    'http://10.0.2.2:58080/media/fixture.mp4',
    ARRAY['http://10.0.2.2:58080/media/fixture.mp4']::text[],
    'VIDEO',
    'APPROVED',
    false,
    NULL,
    NULL,
    now() - interval '2 hours',
    now()
  ),
  (
    'gon263-e2e-beauty',
    'gon263-e2e-post-beauty',
    'GON-263 뷰티 공구',
    'GON-263 Brand',
    'beauty',
    now() - interval '1 hour',
    now() + interval '4 days',
    'https://example.test/gon263/beauty',
    '35% 할인',
    29000,
    'GON-263 beauty summary',
    0.99,
    'http://10.0.2.2:58080/media/fixture.mp4',
    ARRAY['http://10.0.2.2:58080/media/fixture.mp4']::text[],
    'VIDEO',
    'APPROVED',
    false,
    NULL,
    NULL,
    now() - interval '1 hour',
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_buy_views (
  group_buy_id,
  view_type,
  viewed_at,
  session_id
)
SELECT
  fixture.group_buy_id,
  'deep',
  now() - interval '30 minutes',
  fixture.session_prefix || series.value
FROM (
  VALUES
    ('gon263-e2e-price-200000', 'gon263-e2e-price-', 30),
    ('gon263-e2e-banner-visible', 'gon263-e2e-banner-', 20),
    ('gon263-e2e-canonical-recent', 'gon263-e2e-recent-', 10),
    ('gon263-e2e-beauty', 'gon263-e2e-beauty-', 25)
) AS fixture(group_buy_id, session_prefix, view_count)
CROSS JOIN LATERAL generate_series(1, fixture.view_count) AS series(value)
ON CONFLICT DO NOTHING;
