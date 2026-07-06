-- Return only video CDN rows that are expired or will expire soon.
-- This keeps the hourly refresh batch from spending slots on healthy videos.

create or replace function public.instagram_cdn_oe_expires_at(cdn_url text)
returns timestamptz
language sql
stable
as $$
  with matched as (
    select substring(cdn_url from '[?&]oe=([0-9A-Fa-f]+)') as oe_hex
  )
  select
    case
      when oe_hex is null then null
      else to_timestamp(('x' || lpad(oe_hex, 16, '0'))::bit(64)::bigint)
    end
  from matched;
$$;

create or replace function public.get_refreshable_instagram_media(
  limit_count int default 30,
  refresh_window_hours int default 1
)
returns table (
  id text,
  thumbnail_url text,
  video_url text,
  media_urls text[],
  media_items jsonb,
  media_type text,
  end_date timestamp without time zone,
  submission jsonb
)
language sql
stable
as $$
  with candidates as (
    select
      gb.*,
      public.instagram_cdn_oe_expires_at(gb.video_url) as video_expires_at
    from public.group_buys gb
    where gb.status = 'APPROVED'
      and gb.media_type = 'VIDEO'
      and gb.video_url is not null
      and gb.video_url like '%cdninstagram.com%'
      and (gb.end_date is null or gb.end_date >= now())
  )
  select
    c.id,
    c.thumbnail_url,
    c.video_url,
    c.media_urls,
    c.media_items,
    c.media_type,
    c.end_date,
    jsonb_build_object('instagram_url', gs.instagram_url) as submission
  from candidates c
  left join public.gonggu_submissions gs on gs.id = c.submission_id
  where c.video_expires_at is null
    or (
      c.video_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1))
      and (c.end_date is null or c.video_expires_at <= c.end_date)
    )
  order by
    c.video_expires_at asc nulls first,
    c.updated_at asc
  limit least(greatest(limit_count, 1), 500);
$$;

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
        'limit', 100,
        'refreshWindowHours', 1
      ),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
