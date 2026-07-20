-- Allow 'suspended' status (PayPal BILLING.SUBSCRIPTION.SUSPENDED webhook event)
-- Additive change, does not affect existing rows.
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('trial', 'active', 'expired', 'cancelled', 'suspended'));
