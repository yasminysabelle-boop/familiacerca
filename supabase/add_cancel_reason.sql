-- Add cancel_reason column to subscriptions table
alter table public.subscriptions
  add column if not exists cancel_reason text;
