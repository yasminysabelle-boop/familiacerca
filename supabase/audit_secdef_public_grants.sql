-- ================================================================
-- FamiliaCerca — auditoria de grants abiertos en funciones SECURITY
-- DEFINER. Correr en el SQL Editor (o `supabase db query --linked
-- --file supabase/audit_secdef_public_grants.sql`) despues de CADA
-- migracion que cree o reemplace una funcion SECURITY DEFINER.
--
-- Postgres otorga EXECUTE a PUBLIC por defecto al crear cualquier
-- funcion, salvo que se haga un `revoke` explicito -- un
-- `grant ... to authenticated` NUNCA resta el acceso de PUBLIC, solo
-- suma. Esta query detecta esa brecha sistemica antes de que llegue a
-- produccion sin revisar (ver auditoria 2026-08-13: las 22 funciones
-- SECURITY DEFINER del proyecto tenian anon_can_execute=true, incluidas
-- varias que el .sql decia otorgar "solo a authenticated").
--
-- Filas con "reachable_by_public = true" y prosecdef = true necesitan
-- revision: o llevan `revoke all ... from public, anon` + guard de
-- `auth.uid() is null`, o estan deliberadamente pensadas para llamarse
-- sin sesion (como get_invitation_by_token, patron capability-URL con
-- el token como credencial) -- en ese caso, documentarlo en un
-- comentario junto al GRANT, no dejarlo como omision silenciosa.
-- ================================================================

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prorettype = 'trigger'::regtype as is_trigger_fn, -- no invocable por RPC aunque tenga el grant
  has_function_privilege('anon', p.oid, 'EXECUTE') as reachable_by_anon,
  has_function_privilege('public', p.oid, 'EXECUTE') as reachable_by_public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
  and (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('public', p.oid, 'EXECUTE')
  )
  and p.prorettype != 'trigger'::regtype
order by p.proname;
