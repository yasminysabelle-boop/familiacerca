-- ================================================================
-- FamiliaCerca — log_activity(): cierra escritura arbitraria
--
-- Hallazgo (auditoria SECURITY DEFINER, 2026-08-13): log_activity() no
-- verificaba en absoluto que el caller fuera dueno o miembro de la
-- familia de p_owner_id -- ni siquiera para usuarios autenticados. El
-- grant original (add_care_routine_status_and_activity_log.sql) incluia
-- `anon` ademas de `authenticated`/`service_role`. Cualquiera, incluido
-- un caller anonimo, podia insertar entradas falsas en el activity_log
-- de CUALQUIER familia -- el mismo feed que lee Milo/Luna como contexto
-- de hechos verificados.
--
-- Llamadores legitimos confirmados (grep completo de src/ + supabase/):
--   - trg_fn_care_routine, trg_fn_incident, trg_fn_note/trg_fn_notes_incident
--     (triggers): corren con auth.uid() = el usuario real que ya paso el
--     RLS de la tabla base (daily_care_logs/notes) -- nunca NULL en el
--     camino real.
--   - send-evening-push (Edge Function): usa SUPABASE_SERVICE_ROLE_KEY,
--     auth.uid() es NULL ahi -- necesita su propia rama en el guard.
--   - Nunca se llama desde el cliente (src/), cero call sites en React.
-- ================================================================

create or replace function public.log_activity(
  p_type        text,
  p_description text,
  p_owner_id    uuid,
  p_actor_name  text default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_created_at  timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_id is null then return; end if;

  -- Guard explicito por rama, nunca una comparacion compuesta que pueda
  -- dar NULL (ver get_family_plan -- auth.uid() <> x da NULL, no false,
  -- cuando auth.uid() es NULL, y un `if NULL` no bloquea).
  if auth.role() = 'service_role' then
    null; -- caller de confianza (cron/Edge Functions), sigue
  elsif auth.uid() is null then
    return; -- anonimo: nunca
  elsif auth.uid() = p_owner_id or fc_is_member_of(p_owner_id) then
    null; -- dueno o miembro real de esa familia: sigue
  else
    return; -- autenticado pero ajeno a esta familia: bloqueado
  end if;

  insert into public.activity_log
    (type, description, owner_id, user_id, actor_name, metadata, created_at)
  values
    (p_type, p_description, p_owner_id, auth.uid(), p_actor_name, p_metadata, p_created_at);
exception when others then
  -- Un fallo al loguear no debe revertir la transaccion principal del
  -- trigger que llamo (el usuario perderia su rutina/nota/incidente por
  -- un problema del log secundario) -- pero a diferencia de la version
  -- anterior, esto SI queda visible en los logs de Postgres.
  raise warning 'log_activity failed (type=%, owner=%): %', p_type, p_owner_id, sqlerrm;
end;
$$;

revoke all on function public.log_activity(text, text, uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.log_activity(text, text, uuid, text, jsonb, timestamptz) to authenticated, service_role;
