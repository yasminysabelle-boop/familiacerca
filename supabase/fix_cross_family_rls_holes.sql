-- ================================================================
-- FamiliaCerca — Cierra huecos de acceso cruzado entre familias
-- Hallazgo: 2026-08-12, durante la apertura del chat familiar al plan
-- Free. Al auditar RLS de chat_messages se encontró una policy de
-- INSERT no versionada en ningún .sql del repo, y al mapear el resto
-- de las tablas sensibles se encontró un hueco mucho más grave en
-- family_members: cualquier usuario autenticado podía sumarse como
-- 'cuidador' a la familia de cualquier otro con solo conocer su
-- owner_id, sin invitación ni token. Confirmado con una prueba real
-- (2 usuarios .invalid desechables): el "atacante" leyó el chat y el
-- perfil del paciente de la "víctima" tras el insert directo.
--
-- Verificado antes de aplicar (ver memoria del proyecto para detalle):
-- - accept_family_invitation() es SECURITY DEFINER, valida token,
--   status='pending' y expires_at > now() — bypasea RLS, así que no
--   depende de la policy de INSERT que se borra acá.
-- - Cero código cliente hace .from('family_members').insert(...) o
--   .from('chat_messages').insert(...) con un owner_id ajeno — todo
--   el flujo real pasa por el RPC o por el propio owner_id del user.
--
-- Backup previo (esquema + RLS + funciones, snapshot vía Management
-- API — sin pg_dump binario porque Docker no está disponible en la
-- máquina de desarrollo): familiacerca-backups/schema-snapshot-*.json
-- (fuera del repo, no versionado).
--
-- Este archivo cubre 3a y 3c del plan aprobado por Yasmin. 3b
-- (family_invitations, requiere cambios de frontend) va en un commit
-- aparte cuando esté verificado de punta a punta.
-- ================================================================

-- ----------------------------------------------------------------
-- 3a — family_members: el INSERT directo desde el cliente no debe
-- existir. La membresía se crea solo por accept_family_invitation.
-- Reemplaza: "family_members: authenticated insert" (creada en
-- create_invitations.sql:71 — documentada, pero su diseño original
-- confiaba en que el cliente siempre pasara primero por el RPC; el
-- with_check nunca validó contra family_invitations, así que nada
-- lo exigía del lado del servidor).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "family_members: authenticated insert" ON public.family_members;

-- ----------------------------------------------------------------
-- 3c — chat_messages: elimina la policy huérfana de INSERT.
-- Reemplaza: "Users can insert own messages" — no versionada en
-- ningún .sql del repo (creada a mano en algún momento, nunca
-- documentada). Solo exigía auth.uid() = user_id, sin chequear
-- owner_id en absoluto, permitiendo insertar en el chat de cualquier
-- familia sin ser dueño ni miembro. La policy correcta y versionada
-- ("Chat: family members can insert", fix_chat_rls.sql:25) sigue
-- intacta y es la que usa el flujo real.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;

-- ================================================================
-- Verificado en producción tras aplicar 3a/3c (usuarios .invalid
-- desechables, datos borrados al terminar):
-- - Ataque repetido en family_members y chat_messages -> 42501 en
--   ambos casos.
-- - Flujo legítimo completo: create_family_invitation ->
--   accept_family_invitation ('ok') -> fila real en family_members
--   -> el miembro recién aceptado envía un mensaje real al chat de
--   su familia -> 201, persiste.
-- ================================================================

-- ----------------------------------------------------------------
-- 3b — family_invitations: la lectura pública ("family_invitations:
-- public read", qual: true, create_invitations.sql:39) permitía leer
-- TODAS las invitaciones de TODOS los usuarios sin ningún login,
-- incluido el token secreto de aceptación — confirmado con un
-- request anónimo (solo apikey) que devolvió 200 OK sobre la tabla
-- completa.
--
-- RLS no puede filtrar "solo si me pasaste el token exacto en el
-- WHERE" — una policy USING() no tiene visibilidad de qué filtro
-- mandó el cliente, así que cualquier policy de lectura pública
-- sobre esta tabla equivale a listarla entera. La solución es la
-- misma que ya usa accept_family_invitation: una función SECURITY
-- DEFINER que recibe el token como parámetro y hace el lookup del
-- lado del servidor.
--
-- Devuelve solo los campos que la UI de /join realmente usa (no
-- expone token ni id) — invited_email se mantiene porque
-- JoinFamily.jsx sí la muestra ("Esta invitación fue enviada a...")
-- y la compara contra el email del usuario logueado.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  user_id       uuid,
  invited_email text,
  invited_by    text,
  status        text,
  expires_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fi.user_id, fi.invited_email, fi.invited_by, fi.status, fi.expires_at
  FROM public.family_invitations fi
  WHERE fi.token = p_token::uuid;
END;
$$;

-- anon, no solo authenticated: /join es una ruta pública (App.jsx no
-- la envuelve en ProtectedRoute) — el invitado ve el preview de la
-- invitación ANTES de tener cuenta. Si solo se otorgara a
-- authenticated, se rompe ese caso de uso principal.
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "family_invitations: public read" ON public.family_invitations;

-- Requiere 2 cambios de frontend en el mismo commit (ambos hacían
-- .from('family_invitations').select(...).eq('token', token), ahora
-- llaman a la función):
-- - src/pages/JoinFamily.jsx (fetchInvitation)
-- - src/App.jsx (chequeo de token pendiente post-login)
-- AdminTeamSection.jsx no cambia — ya lee por user_id = ownerId,
-- cubierto por "family_invitations: owner manage".

-- ================================================================
-- Verificado en producción tras aplicar 3b (usuarios .invalid
-- desechables, datos borrados al terminar):
-- - get_invitation_by_token, sin sesión, con token real -> devuelve
--   exactamente los 5 campos, nada más.
-- - get_invitation_by_token con token inventado -> [], sin error.
-- - Lectura directa de la tabla sin sesión -> [] (ya no listable).
-- - Flujo completo: create_family_invitation -> preview vía la
--   función sin sesión -> registro -> accept_family_invitation
--   ('ok') -> fila real en family_members -> status pasa a
--   'accepted' (confirmado vía la función, no por lectura directa)
--   -> el invitado envía un mensaje real al chat de su nueva
--   familia -> 201, persiste.
-- ================================================================
