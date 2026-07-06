ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_status_idx ON public.users (status);
