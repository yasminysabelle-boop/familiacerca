-- ================================================================
-- FamiliaCerca — observabilidad mínima de notificaciones push
-- Run in the Supabase SQL Editor
--
-- Contexto: auditoría 2026-08-09 de send-med-notifications encontró el mismo
-- punto ciego que ya se confirmó en send-daily-summary — el cron corre cada
-- minuto y pg_cron.job_run_details lo marca "succeeded" indefinidamente
-- (net.http_post solo confirma que hubo respuesta HTTP), sin importar si
-- adentro TODAS las notificaciones fallaron en silencio (VAPID mal
-- configurado, todas las suscripciones caducadas, etc.). No existía ninguna
-- tabla de log — solo console.log/console.error efímeros que nadie revisa.
--
-- notification_runs guarda UNA fila por EJECUCIÓN de función (no por
-- notificación individual — mantiene el volumen trivial: ~1440 filas/día
-- para un cron de cada minuto) con el resumen de intentos/éxitos/fallos.
--
-- Empieza instrumentando solo send-med-notifications (primer paso
-- incremental); el resto de funciones de push se suman después de
-- confirmar que este primer paso funciona bien.
-- ================================================================

create table if not exists public.notification_runs (
  id              uuid primary key default gen_random_uuid(),
  function_name   text not null,
  run_at          timestamptz not null default now(),
  attempted       int not null default 0,
  sent            int not null default 0,
  failed          int not null default 0,
  failure_reasons jsonb,        -- ej. {"410": 3, "403": 1} — conteo por status code, sin PII por suscriptor
  fatal_error     text          -- si la función entera no pudo intentar enviar nada (VAPID faltante, error de query, etc.)
);

-- Telemetría operativa, no dato de familia — sin política de lectura para
-- anon/authenticated (nadie del lado cliente necesita verla hoy). service_role
-- (las Edge Functions) bypassa RLS por defecto en Supabase.
alter table public.notification_runs enable row level security;

create index if not exists idx_notification_runs_function_time
  on public.notification_runs(function_name, run_at desc);

-- ================================================================
-- LOG_NOTIFICATION_RUN — mismo patrón que log_activity() (ver
-- add_care_routine_status_and_activity_log.sql): SECURITY DEFINER + nunca
-- lanza excepción, para que un fallo al loguear jamás pueda romper el envío
-- real de notificaciones que ya se completó.
-- ================================================================
create or replace function public.log_notification_run(
  p_function_name   text,
  p_attempted       int default 0,
  p_sent            int default 0,
  p_failed          int default 0,
  p_failure_reasons jsonb default null,
  p_fatal_error     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_runs
    (function_name, attempted, sent, failed, failure_reasons, fatal_error)
  values
    (p_function_name, p_attempted, p_sent, p_failed, p_failure_reasons, p_fatal_error);
exception when others then null; -- nunca debe romper el envío real
end;
$$;

grant execute on function public.log_notification_run(text, int, int, int, jsonb, text) to anon, authenticated, service_role;

-- Para revisar corridas recientes de una función:
-- select * from public.notification_runs where function_name = 'send-med-notifications' order by run_at desc limit 20;
