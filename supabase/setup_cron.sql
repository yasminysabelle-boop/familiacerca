-- FamiliaCerca — Cron jobs for push notifications
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)

-- Replace <SERVICE_ROLE_KEY> with your actual Supabase service role key
-- Found at: Dashboard → Settings → API → service_role key

-- 1. Medication reminder every minute
SELECT cron.schedule(
  'fc-med-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-med-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 2. Proof photo reminder every minute (fires ~30min after medication marked given)
SELECT cron.schedule(
  'fc-proof-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-proof-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Evening push notification — UTC-4 users / Venezuela (9pm = 01:00 UTC next day)
SELECT cron.schedule(
  'fc-evening-push-utc4',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"utc_offset": -4}'::jsonb
  );
  $$
);

-- 5. Evening push notification — UTC-5 users (9pm = 02:00 UTC next day)
SELECT cron.schedule(
  'fc-evening-push-utc5',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"utc_offset": -5}'::jsonb
  );
  $$
);

-- 4. Evening push notification — UTC-6 users (9pm = 03:00 UTC next day)
SELECT cron.schedule(
  'fc-evening-push-utc6',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"utc_offset": -6}'::jsonb
  );
  $$
);

-- To verify cron jobs are scheduled:
-- SELECT * FROM cron.job;

-- To remove a cron job:
-- SELECT cron.unschedule('fc-med-notifications');
-- SELECT cron.unschedule('fc-proof-reminders');
-- SELECT cron.unschedule('fc-evening-push-utc4');
-- SELECT cron.unschedule('fc-evening-push-utc5');
-- SELECT cron.unschedule('fc-evening-push-utc6');

-- Alternative: set the service role key directly
-- UPDATE cron.job SET command = replace(command, 'current_setting(...)', '''<YOUR_SERVICE_ROLE_KEY>''')
-- WHERE jobname IN ('fc-med-notifications', 'fc-proof-reminders');
