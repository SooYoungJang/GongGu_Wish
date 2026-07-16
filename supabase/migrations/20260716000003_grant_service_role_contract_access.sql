-- GON-263: Fresh projects revoke public-schema table privileges by default.
-- Edge Functions still use service_role through PostgREST, so grant only the
-- commerce rows and event sequence required by the Admin/ranking pipeline.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.influencers, public.raw_posts, public.group_buys
  TO service_role;

GRANT SELECT, INSERT, DELETE
  ON TABLE public.group_buy_views
  TO service_role;

GRANT USAGE, SELECT
  ON SEQUENCE public.group_buy_views_id_seq
  TO service_role;

GRANT EXECUTE ON FUNCTION public.get_group_buy_rankings(
  text, text, text, integer, numeric, timestamp, text
) TO service_role;
