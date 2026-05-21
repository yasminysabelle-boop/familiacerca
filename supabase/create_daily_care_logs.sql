-- ================================================================
-- FamiliaCerca — Daily care checklist logs
-- Run in Supabase SQL Editor (safe to re-run)
-- ================================================================

create table if not exists public.daily_care_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  item_key    text        not null,
  log_date    date        not null default current_date,
  checked_at  timestamptz not null default now(),
  checked_by  text,
  created_at  timestamptz not null default now(),
  unique (user_id, item_key, log_date)
);

alter table public.daily_care_logs enable row level security;

-- Owner and invited family members can read and write
drop policy if exists "daily_care_logs: family group" on public.daily_care_logs;
create policy "daily_care_logs: family group"
  on public.daily_care_logs for all
  using  (auth.uid() = user_id or public.fc_is_member_of(user_id))
  with check (auth.uid() = user_id or public.fc_is_member_of(user_id));

create index if not exists idx_daily_care_logs_user_date
  on public.daily_care_logs(user_id, log_date);
