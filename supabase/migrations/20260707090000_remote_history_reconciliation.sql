-- The production project already contains migration 20260707090000, but the
-- original file was not present in this repository. Keep the local migration
-- history aligned so later migrations and Edge Function deployments can run.
--
-- This is intentionally a no-op: the remote migration has already been
-- applied, and its schema changes must not be replayed here.
SELECT 1;
