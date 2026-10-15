-- Compensating rollback for #656. Keep the applied migration history intact.
-- Only this feature's RPC/index are removed. No app rows or RLS policies change.
DROP FUNCTION IF EXISTS public.get_today_group_buy_calendar();
DROP INDEX IF EXISTS public.group_buys_today_calendar_idx;
