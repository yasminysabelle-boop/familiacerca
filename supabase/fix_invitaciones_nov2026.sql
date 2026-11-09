-- FamiliaCerca nov 2026: los familiares nunca lograban unirse a la familia,
-- por eso los avisos de medicamentos solo le llegaban a la dueña.
-- Pegar en Supabase > SQL Editor y tocar Run.

-- 1) Las invitaciones vencían en 24 horas -> ahora 7 días.
alter table public.family_invitations alter column expires_at set default (now() + interval '7 days');

-- 2) El enlace general (el que se comparte por WhatsApp) se "gastaba" con la
--    primera persona. Ahora sirve para toda la familia mientras no venza.
--    Las invitaciones por correo siguen siendo de un solo uso.
create or replace function public.accept_family_invitation(p_token text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_inv public.family_invitations%rowtype;
begin
  if auth.uid() is null then return 'not_authenticated'; end if;
  select * into v_inv from public.family_invitations
   where token = p_token::uuid and expires_at > now()
     and (status = 'pending' or (status = 'accepted' and invited_email like '%@familiacerca.app'));
  if not found then return 'invalid'; end if;
  if auth.uid() = v_inv.user_id then return 'owner_cannot_join'; end if;
  insert into public.family_members (user_id, member_user_id, member_email, role)
  values (v_inv.user_id, auth.uid(), auth.email(), 'familiar')
  on conflict (user_id, member_user_id) do nothing;
  if v_inv.invited_email is null or v_inv.invited_email not like '%@familiacerca.app' then
    update public.family_invitations set status = 'accepted' where token = p_token::uuid;
  end if;
  return 'ok';
end; $function$;
