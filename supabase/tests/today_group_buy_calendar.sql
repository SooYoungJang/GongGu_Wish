-- Run only on a disposable LOCAL Supabase database with migrations applied.
-- Transaction rolls back every fixture. Never run this against production.
BEGIN;
INSERT INTO public.influencers (id, instagram_username, display_name, updated_at)
VALUES ('calendar-test-seller', 'calendar_test_seller', 'Test', now());
INSERT INTO public.group_buys
  (id, influencer_id, product_name, start_date, end_date, confidence, status, updated_at)
VALUES
  ('calendar-test-today', 'calendar-test-seller', 'Calendar fixture today',
    (((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC'),
    (((((now() AT TIME ZONE 'Asia/Seoul')::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC') - interval '1 millisecond'),
    1, 'APPROVED', now()),
  ('calendar-test-yesterday', 'calendar-test-seller', 'Calendar fixture yesterday',
    (((((now() AT TIME ZONE 'Asia/Seoul')::date - 1)::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC')),
    NULL, 1, 'APPROVED', now()),
  ('calendar-test-tomorrow', 'calendar-test-seller', 'Calendar fixture tomorrow',
    (((((now() AT TIME ZONE 'Asia/Seoul')::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC')),
    NULL, 1, 'APPROVED', now()),
  ('calendar-test-pending', 'calendar-test-seller', 'Calendar fixture pending',
    now() AT TIME ZONE 'UTC', NULL, 1, 'REVIEW_REQUIRED', now());
-- Use an empty disposable database so count assertions are exact.
SET LOCAL ROLE anon;
DO $$
DECLARE result jsonb;
BEGIN
  result := public.get_today_group_buy_calendar();
  IF result->>'date' <> (now() AT TIME ZONE 'Asia/Seoul')::date::text
    OR (result->>'count')::int <> 1
    OR result->'items'->0->>'productName' <> 'Calendar fixture today'
    OR result->'items'->0->>'sellerName' <> 'calendar_test_seller'
  THEN RAISE EXCEPTION 'Unexpected calendar result: %', result;
  END IF;
END;
$$;
RESET ROLE;
ALTER TABLE public.raw_posts DISABLE ROW LEVEL SECURITY;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.get_today_group_buy_calendar();
    RAISE EXCEPTION 'Expected RLS failure' USING ERRCODE = 'P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Today calendar source RLS is disabled' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
