-- Instagram media URLs are served from both cdninstagram.com and fbcdn.net.
-- Keep the refresh batch and admin status view aligned with the Edge Function.

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
      and gb.video_url ~* '^https?://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
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

create or replace function public.get_instagram_cdn_refresh_status(
  limit_count int default 50,
  refresh_window_hours int default 1,
  status_filter text default null
)
returns table (
  id text,
  product_name text,
  brand_name text,
  category text,
  video_url text,
  thumbnail_url text,
  end_date timestamp without time zone,
  updated_at timestamptz,
  media_refreshed_at timestamptz,
  cdn_expires_at timestamptz,
  refresh_status text,
  instagram_url text
)
language sql
stable
as $$
  with candidates as (
    select
      gb.id,
      gb.product_name,
      gb.brand_name,
      gb.category,
      gb.video_url,
      gb.thumbnail_url,
      gb.end_date,
      gb.updated_at,
      gb.media_refreshed_at,
      public.instagram_cdn_oe_expires_at(gb.video_url) as cdn_expires_at,
      gb.submission_id,
      gs.instagram_url
    from public.group_buys gb
    left join public.gonggu_submissions gs on gs.id = gb.submission_id
    where gb.status = 'APPROVED'
      and gb.media_type = 'VIDEO'
      and gb.video_url is not null
  )
  select
    c.id,
    c.product_name,
    c.brand_name,
    c.category,
    c.video_url,
    c.thumbnail_url,
    c.end_date,
    c.updated_at,
    c.media_refreshed_at,
    c.cdn_expires_at,
    case
      when c.video_url !~* '^https?://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)' then 'no_cdn'
      when c.cdn_expires_at is null then 'unknown'
      when c.cdn_expires_at <= now() then 'expired'
      when c.cdn_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1)) then 'expiring'
      else 'healthy'
    end as refresh_status,
    c.instagram_url
  from candidates c
  where
    (status_filter is null or status_filter = 'all'
      or case
        when c.video_url !~* '^https?://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)' then 'no_cdn'
        when c.cdn_expires_at is null then 'unknown'
        when c.cdn_expires_at <= now() then 'expired'
        when c.cdn_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1)) then 'expiring'
        else 'healthy'
      end = status_filter)
  order by
    case
      when c.video_url !~* '^https?://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)' then 4
      when c.cdn_expires_at is null then 0
      when c.cdn_expires_at <= now() then 1
      when c.cdn_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1)) then 2
      else 3
    end,
    c.cdn_expires_at asc nulls first,
    c.updated_at asc
  limit least(greatest(limit_count, 1), 500);
$$;
