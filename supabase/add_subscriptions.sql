-- ================================================================
-- FamiliaCerca — Subscriptions table
-- Run in Supabase SQL Editor
-- ================================================================

create table if not exists public.subscriptions (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  plan                    text        not null default 'trial'
                                      check (plan in ('trial', 'familiar', 'care_plus')),
  status                  text        not null default 'trialing'
                                      check (status in ('trialing', 'active', 'canceled', 'past_due', 'paused')),
  trial_end_date          timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id)
);

-- RLS
alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscription"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

-- Edge functions use service role for updates — no user-level update policy needed

-- Auto-update updated_at
create or replace function public.touch_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.touch_subscriptions_updated_at();
