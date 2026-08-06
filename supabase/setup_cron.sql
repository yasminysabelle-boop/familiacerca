-- FamiliaCerca — Cron jobs para push notifications, emails y recordatorios
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Requires pg_cron, pg_net y supabase_vault (habilitadas por default en Supabase)
--
-- ================================================================
-- Historial de este archivo:
-- Hasta 2026-08 estos 7 jobs mandaban el JWT service_role de Supabase, literal
-- en texto plano, dentro de cron.job.command — visible para cualquiera con
-- acceso de lectura a cron.job (ej. postgres role / SQL Editor). Hallazgo de
-- seguridad julio 2026, remediado en agosto 2026 con dos cambios:
--
-- 1. Mínimo privilegio: el header Authorization ahora lleva la anon key
--    (pública, sin valor de confidencialidad — el gateway de Supabase solo
--    exige un JWT válido del proyecto, no distingue rol). Cada función valida
--    por su cuenta un secreto propio en un header separado, X-Cron-Secret,
--    en vez de depender del JWT del caller. Las funciones nunca usaron la
--    identidad del caller de todas formas — cada una arma su propio cliente
--    admin con su SUPABASE_SERVICE_ROLE_KEY (env var de la función, no
--    relacionado al header entrante).
--
--    IMPORTANTE — por qué el secreto va en X-Cron-Secret y no en Authorization:
--    con verify_jwt:true (todas las funciones de acá abajo), el gateway
--    exige que Authorization sea un JWT real con formato válido — un secreto
--    random ahí lo rechaza (401 UNAUTHORIZED_INVALID_JWT_FORMAT) ANTES de que
--    el código de la función corra. Causó una ventana real de 2 minutos de
--    rechazo en fc-med-notifications durante la remediación (ver commits de
--    agosto 2026) hasta separar ambos headers.
--
-- 2. El secreto (CRON_SECRET) vive en Supabase Vault, no hardcodeado acá.
--    Cada cron.job lo lee con una subquery a vault.decrypted_secrets en el
--    momento de ejecutarse — nunca queda el valor en texto plano en
--    cron.job.command. Vault ya viene habilitado en Supabase (extensión
--    supabase_vault).
--
-- Para (re)crear el secreto en Vault (una sola vez, o si se rota):
--   select vault.create_secret(
--     '<VALOR-ALEATORIO-NUEVO>',   -- ej. openssl rand -hex 32 / crypto.randomBytes(32)
--     'fc_cron_secret',
--     'Secreto compartido para autorizar los cron jobs que invocan Edge Functions'
--   );
-- Si el secreto ya existe y se está rotando, usar vault.update_secret() en
-- vez de create_secret() (create_secret fallaría por nombre duplicado).
--
-- El mismo CRON_SECRET también hay que configurarlo como Edge Function
-- secret para que las funciones lo puedan leer en runtime:
--   supabase secrets set CRON_SECRET=<mismo valor que en Vault>
--
-- Reemplazar <ANON_KEY> abajo por el valor real de
-- Dashboard → Settings → API → anon/publishable key.
-- ================================================================

-- 1. Medication reminder — cada minuto
SELECT cron.schedule(
  'fc-med-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-med-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 2. Proof photo reminder — cada minuto (dispara ~30min después de confirmar dosis)
SELECT cron.schedule(
  'fc-proof-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-proof-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Evening push — UTC-4 / Venezuela (9pm local = 01:00 UTC del día siguiente)
SELECT cron.schedule(
  'fc-evening-push-utc4',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{"utc_offset": -4}'::jsonb
  );
  $$
);

-- 4. Evening push — UTC-5 (9pm local = 02:00 UTC del día siguiente)
SELECT cron.schedule(
  'fc-evening-push-utc5',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{"utc_offset": -5}'::jsonb
  );
  $$
);

-- 5. Evening push — UTC-6 (9pm local = 03:00 UTC del día siguiente)
SELECT cron.schedule(
  'fc-evening-push-utc6',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-evening-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{"utc_offset": -6}'::jsonb
  );
  $$
);

-- 6. Daily medication summary email — 8pm UTC
SELECT cron.schedule(
  'fc-daily-summary',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-daily-summary',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 7. Video call reminders (15-min warning + at-time alert) — cada minuto
SELECT cron.schedule(
  'fc-videocall-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/send-videocall-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para verificar que los jobs están programados:
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- Para ver el historial de corridas de un job:
-- SELECT * FROM cron.job_run_details WHERE jobid = <jobid> ORDER BY start_time DESC LIMIT 20;

-- Para remover un job:
-- SELECT cron.unschedule('fc-med-notifications');

-- Para modificar un job existente sin recrearlo (sin downtime, aplica al
-- siguiente disparo programado):
-- SELECT cron.alter_job(job_id := <jobid>, command := $$ ... $$);
