-- The delete-account Edge Function derives this id from a verified user JWT;
-- callers cannot choose which profile is removed. Fresh projects revoke Data
-- API table privileges by default, so grant only the missing operation needed
-- by the server-side service_role client.

GRANT DELETE ON TABLE public.users TO service_role;
