-- ================================================================
-- FamiliaCerca — aviso único "quedan pocos días de prueba"
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

alter table public.subscriptions
  add column if not exists trial_ending_seen_at timestamptz;

-- Mismo patrón que mark_trial_ended_seen() (add_trial_ended_seen.sql): el
-- cliente no tiene policy de update sobre subscriptions, así que este flag
-- se marca vía RPC security definer, acotado a esta sola columna y solo una
-- vez (no pisa un valor ya seteado).
create or replace function public.mark_trial_ending_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set trial_ending_seen_at = now()
  where user_id = auth.uid()
    and trial_ending_seen_at is null;
end;
$$;

grant execute on function public.mark_trial_ending_seen() to authenticated;
