-- ================================================================
-- FamiliaCerca — get_family_plan(p_owner_id)
-- Devuelve el plan EFECTIVO de una familia (plan/status/trial_end_date,
-- nunca datos de facturacion) a su dueño o a cualquier miembro invitado de
-- esa familia. Reemplaza el patron actual donde cada miembro invitado lee
-- su PROPIA fila de subscriptions -- ver
-- project_familiacerca_subscription_scoped_to_viewer en memoria.
--
-- Nunca devuelve stripe_customer_id, stripe_subscription_id,
-- paypal_subscription_id ni cancel_reason -- columnas explicitas, nunca
-- select *, para que agregar una columna a subscriptions en el futuro no
-- la filtre acá por accidente.
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

create or replace function public.get_family_plan(p_owner_id uuid)
returns table (plan text, status text, trial_end_date timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_owner_id and not fc_is_member_of(p_owner_id) then
    return; -- sin filas -- ni dueño ni miembro de esa familia
  end if;

  return query
    select s.plan, s.status, s.trial_end_date
    from public.subscriptions s
    where s.user_id = p_owner_id;
end;
$$;

grant execute on function public.get_family_plan(uuid) to authenticated;
