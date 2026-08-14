-- ================================================================
-- FamiliaCerca — limpieza de grants para SECURITY DEFINER de bajo
-- impacto (auditoria 2026-08-13)
--
-- Estas 5 funciones NO tenian una via de explotacion real confirmada
-- (a diferencia de log_activity, get_family_plan y
-- accept_family_invitation, ver fix_log_activity_family_scope.sql /
-- fix_get_family_plan_anon_leak.sql / fix_accept_family_invitation_anon.sql)
-- pero comparten el mismo patron sistemico: ningun .sql del repo hacia
-- `revoke ... from public`, asi que el grant por defecto de Postgres a
-- PUBLIC quedaba abierto encima del grant explicito a `authenticated`.
-- Defensa en profundidad, sin cambiar logica de ninguna funcion.
--
-- create_family_invitation -- segura por casualidad hoy (user_id NOT
--   NULL en family_invitations revienta el insert anonimo con
--   constraint violation), pero no hay razon para dejar el grant
--   abierto a anon.
-- check_and_increment_ai_usage -- anon podia llamarla y siempre
--   "pasar" el limite (insert con user_id NULL, ON CONFLICT nunca
--   choca) + contaminar ai_usage_daily/hourly. No da acceso gratis a
--   Gemini por si sola (gemini-proxy/vision ya exigen JWT real antes
--   de llamarla) pero cierra la segunda capa.
-- resolve_care_owner -- cero chequeo de auth.uid() en el cuerpo; dado
--   cualquier user_id revela el owner de su circulo de cuidado. Riesgo
--   practico bajo (uuids no adivinables) pero sin razon para exponerla.
-- log_notification_run -- anon podia insertar basura en
--   notification_runs (tabla interna de metricas de los cron).
-- fc_shares_family -- devuelve NULL (no TRUE) para anon por como se
--   combina el OR con el EXISTS; se usa solo en USING() de RLS donde
--   NULL=false es seguro. El .sql original ya grantea solo a
--   authenticated -- esto solo cierra el PUBLIC por defecto.
-- ================================================================

revoke all on function public.create_family_invitation(text, text) from public, anon;
grant execute on function public.create_family_invitation(text, text) to authenticated;

revoke all on function public.check_and_increment_ai_usage(text, int, int) from public, anon;
grant execute on function public.check_and_increment_ai_usage(text, int, int) to authenticated;

revoke all on function public.resolve_care_owner(uuid) from public, anon;
grant execute on function public.resolve_care_owner(uuid) to authenticated;

revoke all on function public.log_notification_run(text, int, int, int, jsonb, text) from public, anon;
grant execute on function public.log_notification_run(text, int, int, int, jsonb, text) to authenticated, service_role;

revoke all on function public.fc_shares_family(uuid) from public, anon;
grant execute on function public.fc_shares_family(uuid) to authenticated;
