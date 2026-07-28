-- Persist Instagram carousel/reel music that is delivered separately from
-- the visual MP4. Existing rows are checked once by the regular refresh job.

alter table public.group_buys
  add column if not exists post_audio_url text,
  add column if not exists post_audio_start_time_ms integer,
  add column if not exists post_audio_duration_ms integer,
  add column if not exists post_audio_checked_at timestamptz,
  add column if not exists media_refresh_attempted_at timestamptz;

alter table public.gonggu_submissions
  add column if not exists post_audio_url text,
  add column if not exists post_audio_start_time_ms integer,
  add column if not exists post_audio_duration_ms integer,
  add column if not exists post_audio_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'group_buys_post_audio_start_nonnegative'
  ) then
    alter table public.group_buys
      add constraint group_buys_post_audio_start_nonnegative
      check (post_audio_start_time_ms is null or post_audio_start_time_ms >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'group_buys_post_audio_duration_positive'
  ) then
    alter table public.group_buys
      add constraint group_buys_post_audio_duration_positive
      check (post_audio_duration_ms is null or post_audio_duration_ms > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'gonggu_submissions_post_audio_start_nonnegative'
  ) then
    alter table public.gonggu_submissions
      add constraint gonggu_submissions_post_audio_start_nonnegative
      check (post_audio_start_time_ms is null or post_audio_start_time_ms >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'gonggu_submissions_post_audio_duration_positive'
  ) then
    alter table public.gonggu_submissions
      add constraint gonggu_submissions_post_audio_duration_positive
      check (post_audio_duration_ms is null or post_audio_duration_ms > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'group_buys_post_audio_timing_requires_url'
  ) then
    alter table public.group_buys
      add constraint group_buys_post_audio_timing_requires_url
      check (
        post_audio_url is not null
        or (post_audio_start_time_ms is null and post_audio_duration_ms is null)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'gonggu_submissions_post_audio_timing_requires_url'
  ) then
    alter table public.gonggu_submissions
      add constraint gonggu_submissions_post_audio_timing_requires_url
      check (
        post_audio_url is not null
        or (post_audio_start_time_ms is null and post_audio_duration_ms is null)
      );
  end if;
end $$;

create index if not exists group_buys_post_audio_unchecked_idx
  on public.group_buys (media_refresh_attempted_at, updated_at)
  where status = 'APPROVED'
    and post_audio_checked_at is null;

-- Create a per-environment cron credential without exposing it to the Edge
-- Function configuration or to public database roles.
do $$
begin
  if not exists (
    select 1 from vault.secrets
    where name = 'instagram_refresh_cron_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'instagram_refresh_cron_secret',
      'Authenticates the scheduled Instagram media refresh Edge Function call'
    );
  end if;
end $$;

create or replace function public.verify_instagram_refresh_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    candidate is not null
    and length(candidate) between 32 and 256
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'instagram_refresh_cron_secret'
        and decrypted_secret = candidate
    ),
    false
  );
$$;

revoke all on function public.verify_instagram_refresh_cron_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_instagram_refresh_cron_secret(text)
  to service_role;

