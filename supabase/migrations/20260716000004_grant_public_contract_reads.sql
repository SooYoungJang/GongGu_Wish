-- GON-263: RLS policies define which rows are public, while SQL privileges
-- determine whether PostgREST may evaluate those policies at all. Fresh
-- projects need both for the mobile nested group-buy query.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT
  ON TABLE public.influencers, public.raw_posts, public.group_buys
  TO anon, authenticated;
