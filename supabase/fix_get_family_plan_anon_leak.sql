-- ================================================================
-- FamiliaCerca — get_family_plan(): cierra fuga de datos a anonimos
--
-- Hallazgo (auditoria SECURITY DEFINER, 2026-08-13): el guard original
-- `if auth.uid() <> p_owner_id and not fc_is_member_of(p_owner_id) then
-- return; end if;` da NULL (no false) cuando auth.uid() es NULL -- un
-- `if NULL` en PL/pgSQL no bloquea, asi que la funcion caia directo al
-- `return query` real. Confirmado en vivo: un caller anonimo (solo la
-- anon key publica, sin JWT de usuario) obtenia plan/status/trial_end_date
-- reales de cualquier owner_id.
--
-- Mismo guard por ramas que log_activity() (ver
-- fix_log_activity_family_scope.sql) -- nunca una comparacion compuesta
-- que pueda dar NULL.
-- ================================================================

create or replace function public.get_family_plan(p_owner_id uuid)
returns table (plan text, status text, trial_end_date timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return; -- anonimo: sin filas
  elsif auth.uid() = p_owner_id or fc_is_member_of(p_owner_id) then
    null; -- dueno o miembro real de esa familia: sigue
  else
    return; -- autenticado pero ajeno a esta familia: sin filas
  end if;

  return query
    select s.plan, s.status, s.trial_end_date
    from public.subscriptions s
    where s.user_id = p_owner_id;
end;
$$;

revoke all on function public.get_family_plan(uuid) from public, anon;
grant execute on function public.get_family_plan(uuid) to authenticated;
