-- public._prisma_migrations exists only where Prisma has run against this
-- database (not in local or preview stacks), so guard on its existence.
-- RLS with no policies plus revoked grants closes it to the Data API;
-- the owner (postgres) still bypasses RLS for Prisma itself.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;
  END IF;
END
$$;
