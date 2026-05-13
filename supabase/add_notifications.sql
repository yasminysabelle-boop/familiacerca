-- ================================================================
-- FamiliaCerca — Push Notifications + Medication Scheduling
-- Run in the Supabase SQL Editor
-- ================================================================

-- Add scheduled_times to medications (replaces free-text time field)
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS scheduled_times text[] NOT NULL DEFAULT '{}';

-- Push subscriptions table (one row per device per user)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own push subscriptions: all"
  ON public.push_subscriptions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- ================================================================
-- Optional: pg_cron schedule for the send-med-notifications function
-- Requires pg_cron extension to be enabled in Supabase (Dashboard → Extensions)
-- ================================================================
-- SELECT cron.schedule(
--   'send-med-notifications',
--   '* * * * *',   -- every minute
--   $$
--     SELECT net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/send-med-notifications',
--       headers := '{"Authorization": "Bearer <anon-key>", "Content-Type": "application/json"}'::jsonb,
--       body := '{}'::jsonb
--     );
--   $$
-- );
