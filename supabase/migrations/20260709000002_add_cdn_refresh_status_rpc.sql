-- Admin-facing view of Instagram CDN media refresh status.
-- Categorizes each approved VIDEO group buy into health buckets:
--   expired      - CDN URL already expired
--   expiring     - CDN URL expires within refresh_window_hours
--   healthy      - CDN URL valid beyond the window
--   unknown      - CDN URL has no parseable expiry (needs immediate refresh)
--   no_cdn       - video_url is not an Instagram CDN URL
-- instagram_cdn_oe_expires_at() is defined in 20260706110835_add_refreshable_instagram_media_rpc.sql.

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
      when c.video_url not like '%cdninstagram.com%' then 'no_cdn'
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
        when c.video_url not like '%cdninstagram.com%' then 'no_cdn'
        when c.cdn_expires_at is null then 'unknown'
        when c.cdn_expires_at <= now() then 'expired'
        when c.cdn_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1)) then 'expiring'
        else 'healthy'
      end = status_filter)
  order by
    case
      when c.video_url not like '%cdninstagram.com%' then 4
      when c.cdn_expires_at is null then 0
      when c.cdn_expires_at <= now() then 1
      when c.cdn_expires_at <= now() + make_interval(hours => greatest(refresh_window_hours, 1)) then 2
      else 3
    end,
    c.cdn_expires_at asc nulls first,
    c.updated_at asc
  limit least(greatest(limit_count, 1), 500);
$$;
