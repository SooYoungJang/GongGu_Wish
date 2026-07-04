-- Schedule proactive Instagram CDN media refreshes.
--
-- Required Vault secrets before enabling this in a hosted project:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<publishable-or-anon-key>', 'publishable_key');
--
-- The Edge Function skips ended group buys and only calls HikerAPI when an
-- active Instagram CDN URL is already expired or expires within 1 hour.
-- Otherwise it returns the cached DB URL without spending a Hiker request.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'refresh-instagram-media-cache',
  '0 * * * *',
  $$
  select
    net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/refresh-instagram-media',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'publishable_key'
        )
      ),
      body := jsonb_build_object(
        'mode', 'batch',
        'limit', 30,
        'refreshWindowHours', 1
      ),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
