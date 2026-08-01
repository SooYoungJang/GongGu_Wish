-- Align the all-category ranking candidate set with the active APPROVED deals
-- shown by the mobile app. Category-specific requests remain strict, while an
-- uncategorized deal is allowed in the all-category response.
--
-- Add v3 instead of replacing v2 so an Edge deployment and this migration can
-- arrive in either order without breaking existing clients.

DO $migration$
DECLARE
  source_function regprocedure;
  original_definition text;
  updated_definition text;
  category_predicate text := $predicate$
      AND CASE
        WHEN g.category = 'lifestyle' THEN 'living'
        WHEN g.category = 'digital' THEN 'electronics'
        ELSE g.category
      END IN (
        'food', 'living', 'beauty', 'fashion', 'home', 'kitchen',
        'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports',
        'stationery', 'books', 'media', 'travel'
      )$predicate$;
  updated_category_predicate text := $predicate$
      AND (
        g.category IS NULL
        OR CASE
          WHEN g.category = 'lifestyle' THEN 'living'
          WHEN g.category = 'digital' THEN 'electronics'
          ELSE g.category
        END IN (
          'food', 'living', 'beauty', 'fashion', 'home', 'kitchen',
          'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports',
          'stationery', 'books', 'media', 'travel'
        )
      )$predicate$;
BEGIN
  source_function := to_regprocedure(
    'public.get_group_buy_rankings_v2(text,text,text,integer,numeric,timestamp without time zone,numeric,text)'
  );
  IF source_function IS NULL THEN
    RAISE EXCEPTION 'ranking function not found: get_group_buy_rankings_v2';
  END IF;

  SELECT pg_get_functiondef(source_function)
    INTO original_definition;

  updated_definition := replace(
    original_definition,
    'FUNCTION public.get_group_buy_rankings_v2',
    'FUNCTION public.get_group_buy_rankings_v3'
  );
  IF updated_definition = original_definition THEN
    RAISE EXCEPTION 'ranking v2 function header was not found';
  END IF;

  original_definition := updated_definition;
  updated_definition := replace(
    original_definition,
    'AND (g.end_date IS NULL OR g.end_date >= now())',
    'AND (g.end_date IS NULL OR g.end_date::date >= (now() AT TIME ZONE ''Asia/Seoul'')::date)'
  );
  IF updated_definition = original_definition THEN
    RAISE EXCEPTION 'ranking expiry predicate was not found';
  END IF;

  original_definition := updated_definition;
  updated_definition := replace(
    original_definition,
    category_predicate,
    updated_category_predicate
  );
  IF updated_definition = original_definition THEN
    RAISE EXCEPTION 'ranking category eligibility predicate was not found';
  END IF;

  EXECUTE updated_definition;
END
$migration$;

REVOKE ALL ON FUNCTION public.get_group_buy_rankings_v3(
  text,
  text,
  text,
  integer,
  numeric,
  timestamp,
  numeric,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_group_buy_rankings_v3(
  text,
  text,
  text,
  integer,
  numeric,
  timestamp,
  numeric,
  text
) TO service_role;
