-- Automatic collections keep their canonical Instagram URL on raw_posts,
-- while user submissions keep it on gonggu_submissions. Preserve the existing
-- RPC envelope while resolving either source for the refresh worker.
create or replace function public.get_refreshable_instagram_media(
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
      rp.post_url as raw_post_url,
      public.instagram_cdn_oe_expires_at(gb.thumbnail_url) as thumbnail_expires_at,
      public.instagram_cdn_oe_expires_at(gb.video_url) as video_expires_at,
      public.instagram_cdn_oe_expires_at(gb.post_audio_url) as audio_expires_at
    from public.group_buys gb
    left join public.gonggu_submissions gs on gs.id = gb.submission_id
    left join public.raw_posts rp on rp.id = gb.raw_post_id
    where gb.status = 'APPROVED'
      and (gb.end_date is null or gb.end_date >= now())
      and (
        rp.post_url
          ~* '^https://([a-z0-9-]+\.)*instagram\.com/(p|reel|tv)/[^/?#]+/?([?#].*)?$'
        or gs.instagram_url
          ~* '^https://([a-z0-9-]+\.)*instagram\.com/(p|reel|tv)/[^/?#]+/?([?#].*)?$'
      )
      and (
        gb.post_audio_checked_at is null
        or gb.thumbnail_url
          ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
        or gb.video_url
          ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
        or gb.post_audio_url
          ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
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
    jsonb_build_object(
      'instagram_url',
      case
        when c.raw_post_url
          ~* '^https://([a-z0-9-]+\.)*instagram\.com/(p|reel|tv)/[^/?#]+/?([?#].*)?$'
          then c.raw_post_url
        else c.instagram_url
      end
    ) as submission
  from candidates c
  where
    c.post_audio_checked_at is null
    or (
      c.thumbnail_url is not null
      and c.thumbnail_url
        ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      and (
        c.thumbnail_expires_at is null
        or (
          c.thumbnail_expires_at <= now()
            + make_interval(hours => greatest(refresh_window_hours, 1))
          and (c.end_date is null or c.thumbnail_expires_at <= c.end_date)
        )
      )
    )
    or (
      c.video_url is not null
      and c.video_url
        ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      and (
        c.video_expires_at is null
        or (
          c.video_expires_at <= now()
            + make_interval(hours => greatest(refresh_window_hours, 1))
          and (c.end_date is null or c.video_expires_at <= c.end_date)
        )
      )
    )
    or (
      c.post_audio_url is not null
      and c.post_audio_url
        ~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/:?#]|$)'
      and (
        c.audio_expires_at is null
        or (
          c.audio_expires_at <= now()
            + make_interval(hours => greatest(refresh_window_hours, 1))
          and (c.end_date is null or c.audio_expires_at <= c.end_date)
        )
      )
    )
  order by
    (c.post_audio_checked_at is null) desc,
    least(
      c.thumbnail_expires_at,
      c.video_expires_at,
      c.audio_expires_at
    ) asc nulls first,
    c.updated_at asc
  limit least(greatest(limit_count, 1), 500);
$$;

revoke all on function public.get_refreshable_instagram_media(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_refreshable_instagram_media(integer, integer, integer)
  to service_role;
