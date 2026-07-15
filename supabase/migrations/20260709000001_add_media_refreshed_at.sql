-- Track the last time Instagram CDN media was refreshed via HikerAPI.
-- Separated from updated_at because admin edits also bump updated_at,
-- which would make refresh tracking unreliable.
-- instagram_cdn_oe_expires_at() is defined in 20260706110835_add_refreshable_instagram_media_rpc.sql.

alter table public.group_buys
  add column if not exists media_refreshed_at timestamp with time zone;

-- Index for the refresh-status admin view: approved video rows ordered by refresh time.
create index if not exists group_buys_media_refreshed_at_idx
  on public.group_buys (media_refreshed_at)
  where status = 'APPROVED' and media_type = 'VIDEO';
