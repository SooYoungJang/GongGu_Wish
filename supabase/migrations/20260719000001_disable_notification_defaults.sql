-- New users must explicitly opt in to every push-notification category.
-- Existing user preference values are intentionally left unchanged.
ALTER TABLE public.users
  ALTER COLUMN push_enabled SET DEFAULT false,
  ALTER COLUMN deadline_reminders_enabled SET DEFAULT false,
  ALTER COLUMN new_submissions_enabled SET DEFAULT false;

-- Authenticated notification and admin Edge Functions use service_role through
-- PostgREST. Fresh Supabase projects do not grant table privileges implicitly.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO service_role;
