-- ================================================================
-- FamiliaCerca — Invitation RPC functions
-- Run this in the Supabase SQL Editor after create_invitations.sql
-- ================================================================

-- ----------------------------------------------------------------
-- create_family_invitation
-- Called from More.jsx when the user sends an invite.
-- Returns the generated token UUID.
-- ----------------------------------------------------------------
create or replace function public.create_family_invitation(
  p_invited_email text,
  p_invited_by    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  insert into public.family_invitations (user_id, invited_email, invited_by)
  values (auth.uid(), p_invited_email, p_invited_by)
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function public.create_family_invitation(text, text) to authenticated;

-- ----------------------------------------------------------------
-- accept_family_invitation
-- Called from JoinFamily.jsx when the invited user accepts.
-- Inserts into family_members and marks the invitation accepted.
-- Returns 'ok' on success, error message on failure.
-- ----------------------------------------------------------------
create or replace function public.accept_family_invitation(
  p_token text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.family_invitations%rowtype;
begin
  select * into v_inv
  from public.family_invitations
  where token = p_token::uuid
    and status = 'pending'
    and expires_at > now();

  if not found then
    return 'invalid';
  end if;

  insert into public.family_members (user_id, member_user_id, member_email)
  values (v_inv.user_id, auth.uid(), auth.email())
  on conflict (user_id, member_user_id) do nothing;

  update public.family_invitations
  set status = 'accepted'
  where token = p_token::uuid;

  return 'ok';
end;
$$;

grant execute on function public.accept_family_invitation(text) to authenticated;
