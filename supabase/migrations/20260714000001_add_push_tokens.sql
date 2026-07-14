ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_provider TEXT;

CREATE INDEX IF NOT EXISTS users_push_token_idx
  ON public.users (push_token)
  WHERE push_token IS NOT NULL;
