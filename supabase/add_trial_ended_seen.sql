-- ================================================================
-- FamiliaCerca — mensaje único de "tu prueba terminó"
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

alter table public.subscriptions
  add column if not exists trial_ended_seen_at timestamptz;

-- El cliente no tiene policy de update sobre subscriptions (solo select/insert
-- propios; el resto lo hacen las Edge Functions con service role). Se marca
-- este campo vía RPC security definer, acotado a esa sola columna y solo una
-- vez (no pisa un valor ya seteado), en vez de abrir una policy de update
-- genérica que permitiría a cualquier usuario reescribir su propio
-- plan/status por REST.
create or replace function public.mark_trial_ended_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set trial_ended_seen_at = now()
  where user_id = auth.uid()
    and trial_ended_seen_at is null;
end;
$$;

grant execute on function public.mark_trial_ended_seen() to authenticated;
