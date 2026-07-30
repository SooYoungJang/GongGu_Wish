-- Prefer the account saved directly on an approved group buy. Older rows can
-- still resolve through raw_posts -> influencers, while genuinely missing
-- accounts remain NULL instead of becoming the visible "unknown" placeholder.

DO $migration$
DECLARE
  function_signature text;
  target_function regprocedure;
  original_definition text;
  updated_definition text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.get_group_buy_rankings(text,text,text,integer,numeric,timestamp without time zone,text)',
    'public.get_group_buy_rankings_v2(text,text,text,integer,numeric,timestamp without time zone,numeric,text)'
  ]
  LOOP
    target_function := to_regprocedure(function_signature);
    IF target_function IS NULL THEN
      RAISE EXCEPTION 'ranking function not found: %', function_signature;
    END IF;

    SELECT pg_get_functiondef(target_function)
      INTO original_definition;

    updated_definition := replace(
      original_definition,
      'COALESCE(i.instagram_username, ''unknown'')',
      'COALESCE(NULLIF(BTRIM(g.instagram_username), ''''), NULLIF(BTRIM(i.instagram_username), ''''))'
    );

    IF updated_definition = original_definition THEN
      RAISE EXCEPTION 'ranking username expression not found: %', function_signature;
    END IF;

    EXECUTE updated_definition;
  END LOOP;
END
$migration$;
