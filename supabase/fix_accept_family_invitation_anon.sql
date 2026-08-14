-- ================================================================
-- FamiliaCerca — accept_family_invitation(): cierra aceptacion anonima
--
-- Hallazgo (auditoria SECURITY DEFINER, 2026-08-13): sin guard de
-- auth.uid() is null, un caller anonimo con un token real pendiente
-- podia "aceptar" la invitacion -- inserta family_members con
-- member_user_id = NULL (columna nullable) y marca la invitacion
-- 'accepted', quemandola para el invitado real. Confirmado por schema
-- (member_user_id es nullable) y por lectura de codigo, no probado en
-- vivo contra un token real para no consumir una invitacion de verdad.
--
-- El NULL en member_user_id no representa "invitado, no acepto todavia"
-- -- ninguna funcion del repo crea esa fila hoy (create_family_invitation
-- solo escribe en family_invitations). El isPending/useBadgeCounts que
-- lee member_user_id IS NULL es una feature vestigial sin camino de
-- escritura -- ver project_familiacerca_subscription_scoped_to_viewer
-- (o memoria equivalente) para la decision de producto pendiente.
-- ================================================================

create or replace function public.accept_family_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.family_invitations%rowtype;
begin
  if auth.uid() is null then
    return 'not_authenticated'; -- anonimo: nunca llega a leer ni escribir nada
  end if;

  select * into v_inv
  from public.family_invitations
  where token = p_token::uuid
    and status = 'pending'
    and expires_at > now();

  if not found then
    return 'invalid';
  end if;

  -- Prevent the family owner from accepting their own invitation link
  if auth.uid() = v_inv.user_id then
    return 'owner_cannot_join';
  end if;

  insert into public.family_members (user_id, member_user_id, member_email, role)
  values (v_inv.user_id, auth.uid(), auth.email(), 'familiar')
  on conflict (user_id, member_user_id) do nothing;

  update public.family_invitations
  set status = 'accepted'
  where token = p_token::uuid;

  return 'ok';
end;
$$;

revoke all on function public.accept_family_invitation(text) from public, anon;
grant execute on function public.accept_family_invitation(text) to authenticated;