-- Atomically claims a row before a paid Hiker request. The timestamp is
-- written even when Hiker later fails, so retries and concurrent calls remain
-- durably bounded across Edge Function instances.
create or replace function public.claim_instagram_media_refresh(
  target_group_buy_id text,
  cooldown_seconds integer default 900
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed_id text;
begin
  update public.group_buys
  set media_refresh_attempted_at = now()
  where id = target_group_buy_id
    and status = 'APPROVED'
    and (end_date is null or end_date >= now())
    and (
      media_refresh_attempted_at is null
      or media_refresh_attempted_at <= now() - make_interval(secs => greatest(cooldown_seconds, 0))
    )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_instagram_media_refresh(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_instagram_media_refresh(text, integer)
  to service_role;

create table if not exists public.instagram_media_refresh_user_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.instagram_media_refresh_user_quotas enable row level security;
revoke all on table public.instagram_media_refresh_user_quotas
  from public, anon, authenticated;

-- Globally bounds paid recovery calls from one authenticated account across
-- the entire catalog, not merely per group-buy row.
create or replace function public.claim_instagram_media_refresh_user_quota(
  target_user_id uuid,
  max_attempts integer default 3,
  window_seconds integer default 3600
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed_user_id uuid;
begin
  if target_user_id is null then
    return false;
  end if;

  insert into public.instagram_media_refresh_user_quotas as quota (
    user_id,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (target_user_id, now(), 1, now())
  on conflict (user_id) do update
  set
    window_started_at = case
      when quota.window_started_at <= now()
        - make_interval(secs => greatest(window_seconds, 60))
      then now()
      else quota.window_started_at
    end,
    attempt_count = case
      when quota.window_started_at <= now()
        - make_interval(secs => greatest(window_seconds, 60))
      then 1
      else quota.attempt_count + 1
    end,
    updated_at = now()
  where quota.window_started_at <= now()
      - make_interval(secs => greatest(window_seconds, 60))
    or quota.attempt_count < greatest(max_attempts, 1)
  returning user_id into claimed_user_id;

  return claimed_user_id is not null;
end;
$$;

revoke all on function public.claim_instagram_media_refresh_user_quota(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_instagram_media_refresh_user_quota(uuid, integer, integer)
  to service_role;

-- The return shape changes to include post-audio cache fields, so recreate the
-- function instead of CREATE OR REPLACE (PostgreSQL cannot replace OUT types).
drop function if exists public.get_refreshable_instagram_media(integer, integer);
drop function if exists public.get_refreshable_instagram_media(integer, integer, integer);

create function public.get_refreshable_instagram_media(
  limit_count int default 30,
  refresh_window_hours int default 1,
  minimum_attempt_age_seconds int default 3300
)
returns table (
  id text,
  status text,
  thumbnail_url text,
  video_url text,
  media_urls text[],
  media_items jsonb,
  media_type text,
  post_audio_url text,
  post_audio_start_time_ms integer,
  post_audio_duration_ms integer,
  post_audio_checked_at timestamptz,
  media_refreshed_at timestamptz,
  media_refresh_attempted_at timestamptz,
  end_date timestamp without time zone,
  submission jsonb
)
language sql
stable
as $$
  with candidates as (
    select
      gb.*,
      gs.instagram_url,
      public.instagram_cdn_oe_expires_at(gb.video_url) as video_expires_at,
      public.instagram_cdn_oe_expires_at(gb.post_audio_url) as audio_expires_at
    from public.group_buys gb
    left join public.gonggu_submissions gs on gs.id = gb.submission_id
    where gb.status = 'APPROVED'
      and (gb.end_date is null or gb.end_date >= now())
      and (
        (
          gb.post_audio_checked_at is null
          and gs.instagram_url ~* '^https://([a-z0-9-]+\.)*instagram\.com/'
        )
        or gb.video_url ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
        or gb.post_audio_url ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      )
      and (
        gb.media_refresh_attempted_at is null
        or gb.media_refresh_attempted_at <= now()
          - make_interval(secs => greatest(minimum_attempt_age_seconds, 1))
      )
  )
  select
    c.id,
    c.status::text,
    c.thumbnail_url,
    c.video_url,
    c.media_urls,
    c.media_items,
    c.media_type,
    c.post_audio_url,
    c.post_audio_start_time_ms,
    c.post_audio_duration_ms,
    c.post_audio_checked_at,
    c.media_refreshed_at,
    c.media_refresh_attempted_at,
    c.end_date,
    jsonb_build_object('instagram_url', c.instagram_url) as submission
  from candidates c
  where
    c.post_audio_checked_at is null
    or (
      c.video_url is not null
      and c.video_url ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      and (
        c.video_expires_at is null
        or (
          c.video_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1))
          and (c.end_date is null or c.video_expires_at <= c.end_date)
        )
      )
    )
    or (
      c.post_audio_url is not null
      and c.post_audio_url ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      and (
        c.audio_expires_at is null
        or (
          c.audio_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1))
          and (c.end_date is null or c.audio_expires_at <= c.end_date)
        )
      )
    )
  order by
    (c.post_audio_checked_at is null) desc,
    least(c.video_expires_at, c.audio_expires_at) asc nulls first,
    c.updated_at asc
  limit least(greatest(limit_count, 1), 500);
$$;

revoke all on function public.get_refreshable_instagram_media(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_refreshable_instagram_media(integer, integer, integer)
  to service_role;

-- Replace the legacy public-key-only cron call with the Vault-backed secret.
do $$
declare
  refresh_job_id bigint;
begin
  select jobid
    into refresh_job_id
  from cron.job
  where jobname = 'refresh-instagram-media-cache'
  limit 1;

  if refresh_job_id is not null then
    perform cron.unschedule(refresh_job_id);
  end if;
end $$;

select cron.schedule(
  'refresh-instagram-media-cache',
  '0 * * * *',
  $$
  select net.http_post(
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
      ),
      'X-Refresh-Cron-Secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'instagram_refresh_cron_secret'
      )
    ),
    body := jsonb_build_object(
      'mode', 'batch',
      'limit', 100,
      'refreshWindowHours', 1
    ),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
